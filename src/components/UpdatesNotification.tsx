import { useState, useEffect } from 'react';
import { Bell } from 'lucide-react';
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

interface Update {
  id: string;
  title: string;
  description: string;
  category: string;
  created_at: string;
}

interface UpdateRead {
  update_id: string;
}

export const UpdatesNotification = () => {
  const { user } = useAuth();
  const [updates, setUpdates] = useState<Update[]>([]);
  const [readUpdates, setReadUpdates] = useState<string[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (user) {
      fetchUpdates();
      fetchReadUpdates();
    }
  }, [user]);

  const fetchUpdates = async () => {
    const { data } = await supabase
      .from('intranet_updates')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (data) {
      setUpdates(data);
    }
  };

  const fetchReadUpdates = async () => {
    if (!user) return;
    
    const { data } = await supabase
      .from('intranet_update_reads')
      .select('update_id')
      .eq('user_id', user.id);
    
    if (data) {
      setReadUpdates(data.map((r: UpdateRead) => r.update_id));
    }
  };

  const markAllAsRead = async () => {
    if (!user) return;
    
    const unreadUpdates = updates.filter(u => !readUpdates.includes(u.id));
    
    for (const update of unreadUpdates) {
      await supabase
        .from('intranet_update_reads')
        .insert({ update_id: update.id, user_id: user.id });
    }
    
    setReadUpdates(updates.map(u => u.id));
  };

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (open) {
      markAllAsRead();
    }
  };

  const unreadCount = updates.filter(u => !readUpdates.includes(u.id)).length;

  const getCategoryBadge = (category: string) => {
    const categories: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
      feature: { label: 'Nova Funcionalidade', variant: 'default' },
      improvement: { label: 'Melhoria', variant: 'secondary' },
      fix: { label: 'Correção', variant: 'outline' },
      update: { label: 'Atualização', variant: 'secondary' },
    };
    
    return categories[category] || { label: category, variant: 'outline' as const };
  };

  return (
    <Sheet open={isOpen} onOpenChange={handleOpenChange}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge 
              variant="destructive" 
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:w-[540px] sm:max-w-[540px]">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Atualizações da Intranet
          </SheetTitle>
          <SheetDescription>
            Acompanhe as novidades e melhorias do sistema
          </SheetDescription>
        </SheetHeader>
        <ScrollArea className="h-[calc(100vh-120px)] mt-4 pr-4">
          <div className="space-y-4">
            {updates.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                Nenhuma atualização disponível
              </p>
            ) : (
              updates.map((update) => {
                const isUnread = !readUpdates.includes(update.id);
                const categoryInfo = getCategoryBadge(update.category);
                
                return (
                  <div
                    key={update.id}
                    className={`p-4 rounded-lg border ${
                      isUnread ? 'bg-primary/5 border-primary/20' : 'bg-card'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h4 className="font-medium text-sm flex items-center gap-2">
                        {isUnread && (
                          <span className="h-2 w-2 rounded-full bg-primary" />
                        )}
                        {update.title}
                      </h4>
                      <Badge variant={categoryInfo.variant} className="text-xs shrink-0">
                        {categoryInfo.label}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">
                      {update.description}
                    </p>
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
