import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Copy, Plus, Trash2, FileText, Code, Eye, EyeOff, ExternalLink } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface LeadForm {
  id: string;
  name: string;
  campaign_id: string | null;
  whatsapp_number: string;
  whatsapp_message: string;
  redirect_to_whatsapp: boolean;
  is_active: boolean;
  created_at: string;
}

export function LeadFormsManager() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [forms, setForms] = useState<LeadForm[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedForm, setSelectedForm] = useState<LeadForm | null>(null);
  const [showEmbedCode, setShowEmbedCode] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    whatsapp_number: '',
    whatsapp_message: 'Olá! Meu nome é {nome}. Gostaria de mais informações.',
    redirect_to_whatsapp: true,
  });

  useEffect(() => {
    fetchForms();
  }, []);

  const fetchForms = async () => {
    try {
      const { data, error } = await supabase
        .from('lead_capture_forms')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setForms(data || []);
    } catch (error) {
      console.error('Error fetching forms:', error);
    } finally {
      setLoading(false);
    }
  };

  const createForm = async () => {
    if (!formData.name || !formData.whatsapp_number) {
      toast({ title: 'Preencha nome e número do WhatsApp', variant: 'destructive' });
      return;
    }

    try {
      const { error } = await supabase.from('lead_capture_forms').insert({
        name: formData.name,
        whatsapp_number: formData.whatsapp_number,
        whatsapp_message: formData.whatsapp_message,
        redirect_to_whatsapp: formData.redirect_to_whatsapp,
        created_by: user?.id,
      });

      if (error) throw error;

      toast({ title: 'Formulário criado!' });
      setShowCreateDialog(false);
      setFormData({
        name: '',
        whatsapp_number: '',
        whatsapp_message: 'Olá! Meu nome é {nome}. Gostaria de mais informações.',
        redirect_to_whatsapp: true,
      });
      fetchForms();
    } catch (error) {
      console.error('Error creating form:', error);
      toast({ title: 'Erro ao criar formulário', variant: 'destructive' });
    }
  };

  const toggleFormActive = async (form: LeadForm) => {
    try {
      const { error } = await supabase
        .from('lead_capture_forms')
        .update({ is_active: !form.is_active })
        .eq('id', form.id);

      if (error) throw error;
      toast({ title: form.is_active ? 'Formulário desativado' : 'Formulário ativado' });
      fetchForms();
    } catch (error) {
      console.error('Error toggling form:', error);
      toast({ title: 'Erro ao atualizar formulário', variant: 'destructive' });
    }
  };

  const deleteForm = async (id: string) => {
    try {
      const { error } = await supabase.from('lead_capture_forms').delete().eq('id', id);
      if (error) throw error;
      toast({ title: 'Formulário removido' });
      fetchForms();
    } catch (error) {
      console.error('Error deleting form:', error);
      toast({ title: 'Erro ao remover formulário', variant: 'destructive' });
    }
  };

  const generateEmbedCode = (form: LeadForm) => {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    
    return `<!-- Formulário de Captura de Leads - ${form.name} -->
<style>
  .lead-form-container {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    max-width: 400px;
    margin: 0 auto;
    padding: 24px;
    background: #fff;
    border-radius: 12px;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  }
  .lead-form-container h3 {
    margin: 0 0 16px;
    font-size: 1.25rem;
    text-align: center;
  }
  .lead-form-container .form-group {
    margin-bottom: 16px;
  }
  .lead-form-container label {
    display: block;
    margin-bottom: 4px;
    font-weight: 500;
    font-size: 14px;
  }
  .lead-form-container input {
    width: 100%;
    padding: 12px;
    border: 1px solid #ddd;
    border-radius: 8px;
    font-size: 16px;
    box-sizing: border-box;
  }
  .lead-form-container input:focus {
    outline: none;
    border-color: #25D366;
  }
  .lead-form-container button {
    width: 100%;
    padding: 14px;
    background: #25D366;
    color: white;
    border: none;
    border-radius: 8px;
    font-size: 16px;
    font-weight: 600;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
  }
  .lead-form-container button:hover {
    background: #128C7E;
  }
  .lead-form-container button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
</style>

<div class="lead-form-container">
  <h3>Fale Conosco</h3>
  <form id="lead-form-${form.id}">
    <div class="form-group">
      <label for="name-${form.id}">Nome *</label>
      <input type="text" id="name-${form.id}" name="name" required placeholder="Seu nome completo">
    </div>
    <div class="form-group">
      <label for="phone-${form.id}">Telefone *</label>
      <input type="tel" id="phone-${form.id}" name="phone" required placeholder="(00) 00000-0000">
    </div>
    <div class="form-group">
      <label for="email-${form.id}">E-mail</label>
      <input type="email" id="email-${form.id}" name="email" placeholder="seu@email.com">
    </div>
    <button type="submit" id="submit-btn-${form.id}">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
      </svg>
      Falar no WhatsApp
    </button>
  </form>
</div>

<script>
(function() {
  const form = document.getElementById('lead-form-${form.id}');
  const submitBtn = document.getElementById('submit-btn-${form.id}');
  
  // Captura UTMs da URL
  const urlParams = new URLSearchParams(window.location.search);
  
  form.addEventListener('submit', async function(e) {
    e.preventDefault();
    submitBtn.disabled = true;
    submitBtn.innerHTML = 'Enviando...';
    
    const formData = new FormData(form);
    
    try {
      const response = await fetch('${supabaseUrl}/functions/v1/capture-lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          form_id: '${form.id}',
          name: formData.get('name'),
          email: formData.get('email'),
          phone: formData.get('phone'),
          utm_source: urlParams.get('utm_source'),
          utm_medium: urlParams.get('utm_medium'),
          utm_campaign: urlParams.get('utm_campaign'),
          utm_content: urlParams.get('utm_content'),
          utm_term: urlParams.get('utm_term'),
          landing_page: window.location.href,
          referrer: document.referrer,
          user_agent: navigator.userAgent
        })
      });
      
      const result = await response.json();
      
      if (result.whatsapp_url) {
        window.open(result.whatsapp_url, '_blank');
      }
      
      form.reset();
      submitBtn.innerHTML = 'Enviado! ✓';
      setTimeout(() => {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg> Falar no WhatsApp';
      }, 3000);
      
    } catch (error) {
      console.error('Error:', error);
      submitBtn.disabled = false;
      submitBtn.innerHTML = 'Erro. Tente novamente.';
    }
  });
})();
</script>`;
  };

  const copyEmbedCode = (form: LeadForm) => {
    const code = generateEmbedCode(form);
    navigator.clipboard.writeText(code);
    toast({ title: 'Código copiado!' });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Formulários de Captura
            </CardTitle>
            <CardDescription>
              Crie formulários para incorporar em suas landing pages
            </CardDescription>
          </div>
          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Novo Formulário
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Criar Novo Formulário</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                {/* Campos que serão coletados */}
                <div className="p-3 bg-muted rounded-lg space-y-2">
                  <Label className="text-sm font-semibold">Campos que o lead irá preencher:</Label>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline" className="bg-background">Nome *</Badge>
                    <Badge variant="outline" className="bg-background">Telefone *</Badge>
                    <Badge variant="outline" className="bg-background">E-mail</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    * Campos obrigatórios. Além disso, são capturados automaticamente: UTM parameters, URL da página, referrer.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Nome do Formulário *</Label>
                  <Input
                    placeholder="Ex: Formulário Landing Previdenciário"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Número do WhatsApp *</Label>
                  <Input
                    placeholder="5531999999999"
                    value={formData.whatsapp_number}
                    onChange={(e) => setFormData({ ...formData, whatsapp_number: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground">
                    Formato: código do país + DDD + número (sem espaços ou traços)
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Mensagem do WhatsApp</Label>
                  <Textarea
                    placeholder="Olá! Meu nome é {nome}..."
                    value={formData.whatsapp_message}
                    onChange={(e) => setFormData({ ...formData, whatsapp_message: e.target.value })}
                    rows={3}
                  />
                  <p className="text-xs text-muted-foreground">
                    Use {'{nome}'} e {'{telefone}'} para inserir os dados do lead
                  </p>
                </div>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Redirecionar para WhatsApp</Label>
                    <p className="text-xs text-muted-foreground">
                      Abrir WhatsApp após envio do formulário
                    </p>
                  </div>
                  <Switch
                    checked={formData.redirect_to_whatsapp}
                    onCheckedChange={(checked) => setFormData({ ...formData, redirect_to_whatsapp: checked })}
                  />
                </div>
                <Button onClick={createForm} className="w-full">
                  Criar Formulário
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground">Carregando...</p>
          ) : forms.length === 0 ? (
            <p className="text-muted-foreground">Nenhum formulário criado</p>
          ) : (
            <div className="space-y-3">
              {forms.map((form) => (
                <div
                  key={form.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 border rounded-lg"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{form.name}</span>
                      <Badge variant={form.is_active ? 'default' : 'secondary'}>
                        {form.is_active ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      WhatsApp: {form.whatsapp_number}
                    </p>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => toggleFormActive(form)}
                    >
                      {form.is_active ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </Button>
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedForm(form)}
                        >
                          <Code className="h-4 w-4" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                          <DialogTitle>Formulário - {form.name}</DialogTitle>
                        </DialogHeader>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          {/* Preview Visual */}
                          <div className="space-y-3">
                            <Label className="text-sm font-semibold">Preview do Formulário</Label>
                            <div className="border rounded-lg p-4 bg-white">
                              <div className="max-w-[350px] mx-auto p-6 bg-white rounded-xl shadow-lg">
                                <h3 className="text-lg font-semibold text-center text-gray-800 mb-4">Fale Conosco</h3>
                                <div className="space-y-4">
                                  <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Nome *</label>
                                    <input 
                                      type="text" 
                                      placeholder="Seu nome completo"
                                      className="w-full px-3 py-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-green-500"
                                      disabled
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Telefone *</label>
                                    <input 
                                      type="tel" 
                                      placeholder="(00) 00000-0000"
                                      className="w-full px-3 py-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-green-500"
                                      disabled
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">E-mail</label>
                                    <input 
                                      type="email" 
                                      placeholder="seu@email.com"
                                      className="w-full px-3 py-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-green-500"
                                      disabled
                                    />
                                  </div>
                                  <button 
                                    className="w-full py-3 bg-[#25D366] hover:bg-[#128C7E] text-white font-semibold rounded-lg flex items-center justify-center gap-2 transition-colors"
                                    disabled
                                  >
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                                    </svg>
                                    Falar no WhatsApp
                                  </button>
                                </div>
                              </div>
                            </div>
                            <p className="text-xs text-muted-foreground text-center">
                              Este é o visual padrão. Você pode personalizar o CSS no código embed.
                            </p>
                          </div>

                          {/* Código Embed */}
                          <div className="space-y-3">
                            <Label className="text-sm font-semibold">Código para Incorporar</Label>
                            <p className="text-xs text-muted-foreground">
                              Copie e cole no HTML da sua landing page.
                            </p>
                            <div className="relative">
                              <Textarea
                                readOnly
                                value={generateEmbedCode(form)}
                                className="font-mono text-xs h-[380px]"
                              />
                              <Button
                                size="sm"
                                className="absolute top-2 right-2"
                                onClick={() => copyEmbedCode(form)}
                              >
                                <Copy className="h-4 w-4 mr-2" />
                                Copiar
                              </Button>
                            </div>
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteForm(form.id)}
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

      {/* Instructions Card */}
      <Card>
        <CardHeader>
          <CardTitle>Como Incorporar os Formulários no seu Site</CardTitle>
          <CardDescription>
            Siga os passos abaixo para adicionar o formulário de captura na sua landing page
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div className="border-l-4 border-primary pl-4 space-y-2">
              <h4 className="font-semibold">Passo 1: Crie o formulário</h4>
              <p className="text-sm text-muted-foreground">
                Clique em "Novo Formulário" acima, configure o número do WhatsApp e a mensagem que o lead enviará.
              </p>
            </div>

            <div className="border-l-4 border-primary pl-4 space-y-2">
              <h4 className="font-semibold">Passo 2: Copie o código de incorporação</h4>
              <p className="text-sm text-muted-foreground">
                Clique no ícone de código {"</>"} no formulário criado e copie todo o conteúdo (HTML + CSS + JavaScript).
              </p>
            </div>

            <div className="border-l-4 border-primary pl-4 space-y-2">
              <h4 className="font-semibold">Passo 3: Cole na sua landing page</h4>
              <p className="text-sm text-muted-foreground">
                Cole o código no local onde deseja que o formulário apareça. Funciona em qualquer site: WordPress, Wix, HTML puro, etc.
              </p>
              <div className="bg-muted p-3 rounded-lg text-xs font-mono">
                <p className="text-muted-foreground mb-2">Exemplo de onde colar no HTML:</p>
                <code>{`<body>`}</code><br />
                <code className="ml-4">{`<div id="secao-contato">`}</code><br />
                <code className="ml-8 text-primary">{`<!-- COLE O CÓDIGO DO FORMULÁRIO AQUI -->`}</code><br />
                <code className="ml-4">{`</div>`}</code><br />
                <code>{`</body>`}</code>
              </div>
            </div>

            <div className="border-l-4 border-primary pl-4 space-y-2">
              <h4 className="font-semibold">Passo 4: Configure os parâmetros UTM nos anúncios</h4>
              <p className="text-sm text-muted-foreground">
                Use os templates dinâmicos do Gerador de UTM. O formulário captura automaticamente os parâmetros da URL.
              </p>
            </div>
          </div>

          <div className="bg-muted/50 p-4 rounded-lg space-y-2">
            <h4 className="font-semibold text-sm">O que acontece quando um lead preenche o formulário?</h4>
            <ol className="list-decimal list-inside text-sm text-muted-foreground space-y-1">
              <li>Os dados do lead são salvos no banco de dados da intranet</li>
              <li>O lead é sincronizado automaticamente com o RD Station</li>
              <li>Se configurado, o WhatsApp abre com a mensagem pré-preenchida</li>
              <li>Você vê todos os dados no Dashboard de Leads, incluindo a origem (campanha, anúncio, etc.)</li>
            </ol>
          </div>

          <div className="bg-yellow-500/10 border border-yellow-500/20 p-4 rounded-lg space-y-2">
            <h4 className="font-semibold text-sm flex items-center gap-2">
              <ExternalLink className="h-4 w-4" />
              Dica para WordPress
            </h4>
            <p className="text-sm text-muted-foreground">
              Use um bloco "HTML Personalizado" ou o plugin "Insert Headers and Footers" para adicionar o código. 
              Se estiver usando Elementor, use o widget "HTML".
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
