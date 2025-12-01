import { useState, useEffect } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { AlertTriangle, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { useUserRole } from '@/hooks/useUserRole';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface FailedMessage {
  id: string;
  customer_name: string;
  customer_phone: string;
  error_message: string;
  created_at: string;
}

export function BirthdayMessageFailuresAlert() {
  const [failures, setFailures] = useState<FailedMessage[]>([]);
  const [dismissed, setDismissed] = useState(false);
  const navigate = useNavigate();
  const { isAdmin } = useUserRole();

  useEffect(() => {
    if (!isAdmin) return;
    
    fetchRecentFailures();
    
    // Poll para atualizar falhas a cada 5 minutos
    const interval = setInterval(fetchRecentFailures, 5 * 60 * 1000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  const fetchRecentFailures = async () => {
    try {
      // Buscar falhas das últimas 24 horas
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      const { data, error } = await supabase
        .from('chatguru_birthday_messages_log')
        .select('*')
        .eq('status', 'failed')
        .gte('created_at', yesterday.toISOString())
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) {
        console.error('Error fetching failures:', error);
        return;
      }

      setFailures(data || []);
    } catch (error) {
      console.error('Error fetching birthday message failures:', error);
    }
  };

  const handleDismiss = () => {
    setDismissed(true);
  };

  const handleViewHistory = () => {
    navigate('/historico-mensagens-aniversario');
  };

  // Não mostrar para não-admins
  if (!isAdmin) {
    return null;
  }

  if (failures.length === 0 || dismissed) {
    return null;
  }

  return (
    <Alert variant="destructive" className="relative">
      <AlertTriangle className="h-4 w-4" />
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-2 right-2 h-6 w-6"
        onClick={handleDismiss}
      >
        <X className="h-4 w-4" />
      </Button>
      <AlertTitle>Falhas no Envio de Mensagens de Aniversário</AlertTitle>
      <AlertDescription className="mt-2">
        <p className="mb-2">
          {failures.length} {failures.length === 1 ? 'mensagem falhou' : 'mensagens falharam'} nas últimas 24 horas.
        </p>
        <div className="space-y-1 mb-3 max-h-32 overflow-y-auto">
          {failures.slice(0, 3).map((failure) => (
            <div key={failure.id} className="text-sm border-l-2 border-destructive/50 pl-2">
              <p className="font-medium">{failure.customer_name}</p>
              <p className="text-xs text-muted-foreground">
                {format(new Date(failure.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
              </p>
              {failure.error_message && (
                <p className="text-xs text-muted-foreground truncate">
                  Erro: {failure.error_message}
                </p>
              )}
            </div>
          ))}
          {failures.length > 3 && (
            <p className="text-xs text-muted-foreground">
              E mais {failures.length - 3} {failures.length - 3 === 1 ? 'falha' : 'falhas'}...
            </p>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleViewHistory}
          className="bg-background"
        >
          Ver Histórico Completo
        </Button>
      </AlertDescription>
    </Alert>
  );
}

