import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EmailRequest {
  to: string;
  toUserId?: string;
  subject: string;
  templateType: string;
  data: Record<string, any>;
}

// Templates de email
const getEmailTemplate = (templateType: string, data: Record<string, any>): string => {
  const baseStyles = `
    <style>
      body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f4f5; margin: 0; padding: 20px; }
      .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
      .header { background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); color: white; padding: 30px; text-align: center; }
      .header h1 { margin: 0; font-size: 24px; }
      .content { padding: 30px; }
      .content p { color: #374151; line-height: 1.6; margin: 0 0 15px; }
      .button { display: inline-block; background: #6366f1; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; margin: 20px 0; }
      .footer { background: #f9fafb; padding: 20px; text-align: center; color: #6b7280; font-size: 12px; }
      .highlight { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 15px 0; border-radius: 0 8px 8px 0; }
      .info-box { background: #eff6ff; border: 1px solid #bfdbfe; padding: 15px; border-radius: 8px; margin: 15px 0; }
      .success-box { background: #ecfdf5; border: 1px solid #a7f3d0; padding: 15px; border-radius: 8px; margin: 15px 0; }
      .warning-box { background: #fef3c7; border: 1px solid #fcd34d; padding: 15px; border-radius: 8px; margin: 15px 0; }
      .danger-box { background: #fef2f2; border: 1px solid #fecaca; padding: 15px; border-radius: 8px; margin: 15px 0; }
    </style>
  `;

  const templates: Record<string, string> = {
    // Tarefas
    task_assigned: `
      ${baseStyles}
      <div class="container">
        <div class="header"><h1>📋 Nova Tarefa Atribuída</h1></div>
        <div class="content">
          <p>Olá <strong>${data.userName}</strong>,</p>
          <p>Uma nova tarefa foi atribuída a você:</p>
          <div class="info-box">
            <strong>${data.taskTitle}</strong><br>
            <small>Prazo: ${data.dueDate || 'Sem prazo definido'}</small>
          </div>
          ${data.description ? `<p>${data.description}</p>` : ''}
          <a href="${data.actionUrl}" class="button">Ver Tarefa</a>
        </div>
        <div class="footer">Egg Nunes Advogados - Sistema de Gestão Interna</div>
      </div>
    `,

    task_due_soon: `
      ${baseStyles}
      <div class="container">
        <div class="header" style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);"><h1>⏰ Tarefa Próxima do Vencimento</h1></div>
        <div class="content">
          <p>Olá <strong>${data.userName}</strong>,</p>
          <div class="warning-box">
            <strong>${data.taskTitle}</strong><br>
            <small>Vence em: ${data.dueDate}</small>
          </div>
          <p>Esta tarefa está próxima do prazo de entrega. Não se esqueça de concluí-la!</p>
          <a href="${data.actionUrl}" class="button">Ver Tarefa</a>
        </div>
        <div class="footer">Egg Nunes Advogados - Sistema de Gestão Interna</div>
      </div>
    `,

    task_overdue: `
      ${baseStyles}
      <div class="container">
        <div class="header" style="background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);"><h1>🚨 Tarefa Atrasada</h1></div>
        <div class="content">
          <p>Olá <strong>${data.userName}</strong>,</p>
          <div class="danger-box">
            <strong>${data.taskTitle}</strong><br>
            <small>Venceu em: ${data.dueDate}</small>
          </div>
          <p>Esta tarefa está atrasada. Por favor, verifique e atualize o status.</p>
          <a href="${data.actionUrl}" class="button">Ver Tarefa</a>
        </div>
        <div class="footer">Egg Nunes Advogados - Sistema de Gestão Interna</div>
      </div>
    `,

    // Aprovações
    approval_requested: `
      ${baseStyles}
      <div class="container">
        <div class="header"><h1>📝 Solicitação de Aprovação</h1></div>
        <div class="content">
          <p>Olá <strong>${data.approverName}</strong>,</p>
          <p>Há uma nova solicitação aguardando sua aprovação:</p>
          <div class="info-box">
            <strong>${data.title}</strong><br>
            <small>Solicitante: ${data.requesterName}</small><br>
            ${data.value ? `<small>Valor: R$ ${data.value}</small>` : ''}
          </div>
          <a href="${data.actionUrl}" class="button">Revisar Solicitação</a>
        </div>
        <div class="footer">Egg Nunes Advogados - Sistema de Gestão Interna</div>
      </div>
    `,

    approval_approved: `
      ${baseStyles}
      <div class="container">
        <div class="header" style="background: linear-gradient(135deg, #10b981 0%, #059669 100%);"><h1>✅ Solicitação Aprovada</h1></div>
        <div class="content">
          <p>Olá <strong>${data.userName}</strong>,</p>
          <div class="success-box">
            <strong>${data.title}</strong> foi aprovada!<br>
            <small>Aprovado por: ${data.approverName}</small>
          </div>
          ${data.comments ? `<p><strong>Comentários:</strong> ${data.comments}</p>` : ''}
          <a href="${data.actionUrl}" class="button">Ver Detalhes</a>
        </div>
        <div class="footer">Egg Nunes Advogados - Sistema de Gestão Interna</div>
      </div>
    `,

    approval_rejected: `
      ${baseStyles}
      <div class="container">
        <div class="header" style="background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);"><h1>❌ Solicitação Rejeitada</h1></div>
        <div class="content">
          <p>Olá <strong>${data.userName}</strong>,</p>
          <div class="danger-box">
            <strong>${data.title}</strong> foi rejeitada.<br>
            <small>Rejeitado por: ${data.approverName}</small>
          </div>
          ${data.reason ? `<p><strong>Motivo:</strong> ${data.reason}</p>` : ''}
          <a href="${data.actionUrl}" class="button">Ver Detalhes</a>
        </div>
        <div class="footer">Egg Nunes Advogados - Sistema de Gestão Interna</div>
      </div>
    `,

    // Financeiro
    financial_due: `
      ${baseStyles}
      <div class="container">
        <div class="header" style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);"><h1>💰 Lançamento Financeiro Pendente</h1></div>
        <div class="content">
          <p>Olá <strong>${data.userName}</strong>,</p>
          <div class="warning-box">
            <strong>${data.description}</strong><br>
            <small>Valor: R$ ${data.value}</small><br>
            <small>Vencimento: ${data.dueDate}</small>
          </div>
          <a href="${data.actionUrl}" class="button">Ver Lançamento</a>
        </div>
        <div class="footer">Egg Nunes Advogados - Sistema de Gestão Interna</div>
      </div>
    `,

    // Avisos/Comunicados
    announcement: `
      ${baseStyles}
      <div class="container">
        <div class="header"><h1>📢 Novo Comunicado</h1></div>
        <div class="content">
          <p>Olá <strong>${data.userName}</strong>,</p>
          <p>Um novo comunicado foi publicado:</p>
          <div class="highlight">
            <strong>${data.title}</strong>
          </div>
          <p>${data.content}</p>
          <a href="${data.actionUrl}" class="button">Ver Comunicado</a>
        </div>
        <div class="footer">Egg Nunes Advogados - Sistema de Gestão Interna</div>
      </div>
    `,

    // Férias
    vacation_approved: `
      ${baseStyles}
      <div class="container">
        <div class="header" style="background: linear-gradient(135deg, #10b981 0%, #059669 100%);"><h1>🏖️ Férias Aprovadas</h1></div>
        <div class="content">
          <p>Olá <strong>${data.userName}</strong>,</p>
          <div class="success-box">
            Suas férias foram aprovadas!<br>
            <strong>Período:</strong> ${data.startDate} a ${data.endDate}<br>
            <strong>Dias:</strong> ${data.days} dias úteis
          </div>
          <a href="${data.actionUrl}" class="button">Ver Detalhes</a>
        </div>
        <div class="footer">Egg Nunes Advogados - Sistema de Gestão Interna</div>
      </div>
    `,

    vacation_rejected: `
      ${baseStyles}
      <div class="container">
        <div class="header" style="background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);"><h1>🏖️ Férias Não Aprovadas</h1></div>
        <div class="content">
          <p>Olá <strong>${data.userName}</strong>,</p>
          <div class="danger-box">
            Sua solicitação de férias não foi aprovada.<br>
            <strong>Período solicitado:</strong> ${data.startDate} a ${data.endDate}
          </div>
          ${data.reason ? `<p><strong>Motivo:</strong> ${data.reason}</p>` : ''}
          <a href="${data.actionUrl}" class="button">Ver Detalhes</a>
        </div>
        <div class="footer">Egg Nunes Advogados - Sistema de Gestão Interna</div>
      </div>
    `,

    vacation_requested: `
      ${baseStyles}
      <div class="container">
        <div class="header"><h1>🏖️ Nova Solicitação de Férias</h1></div>
        <div class="content">
          <p>Olá <strong>${data.approverName}</strong>,</p>
          <p>Uma nova solicitação de férias foi recebida:</p>
          <div class="info-box">
            <strong>Colaborador:</strong> ${data.requesterName}<br>
            <strong>Período:</strong> ${data.startDate} a ${data.endDate}<br>
            <strong>Dias:</strong> ${data.days} dias úteis
          </div>
          <a href="${data.actionUrl}" class="button">Revisar Solicitação</a>
        </div>
        <div class="footer">Egg Nunes Advogados - Sistema de Gestão Interna</div>
      </div>
    `,

    // Aniversário
    birthday: `
      ${baseStyles}
      <div class="container">
        <div class="header" style="background: linear-gradient(135deg, #ec4899 0%, #f472b6 100%);"><h1>🎂 Feliz Aniversário!</h1></div>
        <div class="content">
          <p style="font-size: 18px;">Olá <strong>${data.userName}</strong>,</p>
          <p style="font-size: 16px;">Hoje é um dia muito especial! Toda a equipe do Egg Nunes Advogados deseja a você um feliz aniversário!</p>
          <p>Que este novo ano de vida seja repleto de conquistas, alegrias e realizações!</p>
          <p style="font-size: 24px; text-align: center;">🎉🎈🎁</p>
        </div>
        <div class="footer">Egg Nunes Advogados - Sistema de Gestão Interna</div>
      </div>
    `,

    // Fórum
    forum_reply: `
      ${baseStyles}
      <div class="container">
        <div class="header"><h1>💬 Nova Resposta no Fórum</h1></div>
        <div class="content">
          <p>Olá <strong>${data.userName}</strong>,</p>
          <p>Há uma nova resposta no tópico que você está acompanhando:</p>
          <div class="info-box">
            <strong>${data.topicTitle}</strong><br>
            <small>Respondido por: ${data.authorName}</small>
          </div>
          <a href="${data.actionUrl}" class="button">Ver Resposta</a>
        </div>
        <div class="footer">Egg Nunes Advogados - Sistema de Gestão Interna</div>
      </div>
    `,

    // Mensagens
    new_message: `
      ${baseStyles}
      <div class="container">
        <div class="header"><h1>✉️ Nova Mensagem</h1></div>
        <div class="content">
          <p>Olá <strong>${data.userName}</strong>,</p>
          <p>Você recebeu uma nova mensagem de <strong>${data.senderName}</strong>:</p>
          <div class="info-box">
            ${data.preview}
          </div>
          <a href="${data.actionUrl}" class="button">Ver Mensagem</a>
        </div>
        <div class="footer">Egg Nunes Advogados - Sistema de Gestão Interna</div>
      </div>
    `,

    // CRM
    crm_deal_update: `
      ${baseStyles}
      <div class="container">
        <div class="header"><h1>📊 Atualização de Negócio</h1></div>
        <div class="content">
          <p>Olá <strong>${data.userName}</strong>,</p>
          <div class="info-box">
            <strong>${data.dealName}</strong><br>
            <small>Novo Status: ${data.newStatus}</small><br>
            ${data.value ? `<small>Valor: R$ ${data.value}</small>` : ''}
          </div>
          <a href="${data.actionUrl}" class="button">Ver Negócio</a>
        </div>
        <div class="footer">Egg Nunes Advogados - Sistema de Gestão Interna</div>
      </div>
    `,

    crm_follow_up: `
      ${baseStyles}
      <div class="container">
        <div class="header" style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);"><h1>📞 Lembrete de Follow-up</h1></div>
        <div class="content">
          <p>Olá <strong>${data.userName}</strong>,</p>
          <div class="warning-box">
            <strong>${data.title}</strong><br>
            <small>Contato: ${data.contactName}</small><br>
            <small>Data: ${data.reminderDate}</small>
          </div>
          ${data.notes ? `<p><strong>Notas:</strong> ${data.notes}</p>` : ''}
          <a href="${data.actionUrl}" class="button">Ver Follow-up</a>
        </div>
        <div class="footer">Egg Nunes Advogados - Sistema de Gestão Interna</div>
      </div>
    `,

    // Genérico
    generic: `
      ${baseStyles}
      <div class="container">
        <div class="header"><h1>${data.title || 'Notificação'}</h1></div>
        <div class="content">
          <p>Olá <strong>${data.userName}</strong>,</p>
          <p>${data.message}</p>
          ${data.actionUrl ? `<a href="${data.actionUrl}" class="button">Ver Mais</a>` : ''}
        </div>
        <div class="footer">Egg Nunes Advogados - Sistema de Gestão Interna</div>
      </div>
    `,
  };

  return templates[templateType] || templates.generic;
};

