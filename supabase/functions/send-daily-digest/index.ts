import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const RESEND_API_KEY = () => Deno.env.get("RESEND_API_KEY");
const FROM_EMAIL = "Egg Nunes - Avisos <avisos@intranetagnunes.com.br>";

async function sendEmailViaResend(to: string, subject: string, html: string) {
  const apiKey = RESEND_API_KEY();
  if (!apiKey) throw new Error("RESEND_API_KEY não configurada");

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: FROM_EMAIL, to: [to], subject, html }),
  });

  const result = await response.json();
  if (!response.ok) throw new Error(result.message || "Erro ao enviar email");
  return result;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function buildBaseStyles(): string {
  return `
    <style>
      body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f4f5; margin: 0; padding: 20px; }
      .container { max-width: 650px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
      .header { background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); color: white; padding: 25px 30px; }
      .header h1 { margin: 0; font-size: 22px; }
      .header p { margin: 5px 0 0; opacity: 0.9; font-size: 13px; }
      .content { padding: 25px 30px; }
      .section { margin-bottom: 25px; }
      .section-title { font-size: 16px; font-weight: 700; color: #1f2937; margin: 0 0 12px; display: flex; align-items: center; gap: 8px; }
      .item { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px 15px; margin-bottom: 8px; }
      .item-title { font-weight: 600; color: #111827; font-size: 14px; }
      .item-meta { color: #6b7280; font-size: 12px; margin-top: 4px; }
      .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; }
      .badge-red { background: #fef2f2; color: #dc2626; }
      .badge-yellow { background: #fefce8; color: #ca8a04; }
      .badge-green { background: #ecfdf5; color: #059669; }
      .badge-blue { background: #eff6ff; color: #2563eb; }
      .stat-row { display: flex; gap: 15px; margin-bottom: 15px; }
      .stat-box { flex: 1; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 15px; text-align: center; }
      .stat-number { font-size: 28px; font-weight: 700; color: #6366f1; }
      .stat-label { font-size: 12px; color: #6b7280; margin-top: 4px; }
      .footer { background: #f9fafb; padding: 15px 30px; text-align: center; color: #9ca3af; font-size: 11px; border-top: 1px solid #e5e7eb; }
      .empty-msg { color: #9ca3af; font-style: italic; font-size: 13px; }
      .button { display: inline-block; background: #6366f1; color: white; padding: 10px 20px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 13px; }
    </style>
  `;
}

interface UserDigestData {
  messages: any[];
  announcements: any[];
  updates: any[];
  tasks: any[];
  overdueTasks: any[];
  dueSoonTasks: any[];
  leads?: { today: number; week: number; bySources: Record<string, number> };
}

