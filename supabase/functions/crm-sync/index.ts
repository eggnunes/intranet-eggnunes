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
        // Get settings ID once upfront
        const { data: settingsRow } = await supabase.from('crm_settings').select('id').single();
        const settingsId = settingsRow?.id;

        const pipelinesResult = await syncPipelines(rdToken, supabase);
        const contactsResult = await syncContacts(rdToken, supabase);
        const dealsResult = await syncDeals(rdToken, supabase);
        
        // Update last sync timestamp BEFORE activities (which can timeout)
        if (settingsId) {
          await supabase
            .from('crm_settings')
            .update({ last_full_sync_at: new Date().toISOString() })
            .eq('id', settingsId);
        }

        const activitiesResult = await syncActivities(rdToken, supabase);
        
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
      case 'fetch_contact_activities':
        result = await fetchContactActivitiesFromRdStation(rdToken, supabase, data);
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

  // Transform contacts data - including ALL UTM and tracking fields + original created_at
  const contactsData = allContacts.map(contact => {
    // Log FULL contact data for debugging (first 3 contacts only)
    if (allContacts.indexOf(contact) < 3) {
      console.log('=== FULL RAW CONTACT DATA ===');
      console.log('Contact keys:', Object.keys(contact));
      console.log('Full contact:', JSON.stringify(contact, null, 2));
    }

    // Extract UTM and tracking data from multiple possible locations
    // RD Station can store this data in different places depending on how the lead was created
    const customFields = contact.custom_fields || {};
    
    // Traffic source (Fonte) - e.g., "Busca Paga | Facebook"
    const trafficSource = contact.traffic_source || 
                         contact.lead_source || 
                         contact.source ||
                         customFields.traffic_source ||
                         customFields.fonte ||
                         null;
    
    // Traffic medium
    const trafficMedium = contact.traffic_medium ||
                         customFields.traffic_medium ||
                         null;
    
    // Campaign name (Campanha) - e.g., "Leads Férias Prêmio"
    const trafficCampaign = contact.traffic_campaign ||
                           contact.campaign?.name ||
                           customFields.traffic_campaign ||
                           customFields.campanha ||
                           null;

    // UTM parameters - check multiple locations
    const utmSource = contact.utm_source || 
                     customFields.utm_source || 
                     customFields.cf_utm_source ||
                     customFields['UTM Source'] ||
                     customFields['utm source'] ||
                     (trafficSource?.toLowerCase()?.includes('facebook') ? 'facebook' : null) ||
                     null;
    
    const utmMedium = contact.utm_medium || 
                     customFields.utm_medium || 
                     customFields.cf_utm_medium ||
                     customFields['UTM Medium'] ||
                     customFields['utm medium'] ||
                     trafficMedium ||
                     null;
    
    const utmCampaign = contact.utm_campaign || 
                       customFields.utm_campaign || 
                       customFields.cf_utm_campaign ||
                       customFields['UTM Campaign'] ||
                       customFields['utm campaign'] ||
                       null;
    
    const utmContent = contact.utm_content || 
                      customFields.utm_content || 
                      customFields.cf_utm_content ||
                      customFields['UTM Content'] ||
                      customFields['utm content'] ||
                      null;
    
    const utmTerm = contact.utm_term || 
                   customFields.utm_term || 
                   customFields.cf_utm_term ||
                   customFields['UTM Term'] ||
                   customFields['utm term'] ||
                   null;

    return {
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
      custom_fields: {
        ...customFields,
        // Also store the raw traffic fields for reference
        _traffic_source: trafficSource,
        _traffic_medium: trafficMedium,
        _traffic_campaign: trafficCampaign
      },
      lead_score: contact.score || 0,
      // Traffic source fields (Fonte, Campanha from RD Station)
      traffic_source: trafficSource,
      traffic_medium: trafficMedium,
      traffic_campaign: trafficCampaign,
      // UTM tracking fields
      utm_source: utmSource,
      utm_medium: utmMedium,
      utm_campaign: utmCampaign,
      utm_content: utmContent,
      utm_term: utmTerm,
      // Conversion tracking
      first_conversion: contact.first_conversion?.content || contact.first_conversion?.identifier || contact.first_conversion_date || null,
      last_conversion: contact.last_conversion?.content || contact.last_conversion?.identifier || contact.last_conversion_date || null,
      // Use original created_at from RD Station if available
      created_at: contact.created_at || new Date().toISOString()
    };
  });

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
      .select('id, rd_station_id, name, email')
      .range(contactPage * contactLimit, (contactPage + 1) * contactLimit - 1);
    
    if (!contactsBatch || contactsBatch.length === 0) break;
    allContacts = [...allContacts, ...contactsBatch];
    if (contactsBatch.length < contactLimit) break;
    contactPage++;
  }
  
  // Create multiple maps for contact lookup
  const contactMapById = new Map(allContacts.map((c: any) => [c.rd_station_id, c.id]));
  const contactMapByName = new Map(allContacts.map((c: any) => [c.name?.toLowerCase()?.trim(), c.id]));
  const contactMapByEmail = new Map(allContacts.filter((c: any) => c.email).map((c: any) => [c.email?.toLowerCase()?.trim(), c.id]));

  // Get user/owner mappings from profiles
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, email');
  
  // Create email to profile ID map for owner matching
  const emailToProfileMap = new Map<string, string>(
    profiles?.map((p: any) => [p.email?.toLowerCase(), p.id]) || []
  );

  // Transform deals data - including owner_id and contact_id with multiple lookup strategies
  const dealsData = allDeals.map(deal => {
    const stageInfo = stageMap.get(deal.deal_stage?._id);
    
    // Try multiple strategies to find contact_id
    let contactId = null;
    
    // 1. Try by contact._id from deal
    if (deal.contacts?.[0]?._id) {
      contactId = contactMapById.get(deal.contacts[0]._id);
    }
    
    // 2. Try by deal name (deals often have same name as contact)
    if (!contactId && deal.name) {
      contactId = contactMapByName.get(deal.name?.toLowerCase()?.trim());
    }
    
    // 3. Try by contact email
    if (!contactId && deal.contacts?.[0]?.emails?.[0]?.email) {
      contactId = contactMapByEmail.get(deal.contacts[0].emails[0].email?.toLowerCase()?.trim());
    }
    
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
      won: deal.win === true || deal.win === 'won' || deal.win === 1,
      loss_reason: deal.loss_reason || null,
      product_name: deal.deal_products?.[0]?.name || null,
      campaign_name: deal.campaign?.name || null,
      notes: deal.notes || null,
      custom_fields: deal.custom_fields || {},
      // Use original created_at from RD Station
      created_at: deal.created_at || new Date().toISOString()
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
  
  // Only fetch activities for recent deals (last 90 days) - use created_at and closed_at
  // NOTE: updated_at is unreliable because upsert refreshes it for ALL deals
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
  const cutoffDate = ninetyDaysAgo.toISOString();
  const MAX_DEALS_FOR_ACTIVITIES = 200;
  
  const { data: recentDeals } = await supabase
    .from('crm_deals')
    .select('id, rd_station_id, name, contact_id')
    .or(`created_at.gte.${cutoffDate},closed_at.gte.${cutoffDate}`)
    .order('created_at', { ascending: false })
    .limit(MAX_DEALS_FOR_ACTIVITIES);
  
  const allDeals = recentDeals || [];
  console.log(`Found ${allDeals.length} recent deals (max ${MAX_DEALS_FOR_ACTIVITIES}) to fetch activities from`);

  // Create maps for lookups
  const dealMapByRdId = new Map(allDeals.map((d: any) => [d.rd_station_id, { id: d.id, contact_id: d.contact_id, name: d.name }]));
  const dealMapByName = new Map(allDeals.map((d: any) => [d.name?.toLowerCase()?.trim(), { id: d.id, contact_id: d.contact_id }]));
  
  // Get contacts
  let allContacts: any[] = [];
  let contactPage = 0;
  while (true) {
    const { data: contactsBatch } = await supabase
      .from('crm_contacts')
      .select('id, rd_station_id, name, email')
      .range(contactPage * 1000, (contactPage + 1) * 1000 - 1);
    if (!contactsBatch || contactsBatch.length === 0) break;
    allContacts = [...allContacts, ...contactsBatch];
    if (contactsBatch.length < 1000) break;
    contactPage++;
  }
  const contactMapByRdId = new Map(allContacts.map((c: any) => [c.rd_station_id, c.id]));
  const contactMapByName = new Map(allContacts.map((c: any) => [c.name?.toLowerCase()?.trim(), c.id]));

  // Get user mappings
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, email');
  const emailToProfileMap = new Map(
    profiles?.map((p: any) => [p.email?.toLowerCase(), p.id]) || []
  );

  let allActivities: any[] = [];
  
  // Fetch activities from each recent deal with delay to avoid rate limiting
  console.log('Fetching activities from recent deals...');
  let processedDeals = 0;
  for (const deal of allDeals) {
    if (!deal.rd_station_id) continue;
    
    try {
      const response = await fetch(
        `${RD_STATION_API_URL}/deals/${deal.rd_station_id}/activities?token=${rdToken}&limit=100`
      );
      
      if (response.ok) {
        const data = await response.json();
        const dealActivities = data.activities || [];
        if (dealActivities.length > 0) {
          dealActivities.forEach((a: any) => {
            a._mapped_deal_id = deal.id;
            a._mapped_contact_id = deal.contact_id;
            a._deal_rd_id = deal.rd_station_id;
          });
          allActivities = [...allActivities, ...dealActivities];
        }
      }
    } catch (error) {
      // Continue with other deals
    }
    
    processedDeals++;
    if (processedDeals % 50 === 0) {
      console.log(`Processed ${processedDeals}/${allDeals.length} deals, found ${allActivities.length} activities`);
    }
    
    // Add delay to avoid rate limiting (100ms × 200 deals = ~20s max)
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  // Also try the general activities endpoint
  console.log('Also fetching from general activities endpoint...');
  let page = 1;
  const limit = 200;
  
  while (page <= 20) {
    try {
      const response = await fetch(
        `${RD_STATION_API_URL}/activities?token=${rdToken}&page=${page}&limit=${limit}`
      );
      
      if (!response.ok) break;

      const data = await response.json();
      const items = data.activities || [];
      
      if (items.length === 0) break;
      
      allActivities = [...allActivities, ...items];
      console.log(`Fetched activities page ${page}, total: ${allActivities.length}`);
      
      if (items.length < limit) break;
      page++;
    } catch (error) {
      break;
    }
  }

  console.log(`Total activities to sync: ${allActivities.length}`);

  if (allActivities.length === 0) {
    return { activities: 0 };
  }

  // Transform and dedupe activities
  const seenIds = new Set<string>();
  const activitiesData = allActivities
    .filter(activity => {
      if (!activity._id || seenIds.has(activity._id)) return false;
      seenIds.add(activity._id);
      return true;
    })
    .map(activity => {
      // Use pre-mapped IDs if available (from deal-specific fetch)
      let dealId = activity._mapped_deal_id || null;
      let contactId = activity._mapped_contact_id || null;
      
      // If not pre-mapped, try to find by rd_station_id
      if (!dealId && activity.deal?._id) {
        const dealInfo = dealMapByRdId.get(activity.deal._id);
        if (dealInfo) {
          dealId = dealInfo.id;
          contactId = dealInfo.contact_id;
        }
      }
      
      if (!dealId && activity._deal_rd_id) {
        const dealInfo = dealMapByRdId.get(activity._deal_rd_id);
        if (dealInfo) {
          dealId = dealInfo.id;
          contactId = dealInfo.contact_id;
        }
      }
      
      // Try by deal name
      if (!dealId && activity.deal?.name) {
        const dealInfo = dealMapByName.get(activity.deal.name?.toLowerCase()?.trim());
        if (dealInfo) {
          dealId = dealInfo.id;
          contactId = dealInfo.contact_id;
        }
      }
      
      // Try contact directly
      if (!contactId && activity.contact?._id) {
        contactId = contactMapByRdId.get(activity.contact._id);
      }
      
      if (!contactId && activity.contact?.name) {
        contactId = contactMapByName.get(activity.contact.name?.toLowerCase()?.trim());
      }
      
      let ownerId = null;
      if (activity.user?.email) {
        ownerId = emailToProfileMap.get(activity.user.email.toLowerCase()) || null;
      }
      let createdBy = null;
      if (activity.created_by?.email) {
        createdBy = emailToProfileMap.get(activity.created_by.email.toLowerCase()) || null;
      }

      // Map activity type
      let type = 'task';
      const activityType = activity.type?.toString() || '';
      const subject = (activity.subject || activity.name || activity.title || '').toLowerCase();
      
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
  
  // Count how many have mappings
  const withDeal = activitiesData.filter(a => a.deal_id).length;
  const withContact = activitiesData.filter(a => a.contact_id).length;
  console.log(`Activities with deal_id: ${withDeal}, with contact_id: ${withContact}`);

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

  return { activities: activitiesCreated, with_deal: withDeal, with_contact: withContact };
}

// Fetch activities from RD Station for a specific contact/deal in real-time
async function fetchContactActivitiesFromRdStation(rdToken: string, supabase: any, data: any) {
  console.log('Fetching activities for contact from RD Station...', data);
  
  const { contact_id, rd_station_id, deal_rd_station_ids } = data;
  
  if (!contact_id && !rd_station_id && (!deal_rd_station_ids || deal_rd_station_ids.length === 0)) {
    return { activities: [] };
  }
  
  // Get profiles for owner mapping
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, email, full_name');
  const emailToProfileMap = new Map<string, { id: string; full_name: string }>(
    profiles?.map((p: any) => [p.email?.toLowerCase(), { id: p.id, full_name: p.full_name }]) || []
  );
  const profileIdToName = new Map<string, string>(
    profiles?.map((p: any) => [p.id, p.full_name]) || []
  );
  
  let allActivities: any[] = [];
  
  // Fetch activities for each deal's RD Station ID
  if (deal_rd_station_ids && deal_rd_station_ids.length > 0) {
    for (const dealRdId of deal_rd_station_ids) {
      if (!dealRdId) continue;
      
      try {
        const response = await fetch(
          `${RD_STATION_API_URL}/deals/${dealRdId}/activities?token=${rdToken}&limit=100`
        );
        
        if (response.ok) {
          const data = await response.json();
          const dealActivities = data.activities || [];
          console.log(`Fetched ${dealActivities.length} activities from deal ${dealRdId}`);
          allActivities = [...allActivities, ...dealActivities];
        }
      } catch (error) {
        console.error(`Error fetching activities from deal ${dealRdId}:`, error);
      }
    }
  }
  
  // Also try fetching from contact's RD Station ID if provided
  if (rd_station_id) {
    try {
      const response = await fetch(
        `${RD_STATION_API_URL}/contacts/${rd_station_id}/activities?token=${rdToken}&limit=100`
      );
      
      if (response.ok) {
        const data = await response.json();
        const contactActivities = data.activities || [];
        console.log(`Fetched ${contactActivities.length} activities from contact ${rd_station_id}`);
        allActivities = [...allActivities, ...contactActivities];
      }
    } catch (error) {
      console.error(`Error fetching activities from contact ${rd_station_id}:`, error);
    }
  }
  
  // Deduplicate by _id
  const seenIds = new Set<string>();
  const uniqueActivities = allActivities.filter(a => {
    if (!a._id || seenIds.has(a._id)) return false;
    seenIds.add(a._id);
    return true;
  });
  
  console.log(`Total unique activities found: ${uniqueActivities.length}`);
  
  // Transform activities for frontend consumption
  const transformedActivities = uniqueActivities.map(activity => {
    // Map activity type
    let type = 'task';
    const activityType = activity.type?.toString() || '';
    const subject = (activity.subject || activity.name || activity.title || '').toLowerCase();
    
    if (activityType === '0' || activityType === 'note') type = 'note';
    else if (activityType === '1' || activityType === 'call' || subject.includes('ligação') || subject.includes('call')) type = 'call';
    else if (activityType === '2' || activityType === 'email' || subject.includes('email') || subject.includes('e-mail')) type = 'email';
    else if (activityType === '3' || activityType === 'meeting' || subject.includes('reunião') || subject.includes('meeting')) type = 'meeting';
    else if (subject.includes('whatsapp')) type = 'whatsapp';
    
    // Get owner name
    let ownerName = null;
    if (activity.user?.email) {
      const profile = emailToProfileMap.get(activity.user.email.toLowerCase());
      ownerName = profile?.full_name || activity.user.name || activity.user.email;
    } else if (activity.user?.name) {
      ownerName = activity.user.name;
    }
    
    return {
      id: activity._id,
      rd_station_id: activity._id,
      type: type,
      title: activity.subject || activity.name || activity.title || 'Atividade',
      description: activity.text || activity.notes || activity.description || null,
      due_date: activity.date || activity.due_date || null,
      completed: activity.done || activity.completed || false,
      completed_at: activity.done_at || activity.completed_at || null,
      created_at: activity.created_at || new Date().toISOString(),
      owner_name: ownerName,
      deal_name: activity.deal?.name || null
    };
  });
  
  // Sort by created_at descending
  transformedActivities.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  
  // Also save/update these activities in the database for future use
  if (transformedActivities.length > 0 && contact_id) {
    for (const activity of transformedActivities) {
      let ownerId = null;
      if (activity.owner_name) {
        for (const [email, profile] of emailToProfileMap.entries()) {
          if (profile.full_name === activity.owner_name) {
            ownerId = profile.id;
            break;
          }
        }
      }
      
      await supabase
        .from('crm_activities')
        .upsert({
          rd_station_id: activity.rd_station_id,
          contact_id: contact_id,
          type: activity.type,
          title: activity.title,
          description: activity.description,
          due_date: activity.due_date,
          completed: activity.completed,
          completed_at: activity.completed_at,
          created_at: activity.created_at,
          owner_id: ownerId
        }, { onConflict: 'rd_station_id' });
    }
    console.log(`Saved ${transformedActivities.length} activities to database for contact ${contact_id}`);
  }
  
  return { activities: transformedActivities };
}
