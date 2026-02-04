import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

export const useStartConversation = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const startConversation = async (targetUserId: string, targetUserName?: string) => {
    if (!user) {
      toast.error('Você precisa estar logado para enviar mensagens');
      return;
    }

    if (targetUserId === user.id) {
      toast.error('Você não pode enviar mensagem para si mesmo');
      return;
    }

    try {
      // Check if 1-1 conversation already exists
      const { data: myParticipations } = await supabase
        .from('conversation_participants')
        .select('conversation_id')
        .eq('user_id', user.id);

      if (myParticipations && myParticipations.length > 0) {
        const conversationIds = myParticipations.map(p => p.conversation_id);

        // Get conversations that are not groups
        const { data: conversations } = await supabase
          .from('conversations')
          .select('id, is_group')
          .in('id', conversationIds)
          .eq('is_group', false);

        if (conversations) {
          for (const conv of conversations) {
            // Check if target user is in this conversation
            const { data: targetParticipation } = await supabase
              .from('conversation_participants')
              .select('id')
              .eq('conversation_id', conv.id)
              .eq('user_id', targetUserId)
              .maybeSingle();

            if (targetParticipation) {
              // Conversation already exists, navigate to it
              navigate('/mensagens', { state: { openConversation: conv.id } });
              return;
            }
          }
        }
      }

      // Create new conversation
      const { data: newConv, error: convError } = await supabase
        .from('conversations')
        .insert({
          is_group: false,
          created_by: user.id
        })
        .select()
        .single();

      if (convError) throw convError;

      // Add participants
      const { error: partError } = await supabase
        .from('conversation_participants')
        .insert([
          { conversation_id: newConv.id, user_id: user.id },
          { conversation_id: newConv.id, user_id: targetUserId }
        ]);

      if (partError) throw partError;

      // Navigate to the new conversation
      navigate('/mensagens', { state: { openConversation: newConv.id } });
      toast.success(`Conversa iniciada${targetUserName ? ` com ${targetUserName}` : ''}`);
    } catch (error: any) {
      console.error('Error starting conversation:', error);
      toast.error('Erro ao iniciar conversa: ' + error.message);
    }
  };

  return { startConversation };
};