function buildDigestHtml(userName: string, position: string, data: UserDigestData, baseUrl: string): string {
  const dateStr = new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });
  
  let sections = "";

  // Overdue tasks
  if (data.overdueTasks.length > 0) {
    sections += `
      <div class="section">
        <div class="section-title">🚨 Tarefas Atrasadas (${data.overdueTasks.length})</div>
        ${data.overdueTasks.slice(0, 10).map(t => `
          <div class="item">
            <div class="item-title">${escapeHtml(t.title)}</div>
            <div class="item-meta">Venceu em: ${t.due_date ? formatDate(t.due_date) : 'Sem data'} · <span class="badge badge-red">Atrasada</span></div>
          </div>
        `).join("")}
      </div>
    `;
  }

  // Due soon tasks
  if (data.dueSoonTasks.length > 0) {
    sections += `
      <div class="section">
        <div class="section-title">⏰ Tarefas com Prazo Próximo (${data.dueSoonTasks.length})</div>
        ${data.dueSoonTasks.slice(0, 10).map(t => `
          <div class="item">
            <div class="item-title">${escapeHtml(t.title)}</div>
            <div class="item-meta">Vence em: ${t.due_date ? formatDate(t.due_date) : 'Sem data'} · <span class="badge badge-yellow">Próxima</span></div>
          </div>
        `).join("")}
      </div>
    `;
  }

  // Pending tasks
  if (data.tasks.length > 0) {
    sections += `
      <div class="section">
        <div class="section-title">📋 Tarefas Pendentes (${data.tasks.length})</div>
        ${data.tasks.slice(0, 8).map(t => `
          <div class="item">
            <div class="item-title">${escapeHtml(t.title)}</div>
            <div class="item-meta">${t.due_date ? `Prazo: ${formatDate(t.due_date)}` : 'Sem prazo'} · ${t.process_number ? `Processo: ${t.process_number}` : ''}</div>
          </div>
        `).join("")}
        ${data.tasks.length > 8 ? `<p class="item-meta">...e mais ${data.tasks.length - 8} tarefas</p>` : ""}
      </div>
    `;
  }

  // Messages
  if (data.messages.length > 0) {
    sections += `
      <div class="section">
        <div class="section-title">✉️ Mensagens Recebidas (${data.messages.length})</div>
        ${data.messages.slice(0, 5).map(m => `
          <div class="item">
            <div class="item-title">${escapeHtml(m.sender_name || 'Alguém')}</div>
            <div class="item-meta">${escapeHtml((m.content || '').substring(0, 100))}${(m.content || '').length > 100 ? '...' : ''}</div>
          </div>
        `).join("")}
        ${data.messages.length > 5 ? `<p class="item-meta">...e mais ${data.messages.length - 5} mensagens</p>` : ""}
        <a href="${baseUrl}/mensagens" class="button" style="margin-top:10px;">Ver Mensagens</a>
      </div>
    `;
  }

  // Announcements
  if (data.announcements.length > 0) {
    sections += `
      <div class="section">
        <div class="section-title">📢 Novos Comunicados (${data.announcements.length})</div>
        ${data.announcements.slice(0, 5).map(a => `
          <div class="item">
            <div class="item-title">${escapeHtml(a.title)}</div>
            <div class="item-meta">${escapeHtml((a.content || '').substring(0, 120))}${(a.content || '').length > 120 ? '...' : ''}</div>
          </div>
        `).join("")}
        <a href="${baseUrl}/mural-avisos" class="button" style="margin-top:10px;">Ver Mural</a>
      </div>
    `;
  }

  // Intranet updates
  if (data.updates.length > 0) {
    sections += `
      <div class="section">
        <div class="section-title">🔄 Atualizações da Intranet (${data.updates.length})</div>
        ${data.updates.map(u => `
          <div class="item">
            <div class="item-title">${escapeHtml(u.title)}</div>
            <div class="item-meta">${escapeHtml(u.description || '')}</div>
          </div>
        `).join("")}
      </div>
    `;
  }

  // Leads section (for commercial)
  if (data.leads && (data.leads.today > 0 || data.leads.week > 0)) {
    const sourceItems = Object.entries(data.leads.bySources || {}).map(([source, count]) => 
      `<div class="item"><div class="item-title">${escapeHtml(source || 'Direto')}</div><div class="item-meta">${count} lead(s)</div></div>`
    ).join("");

    sections += `
      <div class="section">
        <div class="section-title">📊 Resumo de Leads</div>
        <div class="stat-row">
          <div class="stat-box">
            <div class="stat-number">${data.leads.today}</div>
            <div class="stat-label">Ontem</div>
          </div>
          <div class="stat-box">
            <div class="stat-number">${data.leads.week}</div>
            <div class="stat-label">Últimos 7 dias</div>
          </div>
        </div>
        ${sourceItems ? `<div class="section-title" style="font-size:14px;">Por Fonte (ontem)</div>${sourceItems}` : ""}
        <a href="${baseUrl}/lead-tracking" class="button" style="margin-top:10px;">Ver Leads</a>
      </div>
    `;
  }

  if (!sections) return ""; // Don't send empty digest

  return `
    ${buildBaseStyles()}
    <div class="container">
      <div class="header">
        <h1>📬 Resumo Diário</h1>
        <p>${dateStr}</p>
      </div>
      <div class="content">
        <p style="color: #374151; margin: 0 0 20px;">Olá <strong>${escapeHtml(userName)}</strong>, aqui está seu resumo de hoje:</p>
        ${sections}
      </div>
      <div class="footer">
        Egg Nunes Advogados Associados - Sistema de Gestão Interna<br>
        <small>Para alterar preferências de e-mail, acesse seu perfil na intranet.</small>
      </div>
    </div>
  `;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const COMMERCIAL_POSITIONS = ["comercial", "setor_comercial", "marketing"];
