import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Copy, Plus, Trash2, Link2, Save, ExternalLink, Zap, Info } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface UTMCampaign {
  id: string;
  name: string;
  utm_source: string;
  utm_medium: string;
  utm_campaign: string;
  utm_content: string | null;
  utm_term: string | null;
  base_url: string;
  whatsapp_number: string | null;
  created_at: string;
}

const UTM_SOURCES = [
  { value: 'google', label: 'Google Ads' },
  { value: 'facebook', label: 'Facebook / Meta Ads' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'tiktok', label: 'TikTok' },
  { value: 'youtube', label: 'YouTube' },
  { value: 'email', label: 'Email Marketing' },
  { value: 'organic', label: 'Orgânico' },
  { value: 'referral', label: 'Indicação' },
];

const UTM_MEDIUMS = [
  { value: 'cpc', label: 'CPC (Custo por Clique)' },
  { value: 'cpm', label: 'CPM (Custo por Mil)' },
  { value: 'social', label: 'Social' },
  { value: 'email', label: 'Email' },
  { value: 'banner', label: 'Banner' },
  { value: 'video', label: 'Vídeo' },
  { value: 'organic', label: 'Orgânico' },
  { value: 'referral', label: 'Indicação' },
];

// Templates dinâmicos para plataformas de anúncios
const DYNAMIC_TEMPLATES = {
  meta: {
    name: 'Meta Ads (Facebook/Instagram)',
    description: 'Template com placeholders dinâmicos do Meta Ads. O Meta substitui automaticamente pelos valores reais quando o usuário clica no anúncio.',
    template: 'utm_source=facebook&utm_medium=cpc&utm_campaign={{campaign.name}}&utm_content={{adset.name}}&utm_term={{ad.name}}',
    placeholders: [
      { placeholder: '{{campaign.name}}', description: 'Nome da campanha' },
      { placeholder: '{{campaign.id}}', description: 'ID da campanha' },
      { placeholder: '{{adset.name}}', description: 'Nome do conjunto de anúncios' },
      { placeholder: '{{adset.id}}', description: 'ID do conjunto de anúncios' },
      { placeholder: '{{ad.name}}', description: 'Nome do anúncio' },
      { placeholder: '{{ad.id}}', description: 'ID do anúncio' },
      { placeholder: '{{placement}}', description: 'Posicionamento (feed, stories, etc.)' },
      { placeholder: '{{site_source_name}}', description: 'Facebook ou Instagram' },
    ],
    howToUse: [
      'Acesse o Gerenciador de Anúncios do Meta',
      'Crie ou edite um anúncio',
      'Na seção de destino, encontre "Parâmetros de URL"',
      'Cole o template no campo de parâmetros',
      'O Meta substituirá automaticamente os placeholders pelos valores reais',
    ],
  },
  google: {
    name: 'Google Ads',
    description: 'Template com parâmetros ValueTrack do Google Ads. O Google substitui automaticamente pelos valores reais quando o usuário clica no anúncio.',
    template: 'utm_source=google&utm_medium=cpc&utm_campaign={campaignid}&utm_content={adgroupid}&utm_term={keyword}',
    placeholders: [
      { placeholder: '{campaignid}', description: 'ID da campanha' },
      { placeholder: '{campaign}', description: 'Nome da campanha (se disponível)' },
      { placeholder: '{adgroupid}', description: 'ID do grupo de anúncios' },
      { placeholder: '{creative}', description: 'ID do criativo/anúncio' },
      { placeholder: '{keyword}', description: 'Palavra-chave (para campanhas de pesquisa)' },
      { placeholder: '{matchtype}', description: 'Tipo de correspondência (e=exata, p=frase, b=ampla)' },
      { placeholder: '{device}', description: 'Dispositivo (m=mobile, t=tablet, c=computador)' },
      { placeholder: '{network}', description: 'Rede (g=pesquisa Google, s=parceiros, d=display)' },
      { placeholder: '{loc_physical_ms}', description: 'Local físico do usuário' },
    ],
    howToUse: [
      'Acesse o Google Ads',
      'Vá em Configurações > Configurações da conta',
      'Ou edite uma campanha específica',
      'Adicione o template no "Sufixo de URL final" ou "Modelo de acompanhamento"',
      'O Google substituirá automaticamente os placeholders pelos valores reais',
    ],
  },
};

