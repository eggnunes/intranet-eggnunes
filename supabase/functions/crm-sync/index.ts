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
    const { action, data } = await req.json();

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
      
      // Bidirectional sync actions - Update RD Station when local changes happen
      case 'update_deal':
        result = await updateDealInRdStation(rdToken, supabase, data);
        break;
      case 'update_deal_stage':
        result = await updateDealStageInRdStation(rdToken, supabase, data);
        break;
      case 'update_contact':
        result = await updateContactInRdStation(rdToken, supabase, data);
        break;
      case 'create_activity':
        result = await createActivityInRdStation(rdToken, supabase, data);
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

// ==================== Bidirectional Sync Functions ====================

async function updateDealInRdStation(rdToken: string, supabase: any, data: any) {
  const { deal_id, updates } = data;
  
  // Get the local deal with RD Station ID
  const { data: deal, error: dealError } = await supabase
    .from('crm_deals')
    .select('rd_station_id, name, value, notes')
    .eq('id', deal_id)
    .single();
  
  if (dealError || !deal?.rd_station_id) {
    throw new Error('Deal não encontrado ou não sincronizado com RD Station');
  }

  // Update in RD Station
  const rdUpdates: any = {};
  if (updates.name !== undefined) rdUpdates.name = updates.name;
  if (updates.value !== undefined) rdUpdates.amount_total = updates.value;
  if (updates.notes !== undefined) rdUpdates.notes = updates.notes;
  if (updates.expected_close_date !== undefined) rdUpdates.prediction_date = updates.expected_close_date;

  const response = await fetch(
    `${RD_STATION_API_URL}/deals/${deal.rd_station_id}?token=${rdToken}`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(rdUpdates)
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error('RD Station update error:', errorText);
    throw new Error(`Erro ao atualizar deal no RD Station: ${response.status}`);
  }

  // Update locally
  await supabase
    .from('crm_deals')
    .update(updates)
    .eq('id', deal_id);

  // Log sync
  await supabase.from('crm_sync_log').insert({
    sync_type: 'bidirectional',
    entity_type: 'deal',
    entity_id: deal_id,
    status: 'success'
  });

  return { updated: true, rd_station_id: deal.rd_station_id };
}

async function updateDealStageInRdStation(rdToken: string, supabase: any, data: any) {
  const { deal_id, stage_id, user_id } = data;
  
  // Get the local deal and stage with RD Station IDs
  const { data: deal, error: dealError } = await supabase
    .from('crm_deals')
    .select('rd_station_id, stage_id')
    .eq('id', deal_id)
    .single();
  
  if (dealError || !deal?.rd_station_id) {
    throw new Error('Deal não encontrado ou não sincronizado com RD Station');
  }

  const { data: stage, error: stageError } = await supabase
    .from('crm_deal_stages')
    .select('rd_station_id, name, is_won, is_lost')
    .eq('id', stage_id)
    .single();

  if (stageError || !stage?.rd_station_id) {
    throw new Error('Etapa não encontrada ou não sincronizada com RD Station');
  }

  // Update stage in RD Station
  const response = await fetch(
    `${RD_STATION_API_URL}/deals/${deal.rd_station_id}?token=${rdToken}`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deal_stage_id: stage.rd_station_id
      })
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error('RD Station stage update error:', errorText);
    throw new Error(`Erro ao atualizar etapa no RD Station: ${response.status}`);
  }

  const previousStageId = deal.stage_id;

  // Update locally
  const updateData: any = { stage_id };
  if (stage.is_won) {
    updateData.won = true;
    updateData.closed_at = new Date().toISOString();
  } else if (stage.is_lost) {
    updateData.won = false;
    updateData.closed_at = new Date().toISOString();
  }

  await supabase
    .from('crm_deals')
    .update(updateData)
    .eq('id', deal_id);

  // Record history
  await supabase.from('crm_deal_history').insert({
    deal_id,
    from_stage_id: previousStageId,
    to_stage_id: stage_id,
    changed_by: user_id
  });

  // Log sync
  await supabase.from('crm_sync_log').insert({
    sync_type: 'bidirectional',
    entity_type: 'deal_stage',
    entity_id: deal_id,
    status: 'success'
  });

  return { updated: true, stage_name: stage.name };
}

async function updateContactInRdStation(rdToken: string, supabase: any, data: any) {
  const { contact_id, updates } = data;
  
  // Get the local contact with RD Station ID
  const { data: contact, error: contactError } = await supabase
    .from('crm_contacts')
    .select('rd_station_id')
    .eq('id', contact_id)
    .single();
  
  if (contactError || !contact?.rd_station_id) {
    throw new Error('Contato não encontrado ou não sincronizado com RD Station');
  }

  // Map local fields to RD Station fields
  const rdUpdates: any = {};
  if (updates.name !== undefined) rdUpdates.name = updates.name;
  if (updates.email !== undefined) rdUpdates.emails = [{ email: updates.email }];
  if (updates.phone !== undefined) rdUpdates.phones = [{ phone: updates.phone }];
  if (updates.company !== undefined) rdUpdates.organization = { name: updates.company };
  if (updates.job_title !== undefined) rdUpdates.title = updates.job_title;
  if (updates.notes !== undefined) rdUpdates.notes = updates.notes;
  if (updates.linkedin !== undefined) rdUpdates.linkedin = updates.linkedin;
  if (updates.facebook !== undefined) rdUpdates.facebook = updates.facebook;
  if (updates.twitter !== undefined) rdUpdates.twitter = updates.twitter;
  if (updates.website !== undefined) rdUpdates.website = updates.website;

  const response = await fetch(
    `${RD_STATION_API_URL}/contacts/${contact.rd_station_id}?token=${rdToken}`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(rdUpdates)
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error('RD Station contact update error:', errorText);
    throw new Error(`Erro ao atualizar contato no RD Station: ${response.status}`);
  }

  // Update locally
  await supabase
    .from('crm_contacts')
    .update(updates)
    .eq('id', contact_id);

  // Log sync
  await supabase.from('crm_sync_log').insert({
    sync_type: 'bidirectional',
    entity_type: 'contact',
    entity_id: contact_id,
    status: 'success'
  });

  return { updated: true, rd_station_id: contact.rd_station_id };
}

