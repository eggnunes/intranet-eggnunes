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

// Modelo de procuração base
const PROCURACAO_TEMPLATE = `PROCURAÇÃO AD JUDICIA ET EXTRA

[qualificação do cliente]


OUTORGA amplos poderes, como sua bastante procuradora aos advogados que subscrevem esta procuração, EGG NUNES ADVOGADOS ASSOCIADOS, inscrito no CNPJ/MF sob o nº 10.378.694/0001-59, MARCOS LUIZ EGG NUNES, inscrito na OAB/MG sob o nº 115.283, CPF: 043.411.986-88, RAFAEL EGG NUNES, inscrito na OAB/MG sob o nº 118.395, CPF: 106.261.286-09, LAÍS PASSOS CAMPOLINA, inscrito na OAB/MG sob o nº 171.816, CPF: 111.466.086-06, MARIANA AMORIM, inscrito na OAB/MG sob o nº 229.188, CPF: 149.498.576-05, LUCAS TAVEIRA, inscrito na OAB/MG sob o nº 220.426, CPF: 133.660.326-70, ANDREI SGANZERLA DE ALMEIDA, inscrito na OAB/MG sob o nº 195.608, CPF: 067.116.316-10, EMANUELLE OLIVEIRA SANTANA, inscrito na OAB/MG sob o nº 224.011, CPF: 127.809.266-44, escritório profissional na Rua São Paulo, 1104, salas 901, 902 e 903, Centro, CEP 30.170-131, Belo Horizonte/MG, para, no foro em geral, o fim especial de, em juízo ou fora dele, propor demandas, sendo parte ativa ou passiva, promover investigações, auditorias, notificações extrajudiciais, acordos judiciais, podendo os constituídos substabelecê-los a outros advogados, com ou sem reservas de iguais poderes, e, ainda, agir nas Instâncias do Poder Judiciário e do Poder Executivo da União, Estados, Distrito Federal e Municípios, do Ministério Público Estadual e Federal e de todas as outras repartições públicas, podendo os outorgados atuarem em conjunto ou separadamente.

OUTORGA, ainda, os poderes da cláusula "ad judicia et extra", e para o foro em geral, com as seguintes ressalvas e os seguintes poderes especiais: confessar, reconhecer procedência do pedido, transigir, desistir, renunciar ao direito sob o qual se funda a ação, receber citação inicial, intimação, interpor todos os recursos legais, e todos os demais atos necessários ao fiel cumprimento do mandato, prestar compromisso.

[inserir aqui os poderes especiais, caso tenha]

Belo Horizonte/MG, [data].



_____________________________________
[nome completo do cliente]`;

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

  const { user } = useAuth();
  const { isAdmin } = useUserRole();

  // Carregar templates
  useEffect(() => {
    const loadTemplates = async () => {
      if (!open || !user) return;
      
      setLoadingTemplates(true);
      try {
        const { data, error } = await supabase
          .from('special_powers_templates')
          .select('id, name, description, is_default')
          .or(`user_id.eq.${user.id},is_default.eq.true`)
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

      // Recarregar templates
      const { data } = await supabase
        .from('special_powers_templates')
        .select('id, name, description, is_default')
        .or(`user_id.eq.${user.id},is_default.eq.true`)
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

  // Gerar poderes especiais com IA baseado no objeto do contrato
  const gerarPoderesComIA = async () => {
    if (!objetoContrato?.trim()) {
      toast.error("Objeto do contrato não informado. Primeiro gere o contrato para usar esta função.");
      return;
    }

    setGerandoPoderes(true);
    try {
      const prompt = `Você é um advogado especialista em procurações advocatícias.

Gere os poderes especiais para uma procuração com base no seguinte objeto do contrato:

Objeto do contrato: ${objetoContrato}

Os poderes especiais devem ser específicos e relacionados ao objeto do contrato, permitindo que o advogado execute todas as ações necessárias para a defesa dos interesses do cliente.

Formato esperado:
- Comece com "Outorga ainda poderes especiais para:" seguido dos poderes específicos.
- Os poderes devem ser listados de forma clara e direta.
- O texto deve ser em português jurídico formal.
- O texto final deve estar em negrito quando inserido no documento.

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

  // Gerar texto da procuração
  const gerarTextoProcuracao = (): string => {
    if (!client) return "";
    
    const dataAtual = format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
    
    let texto = PROCURACAO_TEMPLATE
      .replace('[qualificação do cliente]', qualification)
      .replace('[data]', dataAtual)
      .replace('[nome completo do cliente]', client.nomeCompleto.toUpperCase());
    
    // Inserir poderes especiais ou remover placeholder
    if (temPoderesEspeciais && poderesEspeciais.trim()) {
      texto = texto.replace('[inserir aqui os poderes especiais, caso tenha]', poderesEspeciais.trim());
    } else {
      texto = texto.replace('\n\n[inserir aqui os poderes especiais, caso tenha]', '');
    }
    
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

  // Gerar PDF da procuração
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
      const margin = 25;
      const contentWidth = pageWidth - (margin * 2);
      
      // Adicionar logo
      try {
        const img = new Image();
        img.src = logoEggnunes;
        await new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = reject;
        });
        
        const logoWidth = 50;
        const logoHeight = (img.height / img.width) * logoWidth;
        const logoX = (pageWidth - logoWidth) / 2;
        doc.addImage(img, 'PNG', logoX, 15, logoWidth, logoHeight);
      } catch (e) {
        console.warn('Não foi possível carregar a logo:', e);
      }

      let yPosition = 50;
      
      // Título
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.text('PROCURAÇÃO AD JUDICIA ET EXTRA', pageWidth / 2, yPosition, { align: 'center' });
      yPosition += 15;

      // Qualificação do cliente
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(11);
      const qualificationLines = doc.splitTextToSize(qualification, contentWidth);
      doc.text(qualificationLines, margin, yPosition);
      yPosition += qualificationLines.length * 5 + 10;

      // Texto principal da procuração (dividido em parágrafos)
      const paragrafos = [
        `OUTORGA amplos poderes, como sua bastante procuradora aos advogados que subscrevem esta procuração, EGG NUNES ADVOGADOS ASSOCIADOS, inscrito no CNPJ/MF sob o nº 10.378.694/0001-59, MARCOS LUIZ EGG NUNES, inscrito na OAB/MG sob o nº 115.283, CPF: 043.411.986-88, RAFAEL EGG NUNES, inscrito na OAB/MG sob o nº 118.395, CPF: 106.261.286-09, LAÍS PASSOS CAMPOLINA, inscrito na OAB/MG sob o nº 171.816, CPF: 111.466.086-06, MARIANA AMORIM, inscrito na OAB/MG sob o nº 229.188, CPF: 149.498.576-05, LUCAS TAVEIRA, inscrito na OAB/MG sob o nº 220.426, CPF: 133.660.326-70, ANDREI SGANZERLA DE ALMEIDA, inscrito na OAB/MG sob o nº 195.608, CPF: 067.116.316-10, EMANUELLE OLIVEIRA SANTANA, inscrito na OAB/MG sob o nº 224.011, CPF: 127.809.266-44, escritório profissional na Rua São Paulo, 1104, salas 901, 902 e 903, Centro, CEP 30.170-131, Belo Horizonte/MG, para, no foro em geral, o fim especial de, em juízo ou fora dele, propor demandas, sendo parte ativa ou passiva, promover investigações, auditorias, notificações extrajudiciais, acordos judiciais, podendo os constituídos substabelecê-los a outros advogados, com ou sem reservas de iguais poderes, e, ainda, agir nas Instâncias do Poder Judiciário e do Poder Executivo da União, Estados, Distrito Federal e Municípios, do Ministério Público Estadual e Federal e de todas as outras repartições públicas, podendo os outorgados atuarem em conjunto ou separadamente.`,
        `OUTORGA, ainda, os poderes da cláusula "ad judicia et extra", e para o foro em geral, com as seguintes ressalvas e os seguintes poderes especiais: confessar, reconhecer procedência do pedido, transigir, desistir, renunciar ao direito sob o qual se funda a ação, receber citação inicial, intimação, interpor todos os recursos legais, e todos os demais atos necessários ao fiel cumprimento do mandato, prestar compromisso.`
      ];

      for (const paragrafo of paragrafos) {
        const lines = doc.splitTextToSize(paragrafo, contentWidth);
        
        // Verificar se precisa de nova página
        if (yPosition + (lines.length * 5) > pageHeight - 40) {
          doc.addPage();
          yPosition = margin;
        }
        
        doc.text(lines, margin, yPosition);
        yPosition += lines.length * 5 + 8;
      }

      // Poderes especiais em negrito (se houver)
      if (temPoderesEspeciais && poderesEspeciais.trim()) {
        doc.setFont('helvetica', 'bold');
        const poderesLines = doc.splitTextToSize(poderesEspeciais.trim(), contentWidth);
        
        // Verificar se precisa de nova página
        if (yPosition + (poderesLines.length * 5) > pageHeight - 40) {
          doc.addPage();
          yPosition = margin;
        }
        
        doc.text(poderesLines, margin, yPosition);
        yPosition += poderesLines.length * 5 + 10;
        doc.setFont('helvetica', 'normal');
      }

      // Data e local
      const dataAtual = format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
      yPosition += 10;
      
      // Verificar se precisa de nova página
      if (yPosition + 50 > pageHeight - 40) {
        doc.addPage();
        yPosition = margin;
      }
      
      doc.text(`Belo Horizonte/MG, ${dataAtual}.`, margin, yPosition);
      yPosition += 25;

      // Linha de assinatura
      doc.text('_____________________________________', pageWidth / 2, yPosition, { align: 'center' });
      yPosition += 6;
      doc.setFont('helvetica', 'bold');
      doc.text(client.nomeCompleto.toUpperCase(), pageWidth / 2, yPosition, { align: 'center' });

      // Rodapé
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.text('Rua São Paulo, 1104 - 9º andar - Centro - Belo Horizonte/MG - CEP: 30.170-131', pageWidth / 2, pageHeight - 15, { align: 'center' });
      doc.text('Tel: (31) 3226-8742 | www.eggnunes.com.br', pageWidth / 2, pageHeight - 10, { align: 'center' });

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
                        disabled={gerandoPoderes || !objetoContrato?.trim()}
                        title={!objetoContrato?.trim() ? "Primeiro gere o contrato para usar esta função" : ""}
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