export function UTMGenerator() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [campaigns, setCampaigns] = useState<UTMCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [formData, setFormData] = useState({
    name: '',
    base_url: '',
    utm_source: '',
    utm_source_custom: '',
    utm_medium: '',
    utm_medium_custom: '',
    utm_campaign: '',
    utm_content: '',
    utm_term: '',
  });

  const [generatedUrl, setGeneratedUrl] = useState('');

  useEffect(() => {
    fetchCampaigns();
  }, []);

  useEffect(() => {
    generateUrl();
  }, [formData]);

  const fetchCampaigns = async () => {
    try {
      const { data, error } = await supabase
        .from('utm_campaigns')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setCampaigns(data || []);
    } catch (error) {
      console.error('Error fetching campaigns:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateUrl = () => {
    if (!formData.base_url) {
      setGeneratedUrl('');
      return;
    }

    try {
      const url = new URL(formData.base_url);
      const source = formData.utm_source === 'custom' ? formData.utm_source_custom : formData.utm_source;
      const medium = formData.utm_medium === 'custom' ? formData.utm_medium_custom : formData.utm_medium;

      if (source) url.searchParams.set('utm_source', source);
      if (medium) url.searchParams.set('utm_medium', medium);
      if (formData.utm_campaign) url.searchParams.set('utm_campaign', formData.utm_campaign);
      if (formData.utm_content) url.searchParams.set('utm_content', formData.utm_content);
      if (formData.utm_term) url.searchParams.set('utm_term', formData.utm_term);

      setGeneratedUrl(url.toString());
    } catch {
      setGeneratedUrl('URL inválida');
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: 'URL copiada!' });
    } catch {
      toast({ title: 'Erro ao copiar', variant: 'destructive' });
    }
  };

  const saveCampaign = async () => {
    if (!formData.name || !formData.base_url || !formData.utm_source || !formData.utm_medium || !formData.utm_campaign) {
      toast({ title: 'Preencha os campos obrigatórios', variant: 'destructive' });
      return;
    }

    try {
      const source = formData.utm_source === 'custom' ? formData.utm_source_custom : formData.utm_source;
      const medium = formData.utm_medium === 'custom' ? formData.utm_medium_custom : formData.utm_medium;

      const { error } = await supabase.from('utm_campaigns').insert({
        name: formData.name,
        base_url: formData.base_url,
        utm_source: source,
        utm_medium: medium,
        utm_campaign: formData.utm_campaign,
        utm_content: formData.utm_content || null,
        utm_term: formData.utm_term || null,
        created_by: user?.id,
      });

      if (error) throw error;

      toast({ title: 'Campanha salva!' });
      setFormData({
        name: '',
        base_url: '',
        utm_source: '',
        utm_source_custom: '',
        utm_medium: '',
        utm_medium_custom: '',
        utm_campaign: '',
        utm_content: '',
        utm_term: '',
      });
      fetchCampaigns();
    } catch (error) {
      console.error('Error saving campaign:', error);
      toast({ title: 'Erro ao salvar campanha', variant: 'destructive' });
    }
  };

  const deleteCampaign = async (id: string) => {
    try {
      const { error } = await supabase.from('utm_campaigns').delete().eq('id', id);
      if (error) throw error;
      toast({ title: 'Campanha removida' });
      fetchCampaigns();
    } catch (error) {
      console.error('Error deleting campaign:', error);
      toast({ title: 'Erro ao remover campanha', variant: 'destructive' });
    }
  };

  const loadCampaign = (campaign: UTMCampaign) => {
    const sourceMatch = UTM_SOURCES.find(s => s.value === campaign.utm_source);
    const mediumMatch = UTM_MEDIUMS.find(m => m.value === campaign.utm_medium);

    setFormData({
      name: campaign.name,
      base_url: campaign.base_url,
      utm_source: sourceMatch ? campaign.utm_source : 'custom',
      utm_source_custom: sourceMatch ? '' : campaign.utm_source,
      utm_medium: mediumMatch ? campaign.utm_medium : 'custom',
      utm_medium_custom: mediumMatch ? '' : campaign.utm_medium,
      utm_campaign: campaign.utm_campaign,
      utm_content: campaign.utm_content || '',
      utm_term: campaign.utm_term || '',
    });
  };

  const buildUrlFromCampaign = (campaign: UTMCampaign) => {
    try {
      const url = new URL(campaign.base_url);
      url.searchParams.set('utm_source', campaign.utm_source);
      url.searchParams.set('utm_medium', campaign.utm_medium);
      url.searchParams.set('utm_campaign', campaign.utm_campaign);
      if (campaign.utm_content) url.searchParams.set('utm_content', campaign.utm_content);
      if (campaign.utm_term) url.searchParams.set('utm_term', campaign.utm_term);
      return url.toString();
    } catch {
      return campaign.base_url;
    }
  };

  const copyToClipboardWithToast = async (text: string, message: string = 'Copiado!') => {
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: message });
    } catch {
      toast({ title: 'Erro ao copiar', variant: 'destructive' });
    }
  };

  const buildFullUrl = (baseUrl: string, params: string) => {
    if (!baseUrl) return params;
    try {
      const url = new URL(baseUrl);
      return `${url.origin}${url.pathname}?${params}`;
    } catch {
      return `${baseUrl}?${params}`;
    }
  };

  return (
    <div className="space-y-6">
      <Tabs defaultValue="dynamic" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="dynamic">Templates Dinâmicos</TabsTrigger>
          <TabsTrigger value="manual">Gerador Manual</TabsTrigger>
        </TabsList>

        {/* Templates Dinâmicos */}
        <TabsContent value="dynamic" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5" />
                Templates Dinâmicos para Anúncios
              </CardTitle>
              <CardDescription>
                Use estes templates para rastrear automaticamente de qual campanha, conjunto e anúncio cada lead veio.
                Os placeholders são substituídos automaticamente pela plataforma de anúncios.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {Object.entries(DYNAMIC_TEMPLATES).map(([key, template]) => (
                <div key={key} className="border rounded-lg p-4 space-y-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold text-lg">{template.name}</h3>
                      <p className="text-sm text-muted-foreground">{template.description}</p>
                    </div>
                    <Badge variant="secondary">{key === 'meta' ? 'Meta' : 'Google'}</Badge>
                  </div>

                  <div className="space-y-2">
                    <Label>Template de Parâmetros UTM:</Label>
                    <div className="flex gap-2">
                      <Textarea
                        readOnly
                        value={template.template}
                        className="font-mono text-sm bg-muted"
                        rows={2}
                      />
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => copyToClipboardWithToast(template.template, 'Template copiado!')}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>URL Base da sua Landing Page:</Label>
                    <Input
                      placeholder="https://seusite.com/landing-page"
                      id={`base-url-${key}`}
                      onChange={(e) => {
                        const input = e.target;
                        const preview = document.getElementById(`preview-${key}`);
                        if (preview) {
                          preview.textContent = buildFullUrl(input.value, template.template);
                        }
                      }}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>URL Completa para usar nos anúncios:</Label>
                    <div className="flex gap-2">
                      <Textarea
                        readOnly
                        id={`preview-${key}`}
                        className="font-mono text-xs bg-muted"
                        rows={2}
                        defaultValue={template.template}
                      />
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => {
                          const baseInput = document.getElementById(`base-url-${key}`) as HTMLInputElement;
                          const fullUrl = buildFullUrl(baseInput?.value || '', template.template);
                          copyToClipboardWithToast(fullUrl, 'URL completa copiada!');
                        }}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <Collapsible>
                    <CollapsibleTrigger asChild>
                      <Button variant="ghost" size="sm" className="flex items-center gap-2">
                        <Info className="h-4 w-4" />
                        Ver placeholders disponíveis e como usar
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="mt-4 space-y-4">
                      <div className="grid gap-2">
                        <Label className="text-sm font-medium">Placeholders disponíveis:</Label>
                        <div className="grid gap-1 text-sm">
                          {template.placeholders.map((p) => (
                            <div key={p.placeholder} className="flex items-center gap-2">
                              <code className="bg-muted px-2 py-0.5 rounded text-xs">{p.placeholder}</code>
                              <span className="text-muted-foreground">- {p.description}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="grid gap-2">
                        <Label className="text-sm font-medium">Como configurar:</Label>
                        <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
                          {template.howToUse.map((step, i) => (
                            <li key={i}>{step}</li>
                          ))}
                        </ol>
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Instructions Card */}
          <Card className="border-primary/20 bg-primary/5">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Info className="h-5 w-5" />
                Como funciona o rastreamento
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div>
                <p className="font-medium">1. Você usa o template nos seus anúncios</p>
                <p className="text-muted-foreground">Configure o template como parâmetros de URL no Meta Ads ou Google Ads.</p>
              </div>
              <div>
                <p className="font-medium">2. A plataforma substitui os valores</p>
                <p className="text-muted-foreground">Quando alguém clica no anúncio, o Meta/Google substitui os placeholders pelos valores reais (nome da campanha, conjunto, anúncio, etc.).</p>
              </div>
              <div>
                <p className="font-medium">3. O formulário captura automaticamente</p>
                <p className="text-muted-foreground">O formulário de captura da intranet lê esses parâmetros da URL e salva junto com os dados do lead.</p>
              </div>
              <div>
                <p className="font-medium">4. Você vê no Dashboard de Leads</p>
                <p className="text-muted-foreground">No painel de leads, você verá exatamente de qual campanha, conjunto e anúncio cada lead veio.</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Gerador Manual */}
        <TabsContent value="manual" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Link2 className="h-5 w-5" />
                Gerador Manual de URLs UTM
              </CardTitle>
              <CardDescription>
                Crie URLs rastreáveis manualmente para campanhas específicas
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome da Campanha *</Label>
                  <Input
                    id="name"
                    placeholder="Ex: Campanha Previdenciário Janeiro"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="base_url">URL Base (Landing Page) *</Label>
                  <Input
                    id="base_url"
                    placeholder="https://seusite.com/landing-page"
                    value={formData.base_url}
                    onChange={(e) => setFormData({ ...formData, base_url: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Origem (utm_source) *</Label>
                  <Select
                    value={formData.utm_source}
                    onValueChange={(value) => setFormData({ ...formData, utm_source: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="De onde vem o tráfego?" />
                    </SelectTrigger>
                    <SelectContent>
                      {UTM_SOURCES.map((source) => (
                        <SelectItem key={source.value} value={source.value}>
                          {source.label}
                        </SelectItem>
                      ))}
                      <SelectItem value="custom">Outro (personalizado)</SelectItem>
                    </SelectContent>
                  </Select>
                  {formData.utm_source === 'custom' && (
                    <Input
                      placeholder="Digite a origem personalizada"
                      value={formData.utm_source_custom}
                      onChange={(e) => setFormData({ ...formData, utm_source_custom: e.target.value })}
                    />
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Mídia (utm_medium) *</Label>
                  <Select
                    value={formData.utm_medium}
                    onValueChange={(value) => setFormData({ ...formData, utm_medium: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Tipo de campanha" />
                    </SelectTrigger>
                    <SelectContent>
                      {UTM_MEDIUMS.map((medium) => (
                        <SelectItem key={medium.value} value={medium.value}>
                          {medium.label}
                        </SelectItem>
                      ))}
                      <SelectItem value="custom">Outro (personalizado)</SelectItem>
                    </SelectContent>
                  </Select>
                  {formData.utm_medium === 'custom' && (
                    <Input
                      placeholder="Digite a mídia personalizada"
                      value={formData.utm_medium_custom}
                      onChange={(e) => setFormData({ ...formData, utm_medium_custom: e.target.value })}
                    />
                  )}
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="utm_campaign">Campanha (utm_campaign) *</Label>
                  <Input
                    id="utm_campaign"
                    placeholder="Ex: previdenciario_janeiro_2025"
                    value={formData.utm_campaign}
                    onChange={(e) => setFormData({ ...formData, utm_campaign: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground">Nome identificador da campanha</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="utm_content">Conteúdo (utm_content)</Label>
                  <Input
                    id="utm_content"
                    placeholder="Ex: video_aposentadoria"
                    value={formData.utm_content}
                    onChange={(e) => setFormData({ ...formData, utm_content: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground">Identifica o anúncio específico</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="utm_term">Termo (utm_term)</Label>
                  <Input
                    id="utm_term"
                    placeholder="Ex: aposentadoria especial"
                    value={formData.utm_term}
                    onChange={(e) => setFormData({ ...formData, utm_term: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground">Palavra-chave (para Google Ads)</p>
                </div>
              </div>

              {generatedUrl && generatedUrl !== 'URL inválida' && (
                <div className="space-y-2 p-4 bg-muted rounded-lg">
                  <Label>URL Gerada:</Label>
                  <div className="flex gap-2">
                    <Textarea
                      readOnly
                      value={generatedUrl}
                      className="font-mono text-sm"
                      rows={2}
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => copyToClipboard(generatedUrl)}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                <Button onClick={saveCampaign} className="flex items-center gap-2">
                  <Save className="h-4 w-4" />
                  Salvar Campanha
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Saved Campaigns */}
          <Card>
            <CardHeader>
              <CardTitle>Campanhas Salvas</CardTitle>
              <CardDescription>
                Clique em uma campanha para carregar ou copiar a URL
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <p className="text-muted-foreground">Carregando...</p>
              ) : campaigns.length === 0 ? (
                <p className="text-muted-foreground">Nenhuma campanha salva</p>
              ) : (
                <div className="space-y-3">
                  {campaigns.map((campaign) => (
                    <div
                      key={campaign.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium truncate">{campaign.name}</span>
                          <Badge variant="secondary">{campaign.utm_source}</Badge>
                          <Badge variant="outline">{campaign.utm_medium}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground truncate mt-1">
                          {campaign.utm_campaign}
                        </p>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => loadCampaign(campaign)}
                        >
                          Carregar
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => copyToClipboard(buildUrlFromCampaign(campaign))}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => window.open(buildUrlFromCampaign(campaign), '_blank')}
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteCampaign(campaign.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