async function createActivityInRdStation(rdToken: string, supabase: any, data: any) {
  const { deal_id, contact_id, activity } = data;
  
  // Get RD Station IDs
  let rdDealId = null;
  let rdContactId = null;

  if (deal_id) {
    const { data: deal } = await supabase
      .from('crm_deals')
      .select('rd_station_id')
      .eq('id', deal_id)
      .single();
    rdDealId = deal?.rd_station_id;
  }

  if (contact_id) {
    const { data: contact } = await supabase
      .from('crm_contacts')
      .select('rd_station_id')
      .eq('id', contact_id)
      .single();
    rdContactId = contact?.rd_station_id;
  }

  // Create activity/task in RD Station
  const rdActivity: any = {
    subject: activity.title,
    type: mapActivityType(activity.type),
    date: activity.due_date || new Date().toISOString()
  };

  if (rdDealId) rdActivity.deal_id = rdDealId;
  if (rdContactId) rdActivity.contact_id = rdContactId;
  if (activity.description) rdActivity.text = activity.description;

  const response = await fetch(
    `${RD_STATION_API_URL}/activities?token=${rdToken}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(rdActivity)
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error('RD Station activity create error:', errorText);
    throw new Error(`Erro ao criar atividade no RD Station: ${response.status}`);
  }

  const rdActivityResponse = await response.json();

  // Create locally
  const { data: localActivity, error: activityError } = await supabase
    .from('crm_activities')
    .insert({
      ...activity,
      deal_id,
      contact_id,
      rd_station_id: rdActivityResponse._id
    })
    .select()
    .single();

  if (activityError) {
    console.error('Error creating local activity:', activityError);
  }

  // Log sync
  await supabase.from('crm_sync_log').insert({
    sync_type: 'bidirectional',
    entity_type: 'activity',
    entity_id: localActivity?.id,
    status: 'success'
  });

  return { created: true, activity_id: localActivity?.id, rd_station_id: rdActivityResponse._id };
}

function mapActivityType(type: string): number {
  // RD Station activity types: 0 = note, 1 = call, 2 = email, 3 = meeting, 4 = task
  const typeMap: { [key: string]: number } = {
    'note': 0,
    'call': 1,
    'email': 2,
    'meeting': 3,
    'task': 4
  };
  return typeMap[type] || 4;
}

// ==================== Import Functions ====================

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
  
  // Paginate through all contacts (max 5 pages to avoid timeout)
  while (page <= 5) {
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
  }

  console.log(`Total contacts to sync: ${allContacts.length}`);

  // Transform contacts data
  const contactsData = allContacts.map(contact => ({
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
  }));

  // Batch upsert in chunks of 200
  const BATCH_SIZE = 200;
  let contactsCreated = 0;

  for (let i = 0; i < contactsData.length; i += BATCH_SIZE) {
    const batch = contactsData.slice(i, i + BATCH_SIZE);
    const { error } = await supabase
      .from('crm_contacts')
      .upsert(batch, { onConflict: 'rd_station_id' });

    if (error) {
      console.error('Error upserting contacts batch:', error);
    } else {
      contactsCreated += batch.length;
      console.log(`Upserted batch ${Math.floor(i / BATCH_SIZE) + 1}, total: ${contactsCreated}`);
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
  
  // Paginate through all deals (max 5 pages to avoid timeout)
  while (page <= 5) {
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

  // Transform deals data
  const dealsData = allDeals.map(deal => {
    const stageInfo = stageMap.get(deal.deal_stage?._id);
    const contactId = deal.contacts?.[0]?._id ? contactMap.get(deal.contacts[0]._id) : null;

    return {
      rd_station_id: deal._id,
      contact_id: contactId || null,
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
  });

  // Batch upsert in chunks of 200
  const BATCH_SIZE = 200;
  let dealsCreated = 0;

  for (let i = 0; i < dealsData.length; i += BATCH_SIZE) {
    const batch = dealsData.slice(i, i + BATCH_SIZE);
    const { error } = await supabase
      .from('crm_deals')
      .upsert(batch, { onConflict: 'rd_station_id' });

    if (error) {
      console.error('Error upserting deals batch:', error);
    } else {
      dealsCreated += batch.length;
      console.log(`Upserted deals batch ${Math.floor(i / BATCH_SIZE) + 1}, total: ${dealsCreated}`);
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
