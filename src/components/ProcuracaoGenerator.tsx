import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { 
  Scale, 
  Loader2, 
  Sparkles, 
  FileText,
  Download,
  Save,
  Trash2,
  Plus,
  Eye
} from "lucide-react";
import { jsPDF } from "jspdf";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import logoEggnunes from "@/assets/logo-eggnunes.png";

interface Client {
  id: number;
  nomeCompleto: string;
  cpf: string;
  documentoIdentidade: string;
  dataNascimento: string;
  estadoCivil: string;
  profissao: string;
  telefone: string;
  email: string;
  cep: string;
  cidade: string;
  rua: string;
  numero: string;
  complemento: string;
  bairro: string;
  estado: string;
}

interface ProcuracaoGeneratorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client: Client | null;
  qualification: string;
  objetoContrato?: string;
}

interface PowerTemplate {
  id: string;
  name: string;
  description: string;
  is_default?: boolean;
}

// Lista de advogados conforme modelo oficial da procuração (EXATAMENTE como no modelo)
const ADVOGADOS_OFICIAIS = [
  { nome: "GUILHERME ZARDO DA ROCHA", nacionalidade: "brasileiro", estadoCivil: "casado", oab: "advogado inscrito na OAB/MG sob o n. 93.714" },
  { nome: "MARCOS LUIZ EGG NUNES", nacionalidade: "brasileiro", estadoCivil: "casado", oab: "advogado inscrito na OAB/MG sob o n. 115.283" },
  { nome: "RAFAEL EGG NUNES", nacionalidade: "brasileiro", estadoCivil: "casado", oab: "advogado inscrito na OAB/MG sob o n. 118.395" },
  { nome: "MARCOS GERALDO NUNES", nacionalidade: "brasileiro", estadoCivil: "casado", oab: "advogado inscrito na OAB/MG sob o n. 75.904" },
  { nome: "MARIANA ALVES AMORIM CORRÊA FULGÊNCIO", nacionalidade: "brasileira", estadoCivil: "casada", oab: "advogada inscrita na OAB/MG sob o n. 140.619" },
  { nome: "MARIA CECILIA BELO", nacionalidade: "brasileira", estadoCivil: "solteira", oab: "advogada inscrita na OAB/MG sob o n.179.649" },
  { nome: "WENMISON JOSÉ DA SILVA RODRIGUES", nacionalidade: "brasileiro", estadoCivil: "casado", oab: "advogado inscrito na OAB/MG sob o n. 207.900" },
  { nome: "NÁGILA RODRIGUES", nacionalidade: "brasileira", estadoCivil: "solteira", oab: "advogada inscrita na OAB/SP sob o n. 421.746" },
  { nome: "KARISTON RICHARD SOARES COELHO", nacionalidade: "brasileiro", estadoCivil: "solteiro", oab: "advogado inscrito na OAB/MG sob o n. 231.047" },
  { nome: "RAFAEL FELIPPE MONTI", nacionalidade: "brasileiro", estadoCivil: "solteiro", oab: "advogado inscrito na OAB/MG sob o nº 232.112" },
  { nome: "JÚLIA MOARES DUTRA PEDRA", nacionalidade: "brasileira", estadoCivil: "solteira", oab: "advogada inscrita na OAB/MG sob o n. 199.902" },
  { nome: "JORDÂNIA LUÍZE GUEDES ALMEIDA", nacionalidade: "brasileira", estadoCivil: "solteira", oab: "advogada inscrita na OAB/MG sob o n. 239.069" },
  { nome: "LUDMILA NICEA MATOS DE MAGALHÃES SILVA FIALHO", nacionalidade: "brasileira", estadoCivil: "casada", oab: "advogada inscrita na OAB/MG sob o n. 153.142" },
  { nome: "JENNIFER KAROLINE DARIO DE SÁ", nacionalidade: "brasileira", estadoCivil: "solteira", oab: "advogada inscrita na OAB/MG sob o n. 202.042" },
];

// Endereço do escritório conforme modelo oficial
const ENDERECO_ESCRITORIO = "Rua São Paulo, nº 1.104, 9º andar, nesta capital";

