import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
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
  Save,
  Lock
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
  notify_daily_digest: boolean;
  notify_intranet_updates: boolean;
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
  notify_daily_digest: true,
  notify_intranet_updates: true,
};

const preferenceConfig = [
  { key: 'notify_tasks', label: 'Tarefas', description: 'Novas tarefas, prazos próximos e atrasos', icon: CheckCircle2, color: 'text-blue-500', requiresAdmin: false },
  { key: 'notify_approvals', label: 'Aprovações', description: 'Solicitações de aprovação e resultados', icon: Bell, color: 'text-purple-500', requiresAdmin: false },
  { key: 'notify_financial', label: 'Financeiro', description: 'Vencimentos e alertas financeiros', icon: DollarSign, color: 'text-green-500', requiresAdmin: true },
  { key: 'notify_announcements', label: 'Comunicados', description: 'Novos avisos e comunicados', icon: Megaphone, color: 'text-orange-500', requiresAdmin: false },
  { key: 'notify_vacation', label: 'Férias', description: 'Solicitações e aprovações de férias', icon: Calendar, color: 'text-cyan-500', requiresAdmin: false },
  { key: 'notify_birthdays', label: 'Aniversários', description: 'Lembretes de aniversários', icon: Cake, color: 'text-pink-500', requiresAdmin: false },
  { key: 'notify_forum', label: 'Fórum', description: 'Respostas em tópicos que você participa', icon: MessageSquare, color: 'text-indigo-500', requiresAdmin: false },
  { key: 'notify_messages', label: 'Mensagens', description: 'Novas mensagens diretas', icon: Mail, color: 'text-red-500', requiresAdmin: false },
  { key: 'notify_crm', label: 'CRM', description: 'Atualizações de negócios e follow-ups', icon: Users, color: 'text-amber-500', requiresAdmin: true },
];

export function EmailNotificationSettings() {
  const { user } = useAuth();
  const { isAdmin, profile } = useUserRole();
  const [preferences, setPreferences] = useState<EmailPreferences>(defaultPreferences);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [originalPreferences, setOriginalPreferences] = useState<EmailPreferences>(defaultPreferences);
  const [hasFinancialPermission, setHasFinancialPermission] = useState(false);

  const isSocio = profile?.position === 'socio';
  const isAuthorized = isSocio || isAdmin;

  useEffect(() => {
    if (user) {
      fetchPreferences();
      checkFinancialPermission();
    }
  }, [user, isAdmin, isSocio]);

  const checkFinancialPermission = async () => {
    if (!user) return;
    
    if (isSocio || isAdmin) {
      setHasFinancialPermission(true);
      return;
    }

    // Check explicit financial permission
    const { data: permData } = await supabase
      .from('admin_permissions')
      .select('perm_financial')
      .eq('admin_user_id', user.id)
      .maybeSingle();

    setHasFinancialPermission(
      !!(permData && permData.perm_financial && permData.perm_financial !== 'none')
    );
  };

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
      // Force financial/CRM prefs to false if user doesn't have permission
      const prefsToSave = { ...preferences };
      if (!hasFinancialPermission) {
        prefsToSave.notify_financial = false;
        prefsToSave.notify_crm = false;
      }

      const { error } = await supabase
        .from('email_notification_preferences')
        .upsert({
          user_id: user.id,
          ...prefsToSave,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' });

      if (error) throw error;

      setPreferences(prefsToSave);
      setOriginalPreferences(prefsToSave);
      setHasChanges(false);
      toast.success('Preferências de email salvas com sucesso!');
    } catch (error) {
      console.error('Error saving email preferences:', error);
      toast.error('Erro ao salvar preferências');
    } finally {
      setSaving(false);
    }
  };

  const visibleConfigs = preferenceConfig.filter(config => {
    if (config.requiresAdmin && !hasFinancialPermission) return false;
    return true;
  });

  const enabledCount = visibleConfigs.filter(c => preferences[c.key as keyof EmailPreferences]).length;

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
            {enabledCount} de {visibleConfigs.length} ativas
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4">
          {visibleConfigs.map((config, index) => {
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