import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const expectedSecret = Deno.env.get('RD_STATION_WEBHOOK_SECRET');
    
    // Check Authorization header or X-Webhook-Secret header only (no query params)
    const authHeader = req.headers.get('Authorization');
    const webhookSecretHeader = req.headers.get('X-Webhook-Secret');
    
    // Validate webhook secret from headers only
    const providedSecret = authHeader?.replace('Bearer ', '') || webhookSecretHeader;
    
    if (providedSecret !== expectedSecret) {
      console.error('Invalid webhook secret');
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const payload = await req.json();
    console.log('Received CRM webhook payload:', JSON.stringify(payload, null, 2));

    const eventType = payload.event_type || payload.type;
    const entityType = detectEntityType(payload);

    switch (entityType) {
      case 'contact':
        await handleContactWebhook(payload, supabase);
        break;
      case 'deal':
        await handleDealWebhook(payload, supabase);
        break;
      default:
        console.log('Unknown entity type:', entityType);
    }

    // Log webhook
    await supabase.from('crm_sync_log').insert({
      sync_type: 'webhook',
      entity_type: entityType || 'unknown',
      entity_id: payload._id || payload.id,
      status: 'success'
    });

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Error processing CRM webhook:', error);
    
    // Try to log error
    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseServiceKey);
      
      await supabase.from('crm_sync_log').insert({
        sync_type: 'webhook',
        entity_type: 'unknown',
        status: 'error',
        error_message: error?.message || 'Erro desconhecido'
      });
    } catch (logError) {
      console.error('Error logging webhook error:', logError);
    }

    return new Response(
      JSON.stringify({ error: error?.message || 'Erro desconhecido' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function detectEntityType(payload: any): string {
  if (payload.emails || payload.phones || payload.title) {
    return 'contact';
  }
  if (payload.deal_stage || payload.amount_total || payload.deal_products) {
    return 'deal';
  }
  if (payload.entity_type) {
    return payload.entity_type;
  }
  return 'unknown';
}

async function handleContactWebhook(payload: any, supabase: any) {
  console.log('Processing contact webhook...');
  
  const contactData = {
    rd_station_id: payload._id,
    name: payload.name || payload.emails?.[0]?.email || 'Sem nome',
    email: payload.emails?.[0]?.email || null,
    phone: payload.phones?.[0]?.phone || null,
    company: payload.organization?.name || null,
    job_title: payload.title || null,
    address: payload.address?.street || null,
    city: payload.address?.city || null,
    state: payload.address?.state || null,
    country: payload.address?.country || null,
    website: payload.website || null,
    linkedin: payload.linkedin || null,
    facebook: payload.facebook || null,
    twitter: payload.twitter || null,
    birthday: payload.birthday || null,
    notes: payload.notes || null,
    custom_fields: payload.custom_fields || {},
    lead_score: payload.score || 0
  };

  const { error } = await supabase
    .from('crm_contacts')
    .upsert(contactData, { onConflict: 'rd_station_id' });

  if (error) {
    console.error('Error upserting contact from webhook:', error);
    throw error;
  }

  console.log('Contact processed successfully');
}

async function handleDealWebhook(payload: any, supabase: any) {
  console.log('Processing deal webhook...');

  // Get stage mapping
  let stageId = null;
  let pipelineId = null;

  if (payload.deal_stage?._id) {
    const { data: stage } = await supabase
      .from('crm_deal_stages')
      .select('id, pipeline_id')
      .eq('rd_station_id', payload.deal_stage._id)
      .single();
    
    if (stage) {
      stageId = stage.id;
      pipelineId = stage.pipeline_id;
    }
  }

  // Get contact mapping
  let contactId = null;
  if (payload.contacts?.[0]?._id) {
    const { data: contact } = await supabase
      .from('crm_contacts')
      .select('id')
      .eq('rd_station_id', payload.contacts[0]._id)
      .single();
    
    if (contact) {
      contactId = contact.id;
    }
  }

  // Check if deal exists to track stage changes
  const { data: existingDeal } = await supabase
    .from('crm_deals')
    .select('id, stage_id')
    .eq('rd_station_id', payload._id)
    .single();

  const dealData = {
    rd_station_id: payload._id,
    contact_id: contactId,
    pipeline_id: pipelineId,
    stage_id: stageId,
    name: payload.name || 'Deal sem nome',
    value: payload.amount_total || 0,
    expected_close_date: payload.prediction_date || null,
    closed_at: payload.closed_at || null,
    won: payload.win,
    loss_reason: payload.loss_reason || null,
    product_name: payload.deal_products?.[0]?.name || null,
    campaign_name: payload.campaign?.name || null,
    notes: payload.notes || null,
    custom_fields: payload.custom_fields || {}
  };

  const { data: upsertedDeal, error } = await supabase
    .from('crm_deals')
    .upsert(dealData, { onConflict: 'rd_station_id' })
    .select()
    .single();

  if (error) {
    console.error('Error upserting deal from webhook:', error);
    throw error;
  }

  // Log stage change if different
  if (existingDeal && existingDeal.stage_id !== stageId) {
    await supabase.from('crm_deal_history').insert({
      deal_id: upsertedDeal.id,
      from_stage_id: existingDeal.stage_id,
      to_stage_id: stageId,
      notes: 'Atualizado via webhook RD Station'
    });
  }

  console.log('Deal processed successfully');
}
