import { useState, useEffect } from 'react';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Settings, Save } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useUserRole } from '@/hooks/useUserRole';
import { RDStationWebhookManager } from '@/components/RDStationWebhookManager';

export default function AdvboxConfig() {
  const [cacheTtl, setCacheTtl] = useState(5);
  const [delay, setDelay] = useState(500);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const { isAdmin } = useUserRole();

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('advbox_settings')
        .select('*')
        .limit(1)
        .single();

      if (error) throw error;

      if (data) {
        setCacheTtl(data.cache_ttl_minutes);
        setDelay(data.delay_between_requests_ms);
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
      toast({
        title: 'Erro ao carregar configurações',
        description: 'Não foi possível carregar as configurações do Advbox.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!isAdmin) {
      toast({
        title: 'Sem permissão',
        description: 'Apenas administradores podem alterar as configurações.',
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);
    try {
      const { data: existingSettings } = await supabase
        .from('advbox_settings')
        .select('id')
        .limit(1)
        .single();

      if (existingSettings) {
        const { error } = await supabase
          .from('advbox_settings')
          .update({
            cache_ttl_minutes: cacheTtl,
            delay_between_requests_ms: delay,
            updated_by: (await supabase.auth.getUser()).data.user?.id,
          })
          .eq('id', existingSettings.id);

        if (error) throw error;
      }

      toast({
        title: 'Configurações salvas',
        description: 'As configurações foram atualizadas com sucesso. Recarregue as páginas do Advbox para aplicar.',
      });
    } catch (error) {
      console.error('Error saving settings:', error);
      toast({
        title: 'Erro ao salvar',
        description: 'Não foi possível salvar as configurações.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-muted-foreground">Carregando configurações...</div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6 max-w-2xl">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Settings className="h-8 w-8 text-primary" />
            Configurações do Advbox
          </h1>
          <p className="text-muted-foreground mt-2">
            Ajuste o cache e a velocidade das requisições à API do Advbox
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Cache e Requisições</CardTitle>
            <CardDescription>
              Configure o tempo de cache e o delay entre requisições para otimizar o desempenho e evitar limites da API
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="cache">Tempo de Cache (minutos)</Label>
              <Input
                id="cache"
                type="number"
                min="1"
                max="60"
                value={cacheTtl}
                onChange={(e) => setCacheTtl(Number(e.target.value))}
                disabled={!isAdmin}
              />
              <p className="text-sm text-muted-foreground">
                Quanto tempo os dados ficam armazenados em cache antes de serem buscados novamente (1-60 minutos)
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="delay">Delay Entre Requisições (ms)</Label>
              <Input
                id="delay"
                type="number"
                min="100"
                max="5000"
                step="100"
                value={delay}
                onChange={(e) => setDelay(Number(e.target.value))}
                disabled={!isAdmin}
              />
              <p className="text-sm text-muted-foreground">
                Tempo de espera entre requisições paginadas para evitar rate limit (100-5000ms)
              </p>
            </div>

            {!isAdmin && (
              <div className="bg-muted p-4 rounded-md">
                <p className="text-sm text-muted-foreground">
                  Apenas administradores podem alterar essas configurações.
                </p>
              </div>
            )}

            {isAdmin && (
              <Button onClick={handleSave} disabled={saving} className="w-full">
                <Save className="h-4 w-4 mr-2" />
                {saving ? 'Salvando...' : 'Salvar Configurações'}
              </Button>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Informações</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>
              <strong>Cache:</strong> Reduz a quantidade de requisições à API do Advbox, melhorando a velocidade e evitando limites.
            </p>
            <p>
              <strong>Delay:</strong> Previne erros 429 (Too Many Requests) ao paginar grandes volumes de dados.
            </p>
            <p className="text-muted-foreground mt-4">
              💡 Valores recomendados: Cache de 5 minutos e delay de 500ms para uso normal.
            </p>
          </CardContent>
        </Card>

        {isAdmin && <RDStationWebhookManager />}
      </div>
    </Layout>
  );
}
