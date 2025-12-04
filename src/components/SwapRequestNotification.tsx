import { useState, useEffect } from 'react';
import { Bell, ArrowRightLeft, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Profile {
  id: string;
  full_name: string;
  avatar_url: string | null;
}

interface SwapRequest {
  id: string;
  requester_id: string;
  target_id: string;
  requester_original_date: string;
  target_original_date: string;
  status: string;
  created_at: string;
  requester_profile?: Profile;
}

interface SwapRequestNotificationProps {
  onClose?: () => void;
  onRespond?: () => void;
}

export const SwapRequestNotification = ({ onClose, onRespond }: SwapRequestNotificationProps) => {
  const [pendingRequests, setPendingRequests] = useState<SwapRequest[]>([]);
  const [showNotification, setShowNotification] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (!user) return;

    fetchPendingRequests();

    // Subscribe to real-time updates
    const channel = supabase
      .channel('swap_requests_notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'home_office_swap_requests',
          filter: `target_id=eq.${user.id}`,
        },
        (payload) => {
          // New swap request for this user
          fetchPendingRequests();
          setShowNotification(true);
          toast({
            title: 'Nova solicitação de troca',
            description: 'Você recebeu uma solicitação de troca de dia de home office.',
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const fetchPendingRequests = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('home_office_swap_requests')
      .select('*')
      .eq('target_id', user.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching swap requests:', error);
      return;
    }

    // Fetch requester profiles
    const requesterIds = [...new Set((data || []).map(r => r.requester_id))];
    let profiles: Record<string, Profile> = {};

    if (requesterIds.length > 0) {
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url')
        .in('id', requesterIds);

      profilesData?.forEach(p => {
        profiles[p.id] = p;
      });
    }

    const requestsWithProfiles = (data || []).map(r => ({
      ...r,
      requester_profile: profiles[r.requester_id],
    }));

    setPendingRequests(requestsWithProfiles);
    if (requestsWithProfiles.length > 0) {
      setShowNotification(true);
    }
  };

  const handleRespond = async (requestId: string, accept: boolean) => {
    try {
      const { error } = await supabase
        .from('home_office_swap_requests')
        .update({
          status: accept ? 'accepted' : 'rejected',
          responded_at: new Date().toISOString(),
        })
        .eq('id', requestId);

      if (error) throw error;

      toast({
        title: accept ? 'Troca aceita' : 'Troca recusada',
        description: accept
          ? 'A troca de dia foi aceita. Lembre-se de informar a administração.'
          : 'A solicitação de troca foi recusada.',
      });

      fetchPendingRequests();
      onRespond?.();
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message || 'Não foi possível processar a resposta.',
        variant: 'destructive',
      });
    }
  };

  const handleDismiss = () => {
    setShowNotification(false);
    onClose?.();
  };

  if (!showNotification || pendingRequests.length === 0) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-sm animate-in slide-in-from-bottom-4 fade-in duration-300">
      <Card className="border-primary/50 shadow-lg">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <ArrowRightLeft className="h-4 w-4 text-primary" />
              Solicitações de Troca
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={handleDismiss}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <CardDescription>
            Você tem {pendingRequests.length} solicitação(ões) pendente(s)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 max-h-[300px] overflow-auto">
          {pendingRequests.map(request => (
            <div
              key={request.id}
              className="p-3 rounded-lg border bg-muted/50 space-y-3"
            >
              <div className="flex items-center gap-2">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={request.requester_profile?.avatar_url || ''} />
                  <AvatarFallback>
                    {request.requester_profile?.full_name?.charAt(0) || '?'}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">
                    {request.requester_profile?.full_name || 'Usuário'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Solicita troca de dia
                  </p>
                </div>
              </div>
              
              <div className="text-xs space-y-1">
                <p>
                  <span className="text-muted-foreground">Seu dia:</span>{' '}
                  {format(new Date(request.target_original_date), "dd/MM/yyyy (EEEE)", { locale: ptBR })}
                </p>
                <p>
                  <span className="text-muted-foreground">Dia dele:</span>{' '}
                  {format(new Date(request.requester_original_date), "dd/MM/yyyy (EEEE)", { locale: ptBR })}
                </p>
              </div>

              <div className="flex gap-2">
                <Button
                  size="sm"
                  className="flex-1"
                  onClick={() => handleRespond(request.id, true)}
                >
                  Aceitar
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1"
                  onClick={() => handleRespond(request.id, false)}
                >
                  Recusar
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
};
