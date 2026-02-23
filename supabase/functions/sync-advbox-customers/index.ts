import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version, x-region',
};

const ADVBOX_API_BASE = 'https://app.advbox.com.br/api/v1';
const ADVBOX_TOKEN = Deno.env.get('ADVBOX_API_TOKEN');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function makeAdvboxRequest(endpoint: string, retryCount = 0): Promise<any> {
  const url = `${ADVBOX_API_BASE}${endpoint}`;
  const maxRetries = 5;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${ADVBOX_TOKEN}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
  });

  if (response.status === 429 && retryCount < maxRetries) {
    const waitTime = Math.pow(2, retryCount) * 2000;
    console.log(`Rate limited. Waiting ${waitTime}ms before retry ${retryCount + 1}/${maxRetries}`);
    await sleep(waitTime);
    return makeAdvboxRequest(endpoint, retryCount + 1);
  }

  const responseText = await response.text();

  if (!response.ok) {
    throw new Error(`Advbox API error: ${response.status} - ${responseText.substring(0, 200)}`);
  }

  if (!responseText.trim().startsWith('{') && !responseText.trim().startsWith('[')) {
    throw new Error('API returned non-JSON response');
  }

  return JSON.parse(responseText);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    console.log('Starting sync of ADVBox customers...');

    // Create sync status record
    const { data: syncRecord } = await supabase
      .from('advbox_sync_status')
      .insert({
        sync_type: 'customers',
        status: 'running',
        started_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    const syncId = syncRecord?.id;

    let allCustomers: any[] = [];
    let offset = 0;
    const limit = 100;
    let hasMore = true;
    let totalCount = 0;
    let iterations = 0;
    const maxIterations = 200;
    const DELAY_BETWEEN_REQUESTS = 1500;

    try {
      while (hasMore && iterations < maxIterations) {
        if (iterations > 0) {
          await sleep(DELAY_BETWEEN_REQUESTS);
        }

        // Update progress
        if (syncId) {
          await supabase
            .from('advbox_sync_status')
            .update({
              last_offset: offset,
              total_processed: allCustomers.length,
            })
            .eq('id', syncId);
        }

        console.log(`Fetching customers offset=${offset}...`);
        const response = await makeAdvboxRequest(`/customers?limit=${limit}&offset=${offset}`);

        const items = response.data || [];
        totalCount = response.totalCount || totalCount || items.length;

        if (items.length === 0) {
          hasMore = false;
        } else {
          allCustomers = allCustomers.concat(items);
          offset += items.length;
          iterations++;

          if (items.length < limit || allCustomers.length >= totalCount) {
            hasMore = false;
          }
        }
      }

      console.log(`Fetched ${allCustomers.length} customers in ${iterations} iterations`);

      // Upsert in batches of 500
      const batchSize = 500;
      let upsertedCount = 0;

      for (let i = 0; i < allCustomers.length; i += batchSize) {
        const batch = allCustomers.slice(i, i + batchSize).map((customer: any) => ({
          advbox_id: customer.id,
          name: customer.name || 'Sem nome',
          tax_id: customer.tax_id || null,
          cpf: customer.cpf || null,
          cnpj: customer.cnpj || null,
          email: customer.email || null,
          phone: customer.phone || customer.mobile_phone || null,
          birthday: customer.birthday || null,
          synced_at: new Date().toISOString(),
        }));

        const { error: upsertError } = await supabase
          .from('advbox_customers')
          .upsert(batch, { onConflict: 'advbox_id' });

        if (upsertError) {
          console.error(`Batch upsert error at offset ${i}:`, upsertError);
          throw upsertError;
        }

        upsertedCount += batch.length;
        console.log(`Upserted ${upsertedCount}/${allCustomers.length} customers`);
      }

      // Update sync status to completed
      if (syncId) {
        await supabase
          .from('advbox_sync_status')
          .update({
            status: 'completed',
            total_processed: upsertedCount,
            completed_at: new Date().toISOString(),
          })
          .eq('id', syncId);
      }

      console.log(`Sync completed: ${upsertedCount} customers upserted`);

      return new Response(
        JSON.stringify({
          success: true,
          total_fetched: allCustomers.length,
          total_upserted: upsertedCount,
          iterations,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error('Sync error:', errorMsg);

      if (syncId) {
        await supabase
          .from('advbox_sync_status')
          .update({
            status: 'error',
            error_message: errorMsg,
            total_processed: allCustomers.length,
            completed_at: new Date().toISOString(),
          })
          .eq('id', syncId);
      }

      return new Response(
        JSON.stringify({ error: errorMsg, partial_count: allCustomers.length }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error('Fatal error:', errorMsg);

    return new Response(
      JSON.stringify({ error: errorMsg }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
