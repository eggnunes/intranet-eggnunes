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
      case 'sync_activities':
        result = await syncActivities(rdToken, supabase);
        break;
      case 'full_sync':
        const pipelinesResult = await syncPipelines(rdToken, supabase);
        const contactsResult = await syncContacts(rdToken, supabase);
        const dealsResult = await syncDeals(rdToken, supabase);
        const activitiesResult = await syncActivities(rdToken, supabase);
        
        // Update last sync timestamp
        await supabase
          .from('crm_settings')
          .update({ last_full_sync_at: new Date().toISOString() })
          .eq('id', (await supabase.from('crm_settings').select('id').single()).data?.id);
        
        result = {
          pipelines: pipelinesResult,
          contacts: contactsResult,
          deals: dealsResult,
          activities: activitiesResult
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
  
  // Paginate through ALL contacts without limit
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
    
    // Safety limit to prevent infinite loops
    if (page > 100) break;
  }

  console.log(`Total contacts to sync: ${allContacts.length}`);

  // Transform contacts data - including ALL UTM and tracking fields
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
    lead_score: contact.score || 0,
    // UTM tracking fields - from RD Station contact data
    utm_source: contact.traffic_source || contact.utm_source || contact.custom_fields?.utm_source || null,
    utm_medium: contact.traffic_medium || contact.utm_medium || contact.custom_fields?.utm_medium || null,
    utm_campaign: contact.traffic_campaign || contact.utm_campaign || contact.custom_fields?.utm_campaign || null,
    utm_content: contact.utm_content || contact.custom_fields?.utm_content || null,
    utm_term: contact.utm_term || contact.custom_fields?.utm_term || null,
    // Conversion tracking
    first_conversion: contact.first_conversion?.content || contact.first_conversion_date || null,
    last_conversion: contact.last_conversion?.content || contact.last_conversion_date || null
  }));

  // Batch upsert in chunks of 500 for faster processing
  const BATCH_SIZE = 500;
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
  
  // Paginate through ALL deals without limit
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
    
    // Safety limit to prevent infinite loops
    if (page > 100) break;
  }

  console.log(`Total deals to sync: ${allDeals.length}`);

  // Get stage mappings
  const { data: stages } = await supabase
    .from('crm_deal_stages')
    .select('id, rd_station_id, pipeline_id');
  
  const stageMap = new Map<string, { id: string; pipeline_id: string; rd_station_id: string }>(
    stages?.map((s: any) => [s.rd_station_id, s]) || []
  );

  // Get contact mappings - fetch all without limit
  let allContacts: any[] = [];
  let contactPage = 0;
  const contactLimit = 1000;
  
  while (true) {
    const { data: contactsBatch } = await supabase
      .from('crm_contacts')
      .select('id, rd_station_id')
      .range(contactPage * contactLimit, (contactPage + 1) * contactLimit - 1);
    
    if (!contactsBatch || contactsBatch.length === 0) break;
    allContacts = [...allContacts, ...contactsBatch];
    if (contactsBatch.length < contactLimit) break;
    contactPage++;
  }
  
  const contactMap = new Map(allContacts.map((c: any) => [c.rd_station_id, c.id]));

  // Get user/owner mappings from profiles
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, email');
  
  // Create email to profile ID map for owner matching
  const emailToProfileMap = new Map<string, string>(
    profiles?.map((p: any) => [p.email?.toLowerCase(), p.id]) || []
  );

  // Transform deals data - including owner_id
  const dealsData = allDeals.map(deal => {
    const stageInfo = stageMap.get(deal.deal_stage?._id);
    const contactId = deal.contacts?.[0]?._id ? contactMap.get(deal.contacts[0]._id) : null;
    
    // Try to match owner by email
    let ownerId = null;
    if (deal.user?.email) {
      ownerId = emailToProfileMap.get(deal.user.email.toLowerCase()) || null;
    }

    return {
      rd_station_id: deal._id,
      contact_id: contactId || null,
      pipeline_id: stageInfo?.pipeline_id || null,
      stage_id: stageInfo?.id || null,
      owner_id: ownerId,
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

  // Batch upsert in chunks of 500 for faster processing
  const BATCH_SIZE = 500;
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

// Sync activities/tasks from RD Station
async function syncActivities(rdToken: string, supabase: any) {
  console.log('Syncing activities from RD Station...');
  
  let allActivities: any[] = [];
  let page = 1;
  const limit = 200;
  
  // Try both activities and tasks endpoints
  const endpoints = ['activities', 'tasks'];
  
  for (const endpoint of endpoints) {
    page = 1;
    console.log(`Trying endpoint: /${endpoint}`);
    
    while (true) {
      try {
        const response = await fetch(
          `${RD_STATION_API_URL}/${endpoint}?token=${rdToken}&page=${page}&limit=${limit}`
        );
        
        if (!response.ok) {
          console.log(`${endpoint} fetch returned ${response.status}`);
          break;
        }

        const data = await response.json();
        const items = data[endpoint] || data.tasks || data.activities || [];
        
        if (items.length === 0) break;
        
        allActivities = [...allActivities, ...items];
        console.log(`Fetched ${endpoint} page ${page}, total: ${allActivities.length}`);
        
        if (items.length < limit) break;
        page++;
        
        if (page > 50) break;
      } catch (error) {
        console.error(`Error fetching ${endpoint}:`, error);
        break;
      }
    }
    
    if (allActivities.length > 0) break;
  }

  // Also fetch activities from each deal
  console.log('Fetching deal activities...');
  const { data: deals } = await supabase
    .from('crm_deals')
    .select('rd_station_id');
  
  if (deals && deals.length > 0) {
    for (const deal of deals.slice(0, 100)) { // Limit to first 100 deals
      try {
        const response = await fetch(
          `${RD_STATION_API_URL}/deals/${deal.rd_station_id}/activities?token=${rdToken}&limit=50`
        );
        
        if (response.ok) {
          const data = await response.json();
          const dealActivities = data.activities || [];
          if (dealActivities.length > 0) {
            // Add deal reference
            dealActivities.forEach((a: any) => {
              a._deal_rd_id = deal.rd_station_id;
            });
            allActivities = [...allActivities, ...dealActivities];
          }
        }
      } catch (error) {
        // Continue with other deals
      }
    }
  }

  console.log(`Total activities to sync: ${allActivities.length}`);

  if (allActivities.length === 0) {
    return { activities: 0 };
  }

  // Get deal and contact mappings - fetch all
  let allDeals: any[] = [];
  let dealPage = 0;
  while (true) {
    const { data: dealsBatch } = await supabase
      .from('crm_deals')
      .select('id, rd_station_id')
      .range(dealPage * 1000, (dealPage + 1) * 1000 - 1);
    if (!dealsBatch || dealsBatch.length === 0) break;
    allDeals = [...allDeals, ...dealsBatch];
    if (dealsBatch.length < 1000) break;
    dealPage++;
  }
  const dealMap = new Map(allDeals.map((d: any) => [d.rd_station_id, d.id]));

  let allContacts: any[] = [];
  let contactPage = 0;
  while (true) {
    const { data: contactsBatch } = await supabase
      .from('crm_contacts')
      .select('id, rd_station_id')
      .range(contactPage * 1000, (contactPage + 1) * 1000 - 1);
    if (!contactsBatch || contactsBatch.length === 0) break;
    allContacts = [...allContacts, ...contactsBatch];
    if (contactsBatch.length < 1000) break;
    contactPage++;
  }
  const contactMap = new Map(allContacts.map((c: any) => [c.rd_station_id, c.id]));

  // Get user mappings
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, email');
  const emailToProfileMap = new Map(
    profiles?.map((p: any) => [p.email?.toLowerCase(), p.id]) || []
  );

  // Transform activities - dedupe by _id
  const seenIds = new Set<string>();
  const activitiesData = allActivities
    .filter(activity => {
      if (!activity._id || seenIds.has(activity._id)) return false;
      seenIds.add(activity._id);
      return true;
    })
    .map(activity => {
      // Get deal ID from activity or from _deal_rd_id
      let dealId = null;
      if (activity.deal?._id) {
        dealId = dealMap.get(activity.deal._id);
      } else if (activity._deal_rd_id) {
        dealId = dealMap.get(activity._deal_rd_id);
      }
      
      const contactId = activity.contact?._id ? contactMap.get(activity.contact._id) : null;
      
      let ownerId = null;
      if (activity.user?.email) {
        ownerId = emailToProfileMap.get(activity.user.email.toLowerCase()) || null;
      }
      let createdBy = null;
      if (activity.created_by?.email) {
        createdBy = emailToProfileMap.get(activity.created_by.email.toLowerCase()) || null;
      }

      // Map RD Station activity types
      let type = 'task';
      const activityType = activity.type?.toString() || '';
      const subject = (activity.subject || activity.name || activity.title || '').toLowerCase();
      
      // RD Station types: 0=note, 1=call, 2=email, 3=meeting
      if (activityType === '0' || activityType === 'note') type = 'note';
      else if (activityType === '1' || activityType === 'call' || subject.includes('ligação') || subject.includes('call')) type = 'call';
      else if (activityType === '2' || activityType === 'email' || subject.includes('email') || subject.includes('e-mail')) type = 'email';
      else if (activityType === '3' || activityType === 'meeting' || subject.includes('reunião') || subject.includes('meeting')) type = 'meeting';
      else if (subject.includes('whatsapp')) type = 'whatsapp';

      return {
        rd_station_id: activity._id,
        deal_id: dealId,
        contact_id: contactId,
        owner_id: ownerId,
        created_by: createdBy,
        type: type,
        title: activity.subject || activity.name || activity.title || 'Atividade',
        description: activity.text || activity.notes || activity.description || null,
        due_date: activity.date || activity.due_date || null,
        completed: activity.done || activity.completed || false,
        completed_at: activity.done_at || activity.completed_at || null,
        created_at: activity.created_at || new Date().toISOString()
      };
    });

  console.log(`Filtered unique activities: ${activitiesData.length}`);

  // Batch upsert
  const BATCH_SIZE = 500;
  let activitiesCreated = 0;

  for (let i = 0; i < activitiesData.length; i += BATCH_SIZE) {
    const batch = activitiesData.slice(i, i + BATCH_SIZE);
    const { error } = await supabase
      .from('crm_activities')
      .upsert(batch, { onConflict: 'rd_station_id' });

    if (error) {
      console.error('Error upserting activities batch:', error);
    } else {
      activitiesCreated += batch.length;
      console.log(`Upserted activities batch, total: ${activitiesCreated}`);
    }
  }

  // Log sync
  await supabase.from('crm_sync_log').insert({
    sync_type: 'manual',
    entity_type: 'activity',
    status: 'success'
  });

  return { activities: activitiesCreated };
}
