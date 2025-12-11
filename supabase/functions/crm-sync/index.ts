import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const RD_STATION_API_URL = 'https://crm.rdstation.com/api/v1';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const rdToken = Deno.env.get('RD_STATION_API_TOKEN');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    if (!rdToken) {
      return new Response(
        JSON.stringify({ error: 'RD_STATION_API_TOKEN não configurado' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { action } = await req.json();

    let result: any = {};

    switch (action) {
      case 'sync_pipelines':
        result = await syncPipelines(rdToken, supabase);
        break;
      case 'sync_contacts':
        result = await syncContacts(rdToken, supabase);
        break;
      case 'sync_deals':
        result = await syncDeals(rdToken, supabase);
        break;
      case 'full_sync':
        const pipelinesResult = await syncPipelines(rdToken, supabase);
        const contactsResult = await syncContacts(rdToken, supabase);
        const dealsResult = await syncDeals(rdToken, supabase);
        
        // Update last sync timestamp
        await supabase
          .from('crm_settings')
          .update({ last_full_sync_at: new Date().toISOString() })
          .eq('id', (await supabase.from('crm_settings').select('id').single()).data?.id);
        
        result = {
          pipelines: pipelinesResult,
          contacts: contactsResult,
          deals: dealsResult
        };
        break;
      default:
        return new Response(
          JSON.stringify({ error: 'Ação inválida' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

    return new Response(
      JSON.stringify({ success: true, ...result }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Error in CRM sync:', error);
    return new Response(
      JSON.stringify({ error: error?.message || 'Erro desconhecido' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function syncPipelines(rdToken: string, supabase: any) {
  console.log('Syncing pipelines from RD Station...');
  
  // Fetch deal stages (which include pipeline info)
  const response = await fetch(`${RD_STATION_API_URL}/deal_stages?token=${rdToken}&limit=200`);
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error('RD Station API error:', errorText);
    throw new Error(`Erro ao buscar pipelines: ${response.status}`);
  }

  const data = await response.json();
  const stages = data.deal_stages || [];
  
  console.log(`Found ${stages.length} deal stages`);

  // Group stages by pipeline
  const pipelinesMap = new Map();
  
  for (const stage of stages) {
    const pipelineId = stage.deal_pipeline?._id || 'default';
    const pipelineName = stage.deal_pipeline?.name || 'Pipeline Padrão';
    
    if (!pipelinesMap.has(pipelineId)) {
      pipelinesMap.set(pipelineId, {
        rd_station_id: pipelineId,
        name: pipelineName,
        stages: []
      });
    }
    
    pipelinesMap.get(pipelineId).stages.push({
      rd_station_id: stage._id,
      name: stage.name,
      order_index: stage.order || 0,
      is_won: stage.name?.toLowerCase().includes('ganho') || stage.name?.toLowerCase().includes('won'),
      is_lost: stage.name?.toLowerCase().includes('perdido') || stage.name?.toLowerCase().includes('lost')
    });
  }

  let pipelinesCreated = 0;
  let stagesCreated = 0;

  // Insert/update pipelines and stages
  for (const [pipelineRdId, pipelineData] of pipelinesMap) {
    // Upsert pipeline
    const { data: pipeline, error: pipelineError } = await supabase
      .from('crm_pipelines')
      .upsert({
        rd_station_id: pipelineRdId,
        name: pipelineData.name,
        is_default: pipelinesMap.size === 1
      }, { onConflict: 'rd_station_id' })
      .select()
      .single();

    if (pipelineError) {
      console.error('Error upserting pipeline:', pipelineError);
      continue;
    }
    pipelinesCreated++;

    // Upsert stages for this pipeline
    for (const stage of pipelineData.stages) {
      const { error: stageError } = await supabase
        .from('crm_deal_stages')
        .upsert({
          rd_station_id: stage.rd_station_id,
          pipeline_id: pipeline.id,
          name: stage.name,
          order_index: stage.order_index,
          is_won: stage.is_won,
          is_lost: stage.is_lost
        }, { onConflict: 'rd_station_id' });

      if (stageError) {
        console.error('Error upserting stage:', stageError);
      } else {
        stagesCreated++;
      }
    }
  }

  // Log sync
  await supabase.from('crm_sync_log').insert({
    sync_type: 'manual',
    entity_type: 'pipeline',
    status: 'success'
  });

  return { pipelines: pipelinesCreated, stages: stagesCreated };
}

async function syncContacts(rdToken: string, supabase: any) {
  console.log('Syncing contacts from RD Station...');
  
  let allContacts: any[] = [];
  let page = 1;
  const limit = 200;
  
  // Paginate through all contacts
  while (true) {
    const response = await fetch(
      `${RD_STATION_API_URL}/contacts?token=${rdToken}&page=${page}&limit=${limit}`
    );
    
    if (!response.ok) {
      throw new Error(`Erro ao buscar contatos: ${response.status}`);
    }

    const data = await response.json();
    const contacts = data.contacts || [];
    
    if (contacts.length === 0) break;
    
    allContacts = [...allContacts, ...contacts];
    console.log(`Fetched page ${page}, total contacts: ${allContacts.length}`);
    
    if (contacts.length < limit) break;
    page++;
    
    // Safety limit
    if (page > 50) break;
  }

  console.log(`Total contacts to sync: ${allContacts.length}`);

  let contactsCreated = 0;

  for (const contact of allContacts) {
    const contactData = {
      rd_station_id: contact._id,
      name: contact.name || contact.emails?.[0]?.email || 'Sem nome',
      email: contact.emails?.[0]?.email || null,
      phone: contact.phones?.[0]?.phone || null,
      company: contact.organization?.name || null,
      job_title: contact.title || null,
      address: contact.address?.street || null,
      city: contact.address?.city || null,
      state: contact.address?.state || null,
      country: contact.address?.country || null,
      website: contact.website || null,
      linkedin: contact.linkedin || null,
      facebook: contact.facebook || null,
      twitter: contact.twitter || null,
      birthday: contact.birthday || null,
      notes: contact.notes || null,
      custom_fields: contact.custom_fields || {},
      lead_score: contact.score || 0
    };

    const { error } = await supabase
      .from('crm_contacts')
      .upsert(contactData, { onConflict: 'rd_station_id' });

    if (error) {
      console.error('Error upserting contact:', error);
    } else {
      contactsCreated++;
    }
  }

  // Log sync
  await supabase.from('crm_sync_log').insert({
    sync_type: 'manual',
    entity_type: 'contact',
    status: 'success'
  });

  return { contacts: contactsCreated };
}

async function syncDeals(rdToken: string, supabase: any) {
  console.log('Syncing deals from RD Station...');
  
  let allDeals: any[] = [];
  let page = 1;
  const limit = 200;
  
  // Paginate through all deals
  while (true) {
    const response = await fetch(
      `${RD_STATION_API_URL}/deals?token=${rdToken}&page=${page}&limit=${limit}`
    );
    
    if (!response.ok) {
      throw new Error(`Erro ao buscar deals: ${response.status}`);
    }

    const data = await response.json();
    const deals = data.deals || [];
    
    if (deals.length === 0) break;
    
    allDeals = [...allDeals, ...deals];
    console.log(`Fetched page ${page}, total deals: ${allDeals.length}`);
    
    if (deals.length < limit) break;
    page++;
    
    // Safety limit
    if (page > 50) break;
  }

  console.log(`Total deals to sync: ${allDeals.length}`);

  // Get stage mappings
  const { data: stages } = await supabase
    .from('crm_deal_stages')
    .select('id, rd_station_id, pipeline_id');
  
  const stageMap = new Map<string, { id: string; pipeline_id: string; rd_station_id: string }>(
    stages?.map((s: any) => [s.rd_station_id, s]) || []
  );

  // Get contact mappings
  const { data: contacts } = await supabase
    .from('crm_contacts')
    .select('id, rd_station_id');
  
  const contactMap = new Map(contacts?.map((c: any) => [c.rd_station_id, c.id]) || []);

  let dealsCreated = 0;

  for (const deal of allDeals) {
    const stageInfo = stageMap.get(deal.deal_stage?._id);
    const contactId = deal.contacts?.[0]?._id ? contactMap.get(deal.contacts[0]._id) : null;

    const dealData = {
      rd_station_id: deal._id,
      contact_id: contactId,
      pipeline_id: stageInfo?.pipeline_id || null,
      stage_id: stageInfo?.id || null,
      name: deal.name || 'Deal sem nome',
      value: deal.amount_total || 0,
      expected_close_date: deal.prediction_date || null,
      closed_at: deal.closed_at || null,
      won: deal.win,
      loss_reason: deal.loss_reason || null,
      product_name: deal.deal_products?.[0]?.name || null,
      campaign_name: deal.campaign?.name || null,
      notes: deal.notes || null,
      custom_fields: deal.custom_fields || {}
    };

    const { error } = await supabase
      .from('crm_deals')
      .upsert(dealData, { onConflict: 'rd_station_id' });

    if (error) {
      console.error('Error upserting deal:', error);
    } else {
      dealsCreated++;
    }
  }

  // Log sync
  await supabase.from('crm_sync_log').insert({
    sync_type: 'manual',
    entity_type: 'deal',
    status: 'success'
  });

  return { deals: dealsCreated };
}
