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
  const startTime = Date.now();
  const MAX_RUNTIME_MS = 50000;

  try {
    console.log('Starting incremental sync of ADVBox customers...');

    // Fix stale "running" records (crashed/timed out previous runs > 2 min)
    await supabase
      .from('advbox_sync_status')
      .update({ status: 'partial', completed_at: new Date().toISOString() })
      .eq('sync_type', 'customers')
      .eq('status', 'running')
      .lt('started_at', new Date(Date.now() - 2 * 60 * 1000).toISOString());

    // Check if another instance is currently running (concurrency lock)
    const { data: activeRun } = await supabase
      .from('advbox_sync_status')
      .select('id, started_at')
      .eq('sync_type', 'customers')
      .eq('status', 'running')
      .limit(1)
      .single();

    if (activeRun) {
      console.log('Another sync is already running. Skipping.');
      return new Response(
        JSON.stringify({ success: true, status: 'skipped', message: 'Outra sincronização já está em andamento.' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check where we left off from previous partial sync
    const { data: lastSync } = await supabase
      .from('advbox_sync_status')
      .select('*')
      .eq('sync_type', 'customers')
      .eq('status', 'partial')
      .order('completed_at', { ascending: false })
      .limit(1)
      .single();

    let startOffset = 0;
    if (lastSync && lastSync.last_offset && lastSync.last_offset > 0) {
      startOffset = lastSync.last_offset;
      console.log(`Resuming from previous partial sync, last_offset: ${startOffset}`);
    } else {
      console.log('No valid partial sync found, starting from offset 0');
    }

    // Delete old partial/completed records to keep table clean (keep only current run)
    await supabase
      .from('advbox_sync_status')
      .delete()
      .eq('sync_type', 'customers')
      .in('status', ['partial', 'completed']);

    // Create sync status record (concurrency lock)
    const { data: syncRecord, error: syncInsertError } = await supabase
      .from('advbox_sync_status')
      .insert({
        sync_type: 'customers',
        status: 'running',
        started_at: new Date().toISOString(),
        last_offset: startOffset,
      })
      .select('id')
      .single();

    if (syncInsertError) {
      console.error('Failed to create sync status record:', syncInsertError);
    }

    const syncId = syncRecord?.id;
    console.log(`Sync record created: ${syncId}, starting from offset ${startOffset}`);

    let offset = startOffset;
    const limit = 100;
    let hasMore = true;
    let totalUpserted = 0;
    let iterations = 0;
    const DELAY_BETWEEN_REQUESTS = 300;

    try {
      while (hasMore) {
        // Check time limit
        if (Date.now() - startTime > MAX_RUNTIME_MS) {
          console.log(`Time limit reached after ${iterations} iterations. Saving progress at offset ${offset}.`);
          
          // Mark as partial so next invocation continues
          if (syncId) {
            const { error: updateErr } = await supabase
              .from('advbox_sync_status')
              .update({
                status: 'partial',
                last_offset: offset,
                total_processed: totalUpserted,
                completed_at: new Date().toISOString(),
              })
              .eq('id', syncId);
            
            if (updateErr) {
              console.error(`Failed to save partial status:`, updateErr);
            } else {
              console.log(`Partial status saved successfully: offset=${offset}, processed=${totalUpserted}`);
            }
          }

          return new Response(
            JSON.stringify({
              success: true,
              status: 'partial',
              total_upserted: totalUpserted,
              last_offset: offset,
              message: `Sincronização parcial: ${totalUpserted} clientes salvos. Execute novamente para continuar.`,
            }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        if (iterations > 0) {
          await sleep(DELAY_BETWEEN_REQUESTS);
        }

        console.log(`Fetching customers offset=${offset}...`);
        const response = await makeAdvboxRequest(`/customers?limit=${limit}&offset=${offset}`);

        const items = response.data || [];
        const totalCount = response.totalCount || 0;

        if (items.length === 0) {
          hasMore = false;
        } else {
          // INCREMENTAL UPSERT: save immediately after each fetch
          const batch = items.map((customer: any) => ({
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
            console.error(`Upsert error at offset ${offset}:`, upsertError);
          } else {
            totalUpserted += batch.length;
          }

          offset += items.length;
          iterations++;

          // Update progress every 3 iterations (more frequent)
          if (syncId && iterations % 3 === 0) {
            await supabase
              .from('advbox_sync_status')
              .update({
                last_offset: offset,
                total_processed: totalUpserted,
              })
              .eq('id', syncId);
          }

          console.log(`Upserted batch: ${totalUpserted} total (offset ${offset}/${totalCount})`);

          if (items.length < limit || (totalCount > 0 && offset >= totalCount)) {
            hasMore = false;
          }
        }
      }

      // Completed fully - clean up and mark as completed
      if (syncId) {
        await supabase
          .from('advbox_sync_status')
          .update({
            status: 'completed',
            total_processed: totalUpserted,
            last_offset: offset,
            completed_at: new Date().toISOString(),
          })
          .eq('id', syncId);
      }

      console.log(`Sync completed: ${totalUpserted} customers upserted in ${iterations} iterations`);

      return new Response(
        JSON.stringify({
          success: true,
          status: 'completed',
          total_upserted: totalUpserted,
          iterations,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error('Sync error:', errorMsg);

      if (syncId) {
        const { error: updateErr } = await supabase
          .from('advbox_sync_status')
          .update({
            status: 'partial',
            error_message: errorMsg,
            total_processed: totalUpserted,
            last_offset: offset,
            completed_at: new Date().toISOString(),
          })
          .eq('id', syncId);
        
        if (updateErr) {
          console.error('Failed to save error status:', updateErr);
        } else {
          console.log(`Error status saved: offset=${offset}, processed=${totalUpserted}`);
        }
      }

      return new Response(
        JSON.stringify({ 
          success: totalUpserted > 0,
          status: 'partial',
          error: errorMsg, 
          total_upserted: totalUpserted,
          last_offset: offset,
          message: totalUpserted > 0 
            ? `${totalUpserted} clientes salvos antes do erro. Execute novamente para continuar.`
            : 'Erro na sincronização.',
        }),
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
