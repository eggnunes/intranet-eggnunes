import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { 
  Mail, 
  Bell, 
  CheckCircle2, 
  Calendar, 
  DollarSign, 
  Megaphone,
  Cake,
  MessageSquare,
  Users,
  Loader2,
  Save
} from 'lucide-react';

interface EmailPreferences {
  notify_tasks: boolean;
  notify_approvals: boolean;
  notify_financial: boolean;
  notify_announcements: boolean;
  notify_vacation: boolean;
  notify_birthdays: boolean;
  notify_forum: boolean;
  notify_messages: boolean;
  notify_crm: boolean;
}

const defaultPreferences: EmailPreferences = {
  notify_tasks: true,
  notify_approvals: true,
  notify_financial: true,
  notify_announcements: true,
  notify_vacation: true,
  notify_birthdays: false,
  notify_forum: true,
  notify_messages: true,
  notify_crm: true,
};

const preferenceConfig = [
  { key: 'notify_tasks', label: 'Tarefas', description: 'Novas tarefas, prazos próximos e atrasos', icon: CheckCircle2, color: 'text-blue-500' },
  { key: 'notify_approvals', label: 'Aprovações', description: 'Solicitações de aprovação e resultados', icon: Bell, color: 'text-purple-500' },
  { key: 'notify_financial', label: 'Financeiro', description: 'Vencimentos e alertas financeiros', icon: DollarSign, color: 'text-green-500' },
  { key: 'notify_announcements', label: 'Comunicados', description: 'Novos avisos e comunicados', icon: Megaphone, color: 'text-orange-500' },
  { key: 'notify_vacation', label: 'Férias', description: 'Solicitações e aprovações de férias', icon: Calendar, color: 'text-cyan-500' },
  { key: 'notify_birthdays', label: 'Aniversários', description: 'Lembretes de aniversários', icon: Cake, color: 'text-pink-500' },
  { key: 'notify_forum', label: 'Fórum', description: 'Respostas em tópicos que você participa', icon: MessageSquare, color: 'text-indigo-500' },
  { key: 'notify_messages', label: 'Mensagens', description: 'Novas mensagens diretas', icon: Mail, color: 'text-red-500' },
  { key: 'notify_crm', label: 'CRM', description: 'Atualizações de negócios e follow-ups', icon: Users, color: 'text-amber-500' },
];

export function EmailNotificationSettings() {
  const { user } = useAuth();
  const [preferences, setPreferences] = useState<EmailPreferences>(defaultPreferences);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [originalPreferences, setOriginalPreferences] = useState<EmailPreferences>(defaultPreferences);

  useEffect(() => {
    if (user) {
      fetchPreferences();
    }
  }, [user]);

  const fetchPreferences = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('email_notification_preferences')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        const prefs: EmailPreferences = {
          notify_tasks: data.notify_tasks ?? true,
          notify_approvals: data.notify_approvals ?? true,
          notify_financial: data.notify_financial ?? true,
          notify_announcements: data.notify_announcements ?? true,
          notify_vacation: data.notify_vacation ?? true,
          notify_birthdays: data.notify_birthdays ?? false,
          notify_forum: data.notify_forum ?? true,
          notify_messages: data.notify_messages ?? true,
          notify_crm: data.notify_crm ?? true,
        };
        setPreferences(prefs);
        setOriginalPreferences(prefs);
      }
    } catch (error) {
      console.error('Error fetching email preferences:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = (key: keyof EmailPreferences) => {
    setPreferences(prev => {
      const newPrefs = { ...prev, [key]: !prev[key] };
      setHasChanges(JSON.stringify(newPrefs) !== JSON.stringify(originalPreferences));
      return newPrefs;
    });
  };

  const handleSave = async () => {
    if (!user) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('email_notification_preferences')
        .upsert({
          user_id: user.id,
          ...preferences,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' });

      if (error) throw error;

      setOriginalPreferences(preferences);
      setHasChanges(false);
      toast.success('Preferências de email salvas com sucesso!');
    } catch (error) {
      console.error('Error saving email preferences:', error);
      toast.error('Erro ao salvar preferências');
    } finally {
      setSaving(false);
    }
  };

  const enabledCount = Object.values(preferences).filter(Boolean).length;

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Mail className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">Notificações por E-mail</CardTitle>
              <CardDescription>Escolha quais notificações deseja receber por e-mail</CardDescription>
            </div>
          </div>
          <Badge variant="secondary">
            {enabledCount} de {preferenceConfig.length} ativas
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4">
          {preferenceConfig.map((config, index) => {
            const Icon = config.icon;
            return (
              <div key={config.key}>
                {index > 0 && <Separator className="mb-4" />}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Icon className={`h-5 w-5 ${config.color}`} />
                    <div>
                      <Label htmlFor={config.key} className="font-medium cursor-pointer">
                        {config.label}
                      </Label>
                      <p className="text-sm text-muted-foreground">{config.description}</p>
                    </div>
                  </div>
                  <Switch
                    id={config.key}
                    checked={preferences[config.key as keyof EmailPreferences]}
                    onCheckedChange={() => handleToggle(config.key as keyof EmailPreferences)}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {hasChanges && (
          <div className="flex justify-end pt-4 border-t">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Salvar Preferências
                </>
              )}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
