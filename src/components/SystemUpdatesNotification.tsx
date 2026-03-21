import { useState, useEffect } from 'react';
import { Sparkles, CheckCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface SystemUpdate {
  id: string;
  title: string;
  description: string | null;
  version: string | null;
  category: string;
  created_at: string;
}

export const SystemUpdatesNotification = () => {
  const { user } = useAuth();
  const [updates, setUpdates] = useState<SystemUpdate[]>([]);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (user) {
      fetchUpdates();
      fetchReadUpdates();
    }
  }, [user]);

  const fetchUpdates = async () => {
    const { data } = await supabase
      .from('system_updates')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);
    if (data) setUpdates(data);
  };

  const fetchReadUpdates = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('user_read_updates')
      .select('update_id')
      .eq('user_id', user.id);
    if (data) setReadIds(new Set(data.map((r) => r.update_id)));
  };

  const markAsRead = async (updateId: string) => {
    if (!user || readIds.has(updateId)) return;
    await supabase.from('user_read_updates').insert({ update_id: updateId, user_id: user.id });
    setReadIds((prev) => new Set([...prev, updateId]));
  };

  const markAllAsRead = async () => {
    if (!user) return;
    const unread = updates.filter((u) => !readIds.has(u.id));
    for (const u of unread) {
      await supabase.from('user_read_updates').insert({ update_id: u.id, user_id: user.id });
    }
    setReadIds(new Set(updates.map((u) => u.id)));
  };

  const unreadCount = updates.filter((u) => !readIds.has(u.id)).length;

  const getCategoryLabel = (category: string) => {
    const map: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' }> = {
      feature: { label: 'Nova Funcionalidade', variant: 'default' },
      improvement: { label: 'Melhoria', variant: 'secondary' },
      fix: { label: 'Correção', variant: 'outline' },
      update: { label: 'Atualização', variant: 'secondary' },
    };
    return map[category] || { label: category, variant: 'outline' as const };
  };

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Sparkles className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs animate-pulse"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-[400px] max-w-[90vw] sm:w-[540px] sm:max-w-[540px] z-[100]">
        <SheetHeader>
          <div className="flex items-center justify-between">
            <SheetTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5" />
              Atualizações do Sistema
            </SheetTitle>
            {unreadCount > 0 && (
              <Button variant="ghost" size="sm" onClick={markAllAsRead} className="text-xs gap-1">
                <CheckCheck className="h-4 w-4" />
                Marcar todas como lidas
              </Button>
            )}
          </div>
          <SheetDescription>Novidades, melhorias e correções do sistema</SheetDescription>
        </SheetHeader>
        <ScrollArea className="h-[calc(100vh-120px)] mt-4 pr-4">
          <div className="space-y-4">
            {updates.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                Nenhuma atualização disponível
              </p>
            ) : (
              updates.map((update) => {
                const isUnread = !readIds.has(update.id);
                const catInfo = getCategoryLabel(update.category);
                return (
                  <div
                    key={update.id}
                    className={`p-4 rounded-lg border cursor-pointer transition-all ${
                      isUnread
                        ? 'bg-primary/5 border-primary/20 hover:bg-primary/10'
                        : 'bg-card hover:bg-muted/50'
                    }`}
                    onClick={() => markAsRead(update.id)}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h4 className="font-medium text-sm flex items-center gap-2">
                        {isUnread && <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />}
                        {update.title}
                      </h4>
                      <div className="flex items-center gap-1 shrink-0">
                        {update.version && (
                          <Badge variant="outline" className="text-xs">
                            v{update.version}
                          </Badge>
                        )}
                        <Badge variant={catInfo.variant} className="text-xs">
                          {catInfo.label}
                        </Badge>
                      </div>
                    </div>
                    {update.description && (
                      <p className="text-sm text-muted-foreground mb-2">{update.description}</p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(update.created_at), "d 'de' MMMM 'de' yyyy", { locale: ptBR })}
                    </p>
                  </div>
                );
              })
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
};