// Função para enviar email via API do Resend
async function sendEmailViaResend(to: string, subject: string, html: string): Promise<{ id?: string; error?: string }> {
  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
  
  if (!RESEND_API_KEY) {
    throw new Error("RESEND_API_KEY não configurada");
  }

  const fromEmail = Deno.env.get("RESEND_FROM_EMAIL") || "onboarding@resend.dev";
  const fromName = "Egg Nunes - Intranet";

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: `${fromName} <${fromEmail}>`,
      to: [to],
      subject: subject,
      html: html,
    }),
  });

  const result = await response.json();

  if (!response.ok) {
    console.error("[send-notification-email] Resend API error:", result);
    throw new Error(result.message || "Erro ao enviar email");
  }

  return { id: result.id };
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { to, toUserId, subject, templateType, data }: EmailRequest = await req.json();

    console.log(`[send-notification-email] Sending ${templateType} email to ${to}`);

    // Se temos um userId, verificar preferências
    if (toUserId) {
      const { data: prefs } = await supabaseClient
        .from("email_notification_preferences")
        .select("*")
        .eq("user_id", toUserId)
        .maybeSingle();

      if (prefs) {
        // Mapear template para preferência
        const templateToPreference: Record<string, string> = {
          task_assigned: "notify_tasks",
          task_due_soon: "notify_tasks",
          task_overdue: "notify_tasks",
          approval_requested: "notify_approvals",
          approval_approved: "notify_approvals",
          approval_rejected: "notify_approvals",
          financial_due: "notify_financial",
          announcement: "notify_announcements",
          vacation_approved: "notify_vacation",
          vacation_rejected: "notify_vacation",
          vacation_requested: "notify_vacation",
          birthday: "notify_birthdays",
          forum_reply: "notify_forum",
          new_message: "notify_messages",
          crm_deal_update: "notify_crm",
          crm_follow_up: "notify_crm",
        };

        const prefKey = templateToPreference[templateType];
        if (prefKey && prefs[prefKey] === false) {
          console.log(`[send-notification-email] User ${toUserId} has disabled ${prefKey}`);
          return new Response(
            JSON.stringify({ skipped: true, reason: "User preference disabled" }),
            { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
          );
        }
      }
    }

    // Gerar HTML do email
    const html = getEmailTemplate(templateType, data);

    // Enviar email via Resend
    const emailResponse = await sendEmailViaResend(to, subject, html);

    console.log("[send-notification-email] Email sent successfully:", emailResponse);

    // Registrar no log
    await supabaseClient.from("email_log").insert({
      user_id: toUserId || null,
      to_email: to,
      subject: subject,
      template_type: templateType,
      status: "sent",
      resend_id: emailResponse.id || null,
      metadata: { data },
      sent_at: new Date().toISOString(),
    });

    return new Response(JSON.stringify(emailResponse), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("[send-notification-email] Error:", error);

    // Tentar registrar erro no log
    try {
      const supabaseClient = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
      );

      const body = await req.clone().json().catch(() => ({}));
      await supabaseClient.from("email_log").insert({
        to_email: body.to || "unknown",
        subject: body.subject || "unknown",
        template_type: body.templateType || "unknown",
        status: "error",
        error_message: error.message,
      });
    } catch (logError) {
      console.error("[send-notification-email] Failed to log error:", logError);
    }

    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