const OPERATIONAL_POSITIONS = ["advogado", "estagiario", "paralegal", "operacional", "socio", "junior", "pleno", "senior"];

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const BASE_URL = "https://intranet-eggnunes.lovable.app";
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

    // 1. Get all active, approved, non-suspended profiles
    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("id, email, full_name, position")
      .eq("is_active", true)
      .eq("is_suspended", false)
      .eq("approval_status", "approved");

    if (profilesError) throw profilesError;
    if (!profiles || profiles.length === 0) {
      return new Response(JSON.stringify({ message: "No active users found" }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // 2. Get email preferences for all users
    const userIds = profiles.map(p => p.id);
    const { data: allPrefs } = await supabase
      .from("email_notification_preferences")
      .select("*")
      .in("user_id", userIds);

    const prefsMap = new Map(allPrefs?.map(p => [p.user_id, p]) || []);

    // 3. Fetch shared data (announcements, updates, leads)
    const { data: recentAnnouncements } = await supabase
      .from("announcements")
      .select("*")
      .gte("created_at", yesterday.toISOString())
      .order("created_at", { ascending: false });

    const { data: recentUpdates } = await supabase
      .from("intranet_updates")
      .select("*")
      .gte("created_at", yesterday.toISOString())
      .order("created_at", { ascending: false });

    // Leads data (for commercial)
    const { data: leadsToday } = await supabase
      .from("captured_leads")
      .select("id, utm_source, utm_campaign")
      .gte("created_at", yesterday.toISOString());

    const { data: leadsWeek } = await supabase
      .from("captured_leads")
      .select("id")
      .gte("created_at", weekAgo.toISOString());

    const leadsBySources: Record<string, number> = {};
    leadsToday?.forEach(l => {
      const src = l.utm_source || "Direto";
      leadsBySources[src] = (leadsBySources[src] || 0) + 1;
    });

    // 4. Get all pending tasks
    const { data: allTasks } = await supabase
      .from("advbox_tasks")
      .select("id, title, due_date, status, assigned_users, process_number")
      .neq("status", "completed")
      .neq("status", "concluida");

    // 5. Get all recent messages with sender info
    const { data: recentMessages } = await supabase
      .from("messages")
      .select("id, conversation_id, sender_id, content, created_at")
      .gte("created_at", yesterday.toISOString())
      .order("created_at", { ascending: false });

    // Get sender profiles for messages
    const senderIds = [...new Set(recentMessages?.map(m => m.sender_id) || [])];
    const { data: senderProfiles } = senderIds.length > 0
      ? await supabase.from("profiles").select("id, full_name").in("id", senderIds)
      : { data: [] };
    const senderMap = new Map(senderProfiles?.map(p => [p.id, p.full_name]) || []);

    // Get conversation participants
    const { data: allParticipants } = await supabase
      .from("conversation_participants")
      .select("conversation_id, user_id");

    const participantsByConv = new Map<string, string[]>();
    allParticipants?.forEach(p => {
      const list = participantsByConv.get(p.conversation_id) || [];
      list.push(p.user_id);
      participantsByConv.set(p.conversation_id, list);
    });

    // 6. Process each user
    let sentCount = 0;
    let skippedCount = 0;

    for (const profile of profiles) {
      try {
        if (!profile.email) { skippedCount++; continue; }

        const prefs = prefsMap.get(profile.id);
        // Check if daily digest is enabled (default true)
        if (prefs && prefs.notify_daily_digest === false) {
          skippedCount++;
          continue;
        }

        const position = (profile.position || "").toLowerCase();
        const isCommercial = COMMERCIAL_POSITIONS.some(p => position.includes(p));
        const userName = profile.full_name || profile.email;

        // User's messages (received, not sent by them)
        const userMessages = recentMessages?.filter(m => {
          const convParticipants = participantsByConv.get(m.conversation_id) || [];
          return convParticipants.includes(profile.id) && m.sender_id !== profile.id;
        }).map(m => ({ ...m, sender_name: senderMap.get(m.sender_id) })) || [];

        // User's tasks (assigned to them)
        const userFullName = profile.full_name || "";
        const userTasks = allTasks?.filter(t => {
          const assigned = (t.assigned_users || "").toLowerCase();
          return assigned.includes(userFullName.toLowerCase());
        }) || [];

        const nowStr = now.toISOString().split("T")[0];
        const threeDaysStr = threeDaysFromNow.toISOString().split("T")[0];

        const overdueTasks = userTasks.filter(t => t.due_date && t.due_date < nowStr);
        const dueSoonTasks = userTasks.filter(t => t.due_date && t.due_date >= nowStr && t.due_date <= threeDaysStr);
        const pendingTasks = userTasks.filter(t => !overdueTasks.includes(t) && !dueSoonTasks.includes(t));

        const digestData: UserDigestData = {
          messages: userMessages,
          announcements: recentAnnouncements || [],
          updates: recentUpdates || [],
          tasks: pendingTasks,
          overdueTasks,
          dueSoonTasks,
          leads: isCommercial ? {
            today: leadsToday?.length || 0,
            week: leadsWeek?.length || 0,
            bySources: leadsBySources,
          } : undefined,
        };

        // Check if there's any content
        const hasContent = userMessages.length > 0 ||
          (recentAnnouncements?.length || 0) > 0 ||
          (recentUpdates?.length || 0) > 0 ||
          overdueTasks.length > 0 ||
          dueSoonTasks.length > 0 ||
          pendingTasks.length > 0 ||
          (isCommercial && (leadsToday?.length || 0) > 0);

        if (!hasContent) {
          skippedCount++;
          continue;
        }

        const html = buildDigestHtml(userName, position, digestData, BASE_URL);
        if (!html) { skippedCount++; continue; }

        const subject = `📬 Resumo Diário - ${now.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}`;

        await sendEmailViaResend(profile.email, subject, html);
        sentCount++;

        // Rate limiting: 200ms delay between emails
        await new Promise(r => setTimeout(r, 200));

      } catch (userError) {
        console.error(`[send-daily-digest] Error for user ${profile.id}:`, userError);
        skippedCount++;
      }
    }

    // Log execution
    await supabase.from("email_log").insert({
      to_email: "system",
      subject: "Daily Digest Execution",
      template_type: "daily_digest",
      status: "sent",
      metadata: { sentCount, skippedCount, totalUsers: profiles.length },
      sent_at: new Date().toISOString(),
    });

    console.log(`[send-daily-digest] Completed: ${sentCount} sent, ${skippedCount} skipped`);

    return new Response(
      JSON.stringify({ success: true, sentCount, skippedCount }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );

  } catch (error: any) {
    console.error("[send-daily-digest] Fatal error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