// Texto do corpo da procuração conforme modelo oficial (EXATAMENTE como no modelo)
const TEXTO_PODERES = `aos quais confere(m) os poderes da cláusula "ad judicia", para defesa dos direitos ou interesses do(a) Outorgante perante instância judicial ou administrativa, podendo, para tanto, requerer e assinar o que for necessário, representar o(a) Outorgante junto às repartições públicas, ingressar em juízo como Autor(a), promover as ações ou medidas cautelares que entender cabíveis, arguir exceções, transigir, desistir, renunciar, receber e dar quitação, interpor e seguir os recursos legais, assinar declaração de hipossuficiência econômica, bem como fazer tudo mais que necessário for ao completo desempenho do presente mandato, para o qual lhe são outorgados amplos poderes, inclusive o substabelecimento.`;

export const ProcuracaoGenerator = ({ 
  open, 
  onOpenChange, 
  client, 
  qualification,
  objetoContrato 
}: ProcuracaoGeneratorProps) => {
  const [temPoderesEspeciais, setTemPoderesEspeciais] = useState(false);
  const [poderesEspeciais, setPoderesEspeciais] = useState("");
  const [gerandoPoderes, setGerandoPoderes] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [previewText, setPreviewText] = useState("");
  const [gerandoPDF, setGerandoPDF] = useState(false);
  
  // Templates de poderes especiais
  const [templates, setTemplates] = useState<PowerTemplate[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [showSaveTemplate, setShowSaveTemplate] = useState(false);
  const [showCreateDefaultTemplate, setShowCreateDefaultTemplate] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [savingTemplate, setSavingTemplate] = useState(false);
  
  // Objeto do contrato detectado automaticamente
  const [objetoContratoDetectado, setObjetoContratoDetectado] = useState<string | null>(null);
  const [loadingContractDraft, setLoadingContractDraft] = useState(false);
  const [poderesGeradosAutomaticamente, setPoderesGeradosAutomaticamente] = useState(false);

  const { user } = useAuth();
  const { isAdmin } = useUserRole();

  // Carregar rascunho de contrato existente para detectar objeto do contrato
  useEffect(() => {
    const loadContractDraft = async () => {
      if (!open || !user || !client) return;
      
      setLoadingContractDraft(true);
      try {
        const { data, error } = await supabase
          .from('contract_drafts')
          .select('objeto_contrato')
          .eq('client_id', client.id)
          .eq('user_id', user.id)
          .maybeSingle();
        
        if (error) throw error;
        
        if (data?.objeto_contrato) {
          setObjetoContratoDetectado(data.objeto_contrato);
        }
      } catch (error) {
        console.error('Erro ao carregar rascunho de contrato:', error);
      } finally {
        setLoadingContractDraft(false);
      }
    };

    loadContractDraft();
  }, [user, open, client]);

  // Gerar poderes automaticamente quando tem contrato e habilita poderes especiais
  useEffect(() => {
    const objetoParaUsar = objetoContrato || objetoContratoDetectado;
    
    if (temPoderesEspeciais && objetoParaUsar && !poderesEspeciais.trim() && !poderesGeradosAutomaticamente) {
      gerarPoderesAutomaticamente(objetoParaUsar);
    }
  }, [temPoderesEspeciais, objetoContrato, objetoContratoDetectado]);

  // Função para gerar poderes automaticamente
  const gerarPoderesAutomaticamente = async (objeto: string) => {
    setGerandoPoderes(true);
    setPoderesGeradosAutomaticamente(true);
    try {
      const prompt = `Você é um advogado especialista em procurações advocatícias.

Gere os poderes especiais para uma procuração com base no seguinte objeto do contrato:

${objeto}

Os poderes especiais devem ser específicos e relacionados ao objeto do contrato, permitindo que o advogado execute todas as ações necessárias para a defesa dos interesses do cliente neste caso específico.

Formato esperado:
- Os poderes devem ser listados de forma clara e direta.
- O texto deve ser em português jurídico formal.
- Seja objetivo e conciso.

Retorne APENAS o texto dos poderes especiais, sem explicações adicionais.`;

      const { data, error } = await supabase.functions.invoke('ai-assistant', {
        body: { 
          messages: [{ role: 'user', content: prompt }],
          model: 'lovable'
        }
      });

      if (error) throw error;

      const response = data?.content || data?.choices?.[0]?.message?.content;
      if (response) {
        setPoderesEspeciais(response.trim());
        toast.success("Poderes especiais gerados automaticamente com base no contrato!");
      }
    } catch (error) {
      console.error('Erro ao gerar poderes especiais automaticamente:', error);
      toast.error("Erro ao gerar poderes especiais. Tente manualmente.");
    } finally {
      setGerandoPoderes(false);
    }
  };

  // Carregar templates
  useEffect(() => {
    const loadTemplates = async () => {
      if (!open || !user) return;
      
      setLoadingTemplates(true);
      try {
        // Carregar todos os templates (visíveis para todos os usuários)
        const { data, error } = await supabase
          .from('special_powers_templates')
          .select('id, name, description, is_default')
          .order('is_default', { ascending: false })
          .order('name');
        
        if (error) throw error;
        setTemplates(data || []);
      } catch (error) {
        console.error('Erro ao carregar templates:', error);
      } finally {
        setLoadingTemplates(false);
      }
    };

    loadTemplates();
  }, [user, open]);

  // Salvar template
  const salvarTemplate = async (isDefault: boolean = false) => {
    if (!templateName.trim() || !poderesEspeciais.trim() || !user) {
      toast.error("Preencha o nome e os poderes especiais");
      return;
    }

    setSavingTemplate(true);
    try {
      const { error } = await supabase
        .from('special_powers_templates')
        .insert({
          user_id: isDefault ? null : user.id,
          is_default: isDefault,
          name: templateName.trim(),
          description: poderesEspeciais.trim(),
        });

      if (error) throw error;

      // Recarregar templates (todos visíveis para todos)
      const { data } = await supabase
        .from('special_powers_templates')
        .select('id, name, description, is_default')
        .order('is_default', { ascending: false })
        .order('name');
      
      setTemplates(data || []);
      setTemplateName("");
      setShowSaveTemplate(false);
      setShowCreateDefaultTemplate(false);
      toast.success(isDefault ? "Template padrão criado!" : "Template salvo!");
    } catch (error) {
      console.error('Erro ao salvar template:', error);
      toast.error("Erro ao salvar template");
    } finally {
      setSavingTemplate(false);
    }
  };

  // Deletar template
  const deletarTemplate = async (templateId: string, isDefault?: boolean) => {
    if (isDefault && !isAdmin) {
      toast.error("Apenas administradores podem excluir templates padrão");
      return;
    }
    
    try {
      const { error } = await supabase
        .from('special_powers_templates')
        .delete()
        .eq('id', templateId);
      
      if (error) throw error;
      
      setTemplates(prev => prev.filter(t => t.id !== templateId));
      toast.success("Template excluído");
    } catch (error) {
      console.error('Erro ao deletar template:', error);
      toast.error("Erro ao excluir template");
    }
  };

  // Carregar template selecionado
  const carregarTemplate = (template: PowerTemplate) => {
    setPoderesEspeciais(template.description);
    toast.success(`Template "${template.name}" carregado`);
  };

  // Gerar poderes especiais com IA (manual - quando usuário clica no botão)
  const gerarPoderesComIA = async () => {
    const objetoParaUsar = objetoContrato || objetoContratoDetectado;
    
    setGerandoPoderes(true);
    try {
      const contexto = objetoParaUsar?.trim() 
        ? `Objeto do contrato: ${objetoParaUsar}`
        : `Cliente: ${client?.nomeCompleto || 'não informado'}`;
      
      const prompt = `Você é um advogado especialista em procurações advocatícias.

Gere os poderes especiais para uma procuração com base no seguinte contexto:

${contexto}

Os poderes especiais devem ser específicos e relacionados ao contexto informado, permitindo que o advogado execute todas as ações necessárias para a defesa dos interesses do cliente.

Formato esperado:
- Os poderes devem ser listados de forma clara e direta.
- O texto deve ser em português jurídico formal.
- Seja objetivo e conciso.

Retorne APENAS o texto dos poderes especiais, sem explicações adicionais.`;

      const { data, error } = await supabase.functions.invoke('ai-assistant', {
        body: { 
          messages: [{ role: 'user', content: prompt }],
          model: 'lovable'
        }
      });

      if (error) throw error;

      const response = data?.content || data?.choices?.[0]?.message?.content;
      if (response) {
        setPoderesEspeciais(response.trim());
        toast.success("Poderes especiais gerados com sucesso!");
      }
    } catch (error) {
      console.error('Erro ao gerar poderes especiais:', error);
      toast.error("Erro ao gerar poderes especiais. Tente novamente.");
    } finally {
      setGerandoPoderes(false);
    }
  };

  // Gerar texto da procuração para preview
  const gerarTextoProcuracao = (): string => {
    if (!client) return "";
    
    const dataAtual = format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
    
    // Montar lista de advogados
    const advogadosTexto = ADVOGADOS_OFICIAIS.map(adv => 
      `${adv.nome}, ${adv.nacionalidade}, ${adv.estadoCivil}, advogado(a) inscrito(a) na ${adv.oab}`
    ).join('\n');
    
    let texto = `PROCURAÇÃO

${qualification}; nomeia(m) e constitui(em), seus bastantes procuradores os advogados:

${advogadosTexto}

todos com escritório na ${ENDERECO_ESCRITORIO}, ${TEXTO_PODERES}`;

    // Inserir poderes especiais se houver
    if (temPoderesEspeciais && poderesEspeciais.trim()) {
      texto += `\n\n${poderesEspeciais.trim()}`;
    }
    
    texto += `\n\nBelo Horizonte, ${dataAtual}.\n\n\n_____________________________________\n${client.nomeCompleto.toUpperCase()}`;
    
    return texto;
  };

  // Abrir preview
  const abrirPreview = () => {
    const texto = gerarTextoProcuracao();
    setPreviewText(texto);
    setShowPreview(true);
  };

  // Voltar para edição
  const voltarParaEdicao = () => {
    setShowPreview(false);
  };

  // Gerar PDF da procuração conforme modelo oficial EXATO
  const gerarPDF = async () => {
    if (!client) return;
    
    setGerandoPDF(true);
    try {
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const marginLeft = 15;
      const marginRight = 15;
      const contentWidth = pageWidth - marginLeft - marginRight;
      
      // Adicionar logo centralizada
      try {
        const img = new Image();
        img.src = logoEggnunes;
        await new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = reject;
        });
        
        const logoWidth = 40;
        const logoHeight = (img.height / img.width) * logoWidth;
        const logoX = (pageWidth - logoWidth) / 2;
        doc.addImage(img, 'PNG', logoX, 10, logoWidth, logoHeight);
      } catch (e) {
        console.warn('Não foi possível carregar a logo:', e);
      }

      let yPosition = 32;
      
      // Título PROCURAÇÃO em negrito e centralizado
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.text('PROCURAÇÃO', pageWidth / 2, yPosition, { align: 'center' });
      yPosition += 8;

      // Qualificação do cliente (texto normal, conforme modelo)
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      const qualificationText = qualification + "; nomeia(m) e constitui(em), seus bastantes procuradores os advogados:";
      const qualificationLines = doc.splitTextToSize(qualificationText, contentWidth);
      doc.text(qualificationLines, marginLeft, yPosition, { align: 'justify', maxWidth: contentWidth });
      yPosition += qualificationLines.length * 3.8 + 3;

      // Tabela de advogados (formato tabela conforme modelo)
      doc.setFontSize(7.5);
      const colNome = marginLeft;
      const colNacionalidade = marginLeft + 75;
      const colEstadoCivil = marginLeft + 95;
      const colOab = marginLeft + 115;
      const lineHeightTable = 3.5;
      
      for (const adv of ADVOGADOS_OFICIAIS) {
        doc.setFont('helvetica', 'bold');
        doc.text(adv.nome, colNome, yPosition);
        
        doc.setFont('helvetica', 'normal');
        doc.text(adv.nacionalidade, colNacionalidade, yPosition);
        doc.text(adv.estadoCivil, colEstadoCivil, yPosition);
        doc.text(adv.oab, colOab, yPosition);
        
        yPosition += lineHeightTable;
      }

      yPosition += 2;

      // Texto do escritório + poderes (tudo junto conforme modelo)
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      
      let textoPoderesCompleto = `todos com escritório na ${ENDERECO_ESCRITORIO}, ${TEXTO_PODERES}`;
      
      // Adicionar poderes especiais se houver
      if (temPoderesEspeciais && poderesEspeciais.trim()) {
        textoPoderesCompleto += ` ${poderesEspeciais.trim()}`;
      }
      
      const poderesLines = doc.splitTextToSize(textoPoderesCompleto, contentWidth);
      doc.text(poderesLines, marginLeft, yPosition, { align: 'justify', maxWidth: contentWidth });
      yPosition += poderesLines.length * 3.8 + 6;

      // Data e local
      const dataAtual = format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
      doc.text(`Belo Horizonte, ${dataAtual}.`, marginLeft, yPosition);
      yPosition += 12;

      // Linha de assinatura centralizada
      doc.text('_____________________________________', pageWidth / 2, yPosition, { align: 'center' });
      yPosition += 5;
      
      // Nome do cliente em negrito e centralizado
      doc.setFont('helvetica', 'bold');
      doc.text(client.nomeCompleto.toUpperCase(), pageWidth / 2, yPosition, { align: 'center' });

      // Rodapé conforme modelo exato
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.text('31 3226-8742 | escritorio@eggnunes.com.br | www.eggnunes.com.br', pageWidth / 2, pageHeight - 15, { align: 'center' });
      doc.text('Rua São Paulo, 1104 - 9º andar - Centro - Belo Horizonte - MG - 30170-131', pageWidth / 2, pageHeight - 10, { align: 'center' });

      // Salvar PDF
      const nomeArquivo = `Procuracao_${client.nomeCompleto.replace(/\s+/g, '_')}_${format(new Date(), 'ddMMyyyy')}.pdf`;
      doc.save(nomeArquivo);
      
      toast.success("Procuração gerada com sucesso!");
      onOpenChange(false);
    } catch (error) {
      console.error('Erro ao gerar PDF:', error);
      toast.error("Erro ao gerar PDF. Tente novamente.");
    } finally {
      setGerandoPDF(false);
    }
  };

  if (!client) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Scale className="h-5 w-5" />
            Gerar Procuração
          </DialogTitle>
          <DialogDescription>
            Procuração para {client.nomeCompleto?.split(' ')[0]}
          </DialogDescription>
        </DialogHeader>
        
        <ScrollArea className="max-h-[70vh] pr-4">
          {showPreview ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Badge variant="outline" className="text-sm">
                  <FileText className="h-3 w-3 mr-1" />
                  Pré-visualização da Procuração
                </Badge>
                <p className="text-xs text-muted-foreground">
                  Edite o texto abaixo se necessário
                </p>
              </div>
              <Textarea
                value={previewText}
                onChange={(e) => setPreviewText(e.target.value)}
                className="min-h-[50vh] font-mono text-sm leading-relaxed"
              />
            </div>
          ) : (
            <div className="space-y-6 py-4">
              {/* Qualificação */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Qualificação do Cliente</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground bg-muted p-3 rounded-lg">
                    {qualification}
                  </p>
                </CardContent>
              </Card>

              {/* Poderes Especiais */}
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">Poderes Especiais</CardTitle>
                    <Switch
                      checked={temPoderesEspeciais}
                      onCheckedChange={setTemPoderesEspeciais}
                    />
                  </div>
                </CardHeader>
                {temPoderesEspeciais && (
                  <CardContent className="space-y-4">
                    {/* Indicador de contrato detectado */}
                    {(objetoContrato || objetoContratoDetectado) && (
                      <div className="flex items-center gap-2 p-2 rounded-lg bg-primary/10 text-primary text-sm">
                        <FileText className="h-4 w-4" />
                        <span>
                          {gerandoPoderes 
                            ? "Gerando poderes especiais com base no contrato..." 
                            : "Contrato detectado - poderes gerados automaticamente"}
                        </span>
                      </div>
                    )}
                    
                    {/* Templates disponíveis */}
                    {templates.length > 0 && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label className="text-xs text-muted-foreground">Templates disponíveis</Label>
                          {isAdmin && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setShowCreateDefaultTemplate(true)}
                              className="h-6 text-xs px-2"
                            >
                              + Novo Template Padrão
                            </Button>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {templates.map((template) => (
                            <div key={template.id} className="flex items-center gap-1">
                              <Badge 
                                variant={template.is_default ? "secondary" : "outline"}
                                className="cursor-pointer hover:bg-primary/10"
                                onClick={() => carregarTemplate(template)}
                              >
                                {template.name}
                                {template.is_default && <span className="ml-1 text-[10px] opacity-60">(padrão)</span>}
                              </Badge>
                              {(!template.is_default || isAdmin) && (
                                <button
                                  onClick={() => deletarTemplate(template.id, template.is_default)}
                                  className="text-muted-foreground hover:text-destructive p-0.5"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Campo de texto dos poderes */}
                    <div className="space-y-2">
                      <Label>Descreva os poderes especiais *</Label>
                      <Textarea
                        placeholder="Ex: Outorga ainda poderes especiais para requerer a revisão de aposentadoria..."
                        value={poderesEspeciais}
                        onChange={(e) => setPoderesEspeciais(e.target.value)}
                        className="min-h-[100px]"
                      />
                    </div>

                    {/* Botões de ação */}
                    <div className="flex flex-wrap gap-2">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={gerarPoderesComIA}
                        disabled={gerandoPoderes}
                      >
                        {gerandoPoderes ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Sparkles className="h-4 w-4 mr-2" />
                        )}
                        Gerar com IA
                      </Button>
                      
                      {poderesEspeciais.trim() && !showSaveTemplate && !showCreateDefaultTemplate && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setShowSaveTemplate(true)}
                        >
                          <Save className="h-4 w-4 mr-2" />
                          Salvar como Template
                        </Button>
                      )}
                    </div>

                    {/* Formulário salvar template pessoal */}
                    {showSaveTemplate && (
                      <div className="space-y-2 p-3 rounded-lg bg-muted/50">
                        <Label className="text-xs">Nome do template</Label>
                        <Input
                          placeholder="Ex: Poderes Revisão INSS"
                          value={templateName}
                          onChange={(e) => setTemplateName(e.target.value)}
                          className="h-8"
                        />
                        <div className="flex gap-2">
                          <Button 
                            size="sm" 
                            onClick={() => salvarTemplate(false)}
                            disabled={savingTemplate || !templateName.trim()}
                            className="h-8"
                          >
                            {savingTemplate ? <Loader2 className="h-3 w-3 animate-spin" /> : "Salvar"}
                          </Button>
                          <Button 
                            size="sm" 
                            variant="ghost"
                            onClick={() => {
                              setShowSaveTemplate(false);
                              setTemplateName("");
                            }}
                            className="h-8"
                          >
                            Cancelar
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* Formulário criar template padrão (admin) */}
                    {showCreateDefaultTemplate && isAdmin && (
                      <div className="space-y-2 p-3 rounded-lg bg-primary/5 border border-primary/20">
                        <Label className="text-xs font-medium text-primary">Criar Template Padrão (visível para todos)</Label>
                        <Input
                          placeholder="Nome do template"
                          value={templateName}
                          onChange={(e) => setTemplateName(e.target.value)}
                          className="h-8"
                        />
                        <div className="flex gap-2">
                          <Button 
                            size="sm" 
                            onClick={() => salvarTemplate(true)}
                            disabled={savingTemplate || !templateName.trim() || !poderesEspeciais.trim()}
                            className="h-8"
                          >
                            {savingTemplate ? <Loader2 className="h-3 w-3 animate-spin" /> : "Criar Template Padrão"}
                          </Button>
                          <Button 
                            size="sm" 
                            variant="ghost"
                            onClick={() => {
                              setShowCreateDefaultTemplate(false);
                              setTemplateName("");
                            }}
                            className="h-8"
                          >
                            Cancelar
                          </Button>
                        </div>
                      </div>
                    )}
                  </CardContent>
                )}
              </Card>
            </div>
          )}
        </ScrollArea>
        
        <DialogFooter className="gap-2">
          {showPreview ? (
            <>
              <Button variant="outline" onClick={voltarParaEdicao}>
                Voltar e Editar
              </Button>
              <Button onClick={gerarPDF} disabled={gerandoPDF}>
                {gerandoPDF ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Download className="h-4 w-4 mr-2" />
                )}
                Gerar PDF Final
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button onClick={abrirPreview}>
                <Eye className="h-4 w-4 mr-2" />
                Visualizar Procuração
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
