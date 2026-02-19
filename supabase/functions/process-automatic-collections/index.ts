import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// 3 minutes between messages to avoid Meta banning
const BULK_INTERVAL_MS = 3 * 60 * 1000;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Verify that the request comes from an authorized source
  const authHeader = req.headers.get('Authorization');
  const expectedToken = `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`;
  
  if (authHeader !== expectedToken) {
    console.error('Unauthorized access attempt to process-automatic-collections');
    return new Response(
      JSON.stringify({ error: 'Unauthorized' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('Starting automatic collection processing...');

    // Fetch active rules
    const { data: rules, error: rulesError } = await supabase
      .from('collection_rules')
      .select('*')
      .eq('is_active', true)
      .order('days_overdue', { ascending: true });

    if (rulesError) {
      console.error('Error fetching rules:', rulesError);
      throw rulesError;
    }

    if (!rules || rules.length === 0) {
      console.log('No active collection rules found');
      return new Response(
        JSON.stringify({ success: true, message: 'No active rules', processed: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${rules.length} active rules`);

    // Fetch exclusions
    const { data: exclusions } = await supabase
      .from('defaulter_exclusions')
      .select('customer_id');

    const excludedIds = new Set((exclusions || []).map(e => e.customer_id));
    console.log(`Found ${excludedIds.size} excluded customers`);

    // Fetch overdue transactions from Advbox via cache
    const advboxResponse = await fetch(
      `${Deno.env.get('SUPABASE_URL')}/functions/v1/advbox-integration?endpoint=transactions`,
      {
        headers: {
          'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`,
        },
      }
    );

    if (!advboxResponse.ok) {
      throw new Error('Failed to fetch Advbox transactions');
    }

    const advboxData = await advboxResponse.json();
    const transactions = advboxData.data || advboxData;

    if (!Array.isArray(transactions)) {
      throw new Error('Invalid transactions data format');
    }

    console.log(`Processing ${transactions.length} transactions`);

    const now = new Date();
    let messagesProcessed = 0;
    let messagesSkipped = 0;
    let messagesFailed = 0;

    for (const rule of rules) {
      console.log(`Processing rule: ${rule.name} (${rule.days_overdue} days)`);

      const overdueTransactions = transactions.filter((t: any) => {
        if (t.type !== 'income' || t.status !== 'overdue') return false;
        if (!t.customer_id || excludedIds.has(t.customer_id)) return false;

        const dueDate = t.due_date ? new Date(t.due_date) : new Date(t.date);
        const daysPastDue = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));

        return Math.abs(daysPastDue - rule.days_overdue) <= 1;
      });

      console.log(`Found ${overdueTransactions.length} transactions matching rule ${rule.name}`);

      for (let i = 0; i < overdueTransactions.length; i++) {
        const transaction = overdueTransactions[i];

        // Check if message was already sent in the last 24h
        const { data: recentMessages } = await supabase
          .from('defaulter_messages_log')
          .select('*')
          .eq('customer_id', transaction.customer_id)
          .gte('sent_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
          .order('sent_at', { ascending: false })
          .limit(1);

        if (recentMessages && recentMessages.length > 0) {
          console.log(`Skipping ${transaction.customer_name} - message sent in last 24h`);
          messagesSkipped++;
          continue;
        }

        const phone = transaction.customer_phone || transaction.customer_cellphone;
        if (!phone) {
          console.log(`Skipping ${transaction.customer_name} - no phone`);
          messagesSkipped++;
          continue;
        }

        try {
          // Send message via the send-defaulter-message function (now uses Z-API)
          const sendResponse = await fetch(
            `${Deno.env.get('SUPABASE_URL')}/functions/v1/send-defaulter-message`,
            {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                customerId: transaction.customer_id,
                customerName: transaction.customer_name || 'Cliente',
                customerPhone: phone,
                amount: transaction.amount,
                daysOverdue: rule.days_overdue,
              }),
            }
          );

          const sendData = await sendResponse.json();

          if (sendData.success) {
            console.log(`Message sent successfully to ${transaction.customer_name}`);
            messagesProcessed++;
          } else {
            console.error(`Failed to send message to ${transaction.customer_name}:`, sendData.error);
            messagesFailed++;
          }

          // Wait 3 minutes between messages to avoid Meta banning
          if (i < overdueTransactions.length - 1) {
            console.log(`⏳ Waiting 3 minutes before next message...`);
            await new Promise(resolve => setTimeout(resolve, BULK_INTERVAL_MS));
          }

        } catch (error) {
          console.error(`Error sending message to ${transaction.customer_name}:`, error);
          messagesFailed++;
        }
      }
    }

    console.log(`Processing complete: ${messagesProcessed} sent, ${messagesSkipped} skipped, ${messagesFailed} failed`);

    return new Response(
      JSON.stringify({ 
        success: true,
        processed: messagesProcessed,
        skipped: messagesSkipped,
        failed: messagesFailed,
        totalRules: rules.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in process-automatic-collections function:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});
