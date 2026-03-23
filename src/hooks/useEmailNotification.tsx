import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface SendEmailParams {
  to: string;
  toUserId?: string;
  subject: string;
  templateType: string;
  data: Record<string, any>;
}

export const useEmailNotification = () => {
  const sendEmail = useCallback(async (params: SendEmailParams) => {
    try {
      const { data, error } = await supabase.functions.invoke('send-notification-email', {
        body: params,
      });

      if (error) {
        console.error('[useEmailNotification] Error sending email:', error);
        return { success: false, error };
      }

      if (data?.skipped) {
        console.log('[useEmailNotification] Email skipped:', data.reason);
        return { success: true, skipped: true };
      }

      return { success: true, data };
    } catch (error) {
      console.error('[useEmailNotification] Exception:', error);
      return { success: false, error };
    }
  }, []);

  // Funções de conveniência para cada tipo de notificação
  const sendTaskAssignedEmail = useCallback(async (
    to: string,
    toUserId: string,
    taskTitle: string,
    userName: string,
    dueDate?: string,
    description?: string
  ) => {
    return sendEmail({
      to,
      toUserId,
      subject: `📋 Nova Tarefa: ${taskTitle}`,
      templateType: 'task_assigned',
      data: { taskTitle, userName, dueDate, description, actionUrl: `${window.location.origin}/tarefas-advbox` }
    });
  }, [sendEmail]);

  const sendTaskDueSoonEmail = useCallback(async (
    to: string,
    toUserId: string,
    taskTitle: string,
    userName: string,
    dueDate: string
  ) => {
    return sendEmail({
      to,
      toUserId,
      subject: `⏰ Tarefa próxima do vencimento: ${taskTitle}`,
      templateType: 'task_due_soon',
      data: { taskTitle, userName, dueDate, actionUrl: `${window.location.origin}/tarefas-advbox` }
    });
  }, [sendEmail]);

  const sendTaskOverdueEmail = useCallback(async (
    to: string,
    toUserId: string,
    taskTitle: string,
    userName: string,
    dueDate: string
  ) => {
    return sendEmail({
      to,
      toUserId,
      subject: `🚨 Tarefa atrasada: ${taskTitle}`,
      templateType: 'task_overdue',
      data: { taskTitle, userName, dueDate, actionUrl: `${window.location.origin}/tarefas-advbox` }
    });
  }, [sendEmail]);

  const sendApprovalRequestedEmail = useCallback(async (
    to: string,
    toUserId: string,
    approverName: string,
    requesterName: string,
    title: string,
    value?: string
  ) => {
    return sendEmail({
      to,
      toUserId,
      subject: `📝 Solicitação de aprovação: ${title}`,
      templateType: 'approval_requested',
      data: { approverName, requesterName, title, value, actionUrl: `${window.location.origin}/financeiro` }
    });
  }, [sendEmail]);

  const sendApprovalResultEmail = useCallback(async (
    to: string,
    toUserId: string,
    userName: string,
    approverName: string,
    title: string,
    approved: boolean,
    reason?: string
  ) => {
    return sendEmail({
      to,
      toUserId,
      subject: approved ? `✅ Solicitação aprovada: ${title}` : `❌ Solicitação rejeitada: ${title}`,
      templateType: approved ? 'approval_approved' : 'approval_rejected',
      data: { userName, approverName, title, reason, comments: reason, actionUrl: `${window.location.origin}/financeiro` }
    });
  }, [sendEmail]);

  const sendFinancialDueEmail = useCallback(async (
    to: string,
    toUserId: string,
    userName: string,
    description: string,
    value: string,
    dueDate: string
  ) => {
    return sendEmail({
      to,
      toUserId,
      subject: `💰 Lançamento pendente: ${description}`,
      templateType: 'financial_due',
      data: { userName, description, value, dueDate, actionUrl: `${window.location.origin}/financeiro` }
    });
  }, [sendEmail]);

  const sendAnnouncementEmail = useCallback(async (
    to: string,
    toUserId: string,
    userName: string,
    title: string,
    content: string
  ) => {
    return sendEmail({
      to,
      toUserId,
      subject: `📢 Novo comunicado: ${title}`,
      templateType: 'announcement',
      data: { userName, title, content, actionUrl: `${window.location.origin}/mural-avisos` }
    });
  }, [sendEmail]);

  const sendVacationEmail = useCallback(async (
    to: string,
    toUserId: string,
    type: 'approved' | 'rejected' | 'requested',
    data: {
      userName?: string;
      approverName?: string;
      requesterName?: string;
      startDate: string;
      endDate: string;
      days?: number;
      reason?: string;
    }
  ) => {
    const subjects = {
      approved: `🏖️ Férias aprovadas`,
      rejected: `🏖️ Férias não aprovadas`,
      requested: `🏖️ Nova solicitação de férias`,
    };

    return sendEmail({
      to,
      toUserId,
      subject: subjects[type],
      templateType: `vacation_${type}`,
      data: { ...data, actionUrl: `${window.location.origin}/ferias` }
    });
  }, [sendEmail]);

  const sendBirthdayEmail = useCallback(async (
    to: string,
    toUserId: string,
    userName: string
  ) => {
    return sendEmail({
      to,
      toUserId,
      subject: `🎂 Feliz Aniversário, ${userName}!`,
      templateType: 'birthday',
      data: { userName }
    });
  }, [sendEmail]);

  const sendForumReplyEmail = useCallback(async (
    to: string,
    toUserId: string,
    userName: string,
    topicTitle: string,
    authorName: string,
    topicId: string
  ) => {
    return sendEmail({
      to,
      toUserId,
      subject: `💬 Nova resposta: ${topicTitle}`,
      templateType: 'forum_reply',
      data: { userName, topicTitle, authorName, actionUrl: `${window.location.origin}/forum/${topicId}` }
    });
  }, [sendEmail]);

  const sendNewMessageEmail = useCallback(async (
    to: string,
    toUserId: string,
    userName: string,
    senderName: string,
    preview: string
  ) => {
    return sendEmail({
      to,
      toUserId,
      subject: `✉️ Nova mensagem de ${senderName}`,
      templateType: 'new_message',
      data: { userName, senderName, preview, actionUrl: `${window.location.origin}/mensagens` }
    });
  }, [sendEmail]);

  const sendCRMDealUpdateEmail = useCallback(async (
    to: string,
    toUserId: string,
    userName: string,
    dealName: string,
    newStatus: string,
    value?: string
  ) => {
    return sendEmail({
      to,
      toUserId,
      subject: `📊 Negócio atualizado: ${dealName}`,
      templateType: 'crm_deal_update',
      data: { userName, dealName, newStatus, value, actionUrl: `${window.location.origin}/crm` }
    });
  }, [sendEmail]);

  const sendCRMFollowUpEmail = useCallback(async (
    to: string,
    toUserId: string,
    userName: string,
    title: string,
    contactName: string,
    reminderDate: string,
    notes?: string
  ) => {
    return sendEmail({
      to,
      toUserId,
      subject: `📞 Lembrete de follow-up: ${title}`,
      templateType: 'crm_follow_up',
      data: { userName, title, contactName, reminderDate, notes, actionUrl: `${window.location.origin}/crm` }
    });
  }, [sendEmail]);

  const sendGenericEmail = useCallback(async (
    to: string,
    toUserId: string | undefined,
    subject: string,
    userName: string,
    message: string,
    actionUrl?: string
  ) => {
    return sendEmail({
      to,
      toUserId,
      subject,
      templateType: 'generic',
      data: { userName, message, title: subject, actionUrl }
    });
  }, [sendEmail]);

  const sendIntranetUpdateEmail = useCallback(async (
    to: string,
    toUserId: string,
    userName: string,
    title: string,
    description: string,
    category: string
  ) => {
    return sendEmail({
      to,
      toUserId,
      subject: `🔄 Atualização da Intranet: ${title}`,
      templateType: 'intranet_update',
      data: { userName, title, description, category, actionUrl: `${window.location.origin}/dashboard` }
    });
  }, [sendEmail]);

  const sendAnnouncementUrgentEmail = useCallback(async (
    to: string,
    toUserId: string,
    userName: string,
    title: string,
    content: string
  ) => {
    return sendEmail({
      to,
      toUserId,
      subject: `🚨 Comunicado Urgente: ${title}`,
      templateType: 'announcement_urgent',
      data: { userName, title, content, actionUrl: `${window.location.origin}/mural-avisos` }
    });
  }, [sendEmail]);

  return {
    sendEmail,
    sendTaskAssignedEmail,
    sendTaskDueSoonEmail,
    sendTaskOverdueEmail,
    sendApprovalRequestedEmail,
    sendApprovalResultEmail,
    sendFinancialDueEmail,
    sendAnnouncementEmail,
    sendVacationEmail,
    sendBirthdayEmail,
    sendForumReplyEmail,
    sendNewMessageEmail,
    sendCRMDealUpdateEmail,
    sendCRMFollowUpEmail,
    sendGenericEmail,
    sendIntranetUpdateEmail,
    sendAnnouncementUrgentEmail,
  };
};
