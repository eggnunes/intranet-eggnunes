import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

/**
 * Z-API Webhook Receiver
 * 
 * Recebe TODOS os eventos possíveis da Z-API:
 * - ReceivedCallback: mensagens recebidas (texto, imagem, áudio, vídeo, documento, localização, contato, sticker, link, etc.)
 * - DeliveryCallback: confirmação de entrega de mensagens enviadas
 * - MessageStatusCallback: status de mensagens (enviada, entregue, lida, reproduzida)
 * - ChatPresenceCallback: presença no chat (digitando, gravando áudio, online/offline)
 * - DisconnectedCallback: desconexão da instância
 * - ConnectedCallback: conexão da instância
 * - BatteryLevelCallback: nível de bateria do dispositivo
 * - SendMessageCallback: mensagens enviadas por mim (notifySentByMe)
 */

function extractEventType(payload: any): string {
  // Z-API envia diferentes estruturas dependendo do tipo de evento
  
  // Evento de status de conexão
  if (payload.connected !== undefined && payload.smartphoneConnected !== undefined) {
    return payload.connected ? 'connection' : 'disconnection';
  }
  
  // Evento de nível de bateria
  if (payload.batteryLevel !== undefined) {
    return 'battery_level';
  }
  
  // Evento de presença no chat
  if (payload.chatPresence || payload.status === 'composing' || payload.status === 'recording' || payload.status === 'available' || payload.status === 'unavailable') {
    return 'chat_presence';
  }
  
  // Evento de status de mensagem (delivery/read)
  if (payload.status && payload.id && !payload.body && !payload.text && !payload.type) {
    return 'message_status';
  }
  
  // Evento de mensagem recebida ou enviada
  if (payload.isStatusReply !== undefined || payload.senderLid || payload.chatLid || payload.body || payload.text || payload.type) {
    if (payload.fromMe === true) {
      return 'sent_message';
    }
    return 'received_message';
  }
  
  // Evento de reação
  if (payload.reactionMessage || payload.reaction) {
    return 'reaction';
  }
  
  return 'unknown';
}

function extractMessageType(payload: any): string | null {
  if (!payload.type && !payload.body && !payload.text) return null;
  
  const type = payload.type || '';
  
  if (type === 'ReceivedCallback' || type === 'DeliveryCallback') return type;
  
  // Detectar tipo pela estrutura do payload
  if (payload.image) return 'image';
  if (payload.audio) return 'audio';
  if (payload.video) return 'video';
  if (payload.document) return 'document';
  if (payload.sticker) return 'sticker';
  if (payload.contact) return 'contact';
  if (payload.location || payload.loc) return 'location';
  if (payload.listMessage) return 'list';
  if (payload.buttonsMessage || payload.templateButtons) return 'buttons';
  if (payload.productMessage) return 'product';
  if (payload.orderMessage) return 'order';
  if (payload.poll) return 'poll';
  if (payload.reactionMessage || payload.reaction) return 'reaction';
  if (payload.linkPreview || payload.matchedText) return 'link_preview';
  if (payload.body || payload.text?.message) return 'text';
  
  return type || 'unknown';
}

function extractPhone(payload: any): string | null {
  // Tentar extrair o telefone de diferentes campos possíveis
  return payload.phone 
    || payload.from 
    || payload.chatId?.replace('@c.us', '').replace('@g.us', '')
    || payload.chat?.replace('@c.us', '').replace('@g.us', '')
    || null;
}

function extractMessageText(payload: any): string | null {
  return payload.body 
    || payload.text?.message 
    || payload.text 
    || payload.caption 
    || payload.listMessage?.description
    || null;
}

function extractMediaUrl(payload: any): string | null {
  return payload.image?.imageUrl 
    || payload.image?.url
    || payload.audio?.audioUrl 
    || payload.audio?.url
    || payload.video?.videoUrl 
    || payload.video?.url
    || payload.document?.documentUrl
    || payload.document?.url
    || payload.sticker?.stickerUrl
    || payload.sticker?.url
    || null;
}

function extractMediaMimeType(payload: any): string | null {
  return payload.image?.mimetype 
    || payload.audio?.mimetype 
    || payload.video?.mimetype 
    || payload.document?.mimetype
    || payload.sticker?.mimetype
    || null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const payload = await req.json();
    
    const eventType = extractEventType(payload);
    const messageType = extractMessageType(payload);
    const phone = extractPhone(payload);
    const messageText = extractMessageText(payload);
    const mediaUrl = extractMediaUrl(payload);
    const mediaMimeType = extractMediaMimeType(payload);

    console.log(`[Z-API Webhook] Event: ${eventType} | Type: ${messageType} | Phone: ${phone} | FromMe: ${payload.fromMe || false}`);

    // Montar o registro para salvar
    const eventRecord: Record<string, unknown> = {
      event_type: eventType,
      phone: phone,
      message_id: payload.messageId || payload.id?.id || payload.id?._serialized || null,
      zaap_id: payload.zapiMessageId || payload.zaapId || null,
      is_group: payload.isGroup || payload.isGroupMsg || (phone?.includes('@g.us') ?? false),
      chat_name: payload.chatName || payload.chat?.name || payload.senderName || null,
      sender_name: payload.senderName || payload.pushName || payload.notifyName || null,
      sender_phone: payload.senderPhone || payload.sender || payload.participant || null,
      is_from_me: payload.fromMe || false,
      moment_type: payload.momment || payload.moment || null,
      status: payload.status || null,
      broadcast: payload.broadcast || false,
      message_type: messageType,
      message_text: typeof messageText === 'string' ? messageText : (messageText ? JSON.stringify(messageText) : null),
      caption: payload.caption || null,
      media_url: mediaUrl,
      media_mime_type: mediaMimeType,
      latitude: payload.location?.latitude || payload.loc?.latitude || null,
      longitude: payload.location?.longitude || payload.loc?.longitude || null,
      thumbnail_url: payload.thumbnail || payload.image?.thumbnail || null,
      link_url: payload.matchedText || payload.linkPreview?.canonicalUrl || null,
      link_title: payload.linkPreview?.title || null,
      link_description: payload.linkPreview?.description || null,
      quoted_message_id: payload.quotedMsg?.id || payload.quotedMsgId || null,
      reaction_emoji: payload.reactionMessage?.text || payload.reaction?.text || null,
      connected: payload.connected ?? null,
      battery_level: payload.batteryLevel ?? null,
      is_charging: payload.isCharging ?? null,
      raw_payload: payload,
      received_at: new Date().toISOString(),
    };

    // Inserir no banco
    const { error: insertError } = await supabase
      .from('zapi_webhook_events')
      .insert(eventRecord);

    if (insertError) {
      console.error('[Z-API Webhook] Error inserting event:', insertError);
      // Não retornar erro para a Z-API, senão ela pode parar de enviar webhooks
    } else {
      console.log(`[Z-API Webhook] ✓ Event saved: ${eventType} from ${phone || 'system'}`);
    }

    // Sempre retornar 200 para a Z-API não tentar reenviar
    return new Response(
      JSON.stringify({ success: true, eventType }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[Z-API Webhook] Error processing webhook:', error);
    
    // Mesmo com erro, retornar 200 para não causar retry infinito da Z-API
    return new Response(
      JSON.stringify({ success: false, error: 'Internal error' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
