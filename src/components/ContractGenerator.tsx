import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { 
  FileSignature, 
  Loader2, 
  Sparkles, 
  CreditCard, 
  Target, 
  Award,
  FileText,
  Download,
  Save,
  FolderOpen,
  Trash2
} from "lucide-react";
import { jsPDF } from "jspdf";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

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

interface ContractGeneratorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client: Client | null;
  productName: string;
  qualification: string;
}

// Produtos que usam contratos específicos (não o padrão)
const CUSTOM_CONTRACT_PRODUCTS = [
  'terço de férias',
  'adicional escolaridade',
  'cobrança ipsm',
  'concurso público',
  'férias prêmio',
  'isenção de ir',
  'licença para curso de formação',
  'processos de bsb',
  'recurso administrativo',
  'vale refeição',
  'imobiliário - atraso em obra',
  'imobiliário - multipropriedade',
  'imobiliário - rescisão de contrato abusivo',
];

export const ContractGenerator = ({ 
  open, 
  onOpenChange, 
  client, 
  productName,
  qualification 
}: ContractGeneratorProps) => {
  // Cláusula Primeira - Objeto do contrato
  const [contraPartida, setContraPartida] = useState("");
  const [objetoContrato, setObjetoContrato] = useState("");
  const [clausulaPrimeiraGerada, setClausulaPrimeiraGerada] = useState("");
  const [gerandoClausulaPrimeira, setGerandoClausulaPrimeira] = useState(false);

  // Cláusula Terceira - Honorários
  const [temHonorariosIniciais, setTemHonorariosIniciais] = useState(true);
  const [tipoHonorarios, setTipoHonorarios] = useState<"avista" | "parcelado">("avista");
  const [valorTotal, setValorTotal] = useState("");
  const [numeroParcelas, setNumeroParcelas] = useState("");
  const [valorParcela, setValorParcela] = useState("");
  const [temEntrada, setTemEntrada] = useState(false);
  const [valorEntrada, setValorEntrada] = useState("");
  const [formaPagamento, setFormaPagamento] = useState<"pix" | "cartao" | "boleto">("pix");
  const [dataVencimento, setDataVencimento] = useState("");

  // Honorários Êxito
  const [temHonorariosExito, setTemHonorariosExito] = useState(false);
  const [descricaoHonorariosExito, setDescricaoHonorariosExito] = useState("");
  const [clausulaExitoGerada, setClausulaExitoGerada] = useState("");
  
  // Templates de honorários êxito
  const [templates, setTemplates] = useState<{id: string; name: string; description: string}[]>([]);
  const [showSaveTemplate, setShowSaveTemplate] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [gerandoClausulaExito, setGerandoClausulaExito] = useState(false);

  // Geração do contrato
  const [gerandoContrato, setGerandoContrato] = useState(false);
  
  // Pré-visualização
  const [showPreview, setShowPreview] = useState(false);
  const [contractPreviewText, setContractPreviewText] = useState("");

  // Rascunhos
  const [salvandoRascunho, setSalvandoRascunho] = useState(false);
  const [carregandoRascunho, setCarregandoRascunho] = useState(false);
  const [rascunhoExistente, setRascunhoExistente] = useState<string | null>(null);
  const [deletandoRascunho, setDeletandoRascunho] = useState(false);

  const { user } = useAuth();

  // Verificar se é um produto com contrato específico
  const isCustomContractProduct = CUSTOM_CONTRACT_PRODUCTS.some(
    p => productName.toLowerCase().includes(p.toLowerCase())
  );

  // Carregar templates de honorários êxito
  useEffect(() => {
    const loadTemplates = async () => {
      if (!user || !open) return;
      
      setLoadingTemplates(true);
      try {
        const { data, error } = await supabase
          .from('success_fee_templates')
          .select('id, name, description')
          .eq('user_id', user.id)
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

  // Verificar se existe rascunho para este cliente
  useEffect(() => {
    const checkExistingDraft = async () => {
      if (!client || !user) return;
      
      const { data } = await supabase
        .from('contract_drafts')
        .select('id')
        .eq('client_id', client.id)
        .eq('user_id', user.id)
        .maybeSingle();
      
      if (data) {
        setRascunhoExistente(data.id);
      } else {
        setRascunhoExistente(null);
      }
    };

    if (open) {
      checkExistingDraft();
    }
  }, [client, user, open]);

  // Carregar rascunho existente
  const carregarRascunho = async () => {
    if (!rascunhoExistente) return;
    
    setCarregandoRascunho(true);
    try {
      const { data, error } = await supabase
        .from('contract_drafts')
        .select('*')
        .eq('id', rascunhoExistente)
        .single();
      
      if (error) throw error;
      
      if (data) {
        setContraPartida(data.contra_partida || "");
        setObjetoContrato(data.objeto_contrato || "");
        setClausulaPrimeiraGerada(data.clausula_primeira_gerada || "");
        setTipoHonorarios((data.tipo_honorarios as "avista" | "parcelado") || "avista");
        setValorTotal(data.valor_total || "");
        setNumeroParcelas(data.numero_parcelas || "");
        setValorParcela(data.valor_parcela || "");
        setTemEntrada(data.tem_entrada || false);
        setValorEntrada(data.valor_entrada || "");
        setFormaPagamento((data.forma_pagamento as "pix" | "cartao" | "boleto") || "pix");
        setDataVencimento(data.data_vencimento || "");
        setTemHonorariosExito(data.tem_honorarios_exito || false);
        setDescricaoHonorariosExito(data.descricao_honorarios_exito || "");
        setClausulaExitoGerada(data.clausula_exito_gerada || "");
        setContractPreviewText(data.contract_preview_text || "");
        
        toast.success("Rascunho carregado com sucesso!");
      }
    } catch (error) {
      console.error('Erro ao carregar rascunho:', error);
      toast.error("Erro ao carregar rascunho");
    } finally {
      setCarregandoRascunho(false);
    }
  };

  // Salvar rascunho
  const salvarRascunho = async () => {
    if (!client || !user) {
      toast.error("Erro: cliente ou usuário não identificado");
      return;
    }
    
    setSalvandoRascunho(true);
    try {
      const draftData = {
        user_id: user.id,
        client_id: client.id,
        client_name: client.nomeCompleto,
        product_name: productName,
        qualification: qualification,
        contra_partida: contraPartida,
        objeto_contrato: objetoContrato,
        clausula_primeira_gerada: clausulaPrimeiraGerada,
        tipo_honorarios: tipoHonorarios,
        valor_total: valorTotal,
        numero_parcelas: numeroParcelas,
        valor_parcela: valorParcela,
        tem_entrada: temEntrada,
        valor_entrada: valorEntrada,
        forma_pagamento: formaPagamento,
        data_vencimento: dataVencimento,
        tem_honorarios_exito: temHonorariosExito,
        descricao_honorarios_exito: descricaoHonorariosExito,
        clausula_exito_gerada: clausulaExitoGerada,
        contract_preview_text: contractPreviewText,
      };

      if (rascunhoExistente) {
        // Atualizar rascunho existente
        const { error } = await supabase
          .from('contract_drafts')
          .update(draftData)
          .eq('id', rascunhoExistente);
        
        if (error) throw error;
      } else {
        // Criar novo rascunho
        const { data, error } = await supabase
          .from('contract_drafts')
          .insert(draftData)
          .select('id')
          .single();
        
        if (error) throw error;
        if (data) setRascunhoExistente(data.id);
      }
      
      toast.success("Rascunho salvo com sucesso!");
    } catch (error) {
      console.error('Erro ao salvar rascunho:', error);
      toast.error("Erro ao salvar rascunho");
    } finally {
      setSalvandoRascunho(false);
    }
  };

  // Deletar rascunho
  const deletarRascunho = async () => {
    if (!rascunhoExistente) return;
    
    setDeletandoRascunho(true);
    try {
      const { error } = await supabase
        .from('contract_drafts')
        .delete()
        .eq('id', rascunhoExistente);
      
      if (error) throw error;
      
      setRascunhoExistente(null);
      toast.success("Rascunho excluído");
    } catch (error) {
      console.error('Erro ao deletar rascunho:', error);
      toast.error("Erro ao excluir rascunho");
    } finally {
      setDeletandoRascunho(false);
    }
  };

  // Salvar template de honorários êxito
  const salvarTemplate = async () => {
    if (!templateName.trim() || !descricaoHonorariosExito.trim() || !user) {
      toast.error("Preencha o nome do template e a descrição");
      return;
    }

    setSavingTemplate(true);
    try {
      const { error } = await supabase
        .from('success_fee_templates')
        .insert({
          user_id: user.id,
          name: templateName.trim(),
          description: descricaoHonorariosExito.trim(),
        });

      if (error) throw error;

      // Recarregar templates
      const { data } = await supabase
        .from('success_fee_templates')
        .select('id, name, description')
        .eq('user_id', user.id)
        .order('name');
      
      setTemplates(data || []);
      setTemplateName("");
      setShowSaveTemplate(false);
      toast.success("Template salvo com sucesso!");
    } catch (error) {
      console.error('Erro ao salvar template:', error);
      toast.error("Erro ao salvar template");
    } finally {
      setSavingTemplate(false);
    }
  };

  // Carregar template selecionado
  const carregarTemplate = (template: {id: string; name: string; description: string}) => {
    setDescricaoHonorariosExito(template.description);
    toast.success(`Template "${template.name}" carregado`);
  };

  // Deletar template
  const deletarTemplate = async (templateId: string) => {
    try {
      const { error } = await supabase
        .from('success_fee_templates')
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

  // Gerar cláusula primeira com IA
  const gerarClausulaPrimeira = async () => {
    if (!contraPartida.trim() || !objetoContrato.trim()) {
      toast.error("Preencha a parte contrária e o objeto do contrato");
      return;
    }

    setGerandoClausulaPrimeira(true);
    try {
      const prompt = `Você é um advogado especialista em contratos de prestação de serviços advocatícios. 
      
Reescreva a cláusula primeira de um contrato de honorários advocatícios de forma jurídica e profissional.

O modelo original é:
"Os Contratados comprometem-se, em cumprimento ao mandato recebido, a requerer para o(a) Contratante, em face do …………………, a ………………………………….."

Com base nas informações fornecidas:
- Parte contrária (em face de): ${contraPartida}
- Objeto do contrato (o que será requerido): ${objetoContrato}

Reescreva a frase de forma completa e juridicamente correta, substituindo os campos em branco. A frase deve começar com "Os Contratados comprometem-se, em cumprimento ao mandato recebido, a requerer para o(a) Contratante,".

Retorne APENAS a frase da cláusula primeira reescrita, sem explicações adicionais.`;

      const { data, error } = await supabase.functions.invoke('ai-assistant', {
        body: { 
          messages: [{ role: 'user', content: prompt }],
          model: 'lovable'
        }
      });

      if (error) throw error;

      const response = data?.content || data?.choices?.[0]?.message?.content;
      if (response) {
        setClausulaPrimeiraGerada(response.trim());
        toast.success("Cláusula primeira gerada com sucesso!");
      }
    } catch (error) {
      console.error('Erro ao gerar cláusula primeira:', error);
      toast.error("Erro ao gerar cláusula. Tente novamente.");
    } finally {
      setGerandoClausulaPrimeira(false);
    }
  };

  // Gerar cláusula de honorários êxito com IA
  const gerarClausulaExito = async () => {
    if (!descricaoHonorariosExito.trim()) {
      toast.error("Descreva os honorários de êxito");
      return;
    }

    setGerandoClausulaExito(true);
    try {
      const prompt = `Você é um advogado especialista em contratos de prestação de serviços advocatícios.

Gere uma cláusula de honorários de êxito para um contrato de prestação de serviços advocatícios.

Contexto do contrato:
- Parte contrária: ${contraPartida || 'Não informada'}
- Objeto do contrato: ${objetoContrato || 'Não informado'}

Descrição dos honorários de êxito informada pelo usuário:
${descricaoHonorariosExito}

Com base no objeto do contrato e na descrição dos honorários de êxito, redija uma cláusula jurídica clara e profissional que indique:
1. A condição de êxito (relacionada ao objeto do contrato)
2. O valor ou percentual devido
3. Eventuais condições de pagamento

IMPORTANTE: NÃO inicie com letras como "a)" ou "b)". Escreva apenas o texto da cláusula de forma direta.

Retorne APENAS a cláusula reescrita, sem explicações adicionais.`;

      const { data, error } = await supabase.functions.invoke('ai-assistant', {
        body: { 
          messages: [{ role: 'user', content: prompt }],
          model: 'lovable'
        }
      });

      if (error) throw error;

      const response = data?.content || data?.choices?.[0]?.message?.content;
      if (response) {
        // Remove letras iniciais se a IA incluir
        const clausulaLimpa = response.trim().replace(/^[a-z]\)\s*/i, '');
        setClausulaExitoGerada(clausulaLimpa);
        toast.success("Cláusula de honorários êxito gerada com sucesso!");
      }
    } catch (error) {
      console.error('Erro ao gerar cláusula de êxito:', error);
      toast.error("Erro ao gerar cláusula. Tente novamente.");
    } finally {
      setGerandoClausulaExito(false);
    }
  };

  // Formatar valor em extenso
  const valorPorExtenso = (valor: string): string => {
    // Simplificado - em produção usar uma biblioteca como extenso.js
    const num = parseFloat(valor.replace(/\./g, '').replace(',', '.'));
    if (isNaN(num)) return '';
    
    return `(${new Intl.NumberFormat('pt-BR', { 
      style: 'currency', 
      currency: 'BRL' 
    }).format(num).replace('R$', '').trim()} reais)`;
  };

  // Gerar cláusula terceira (honorários)
  const gerarClausulaTerceira = (): string => {
    const temAmbos = temHonorariosIniciais && temHonorariosExito && clausulaExitoGerada;
    
    let textoHonorariosIniciais = '';
    
    if (temHonorariosIniciais) {
      const valorFormatado = parseFloat(valorTotal.replace(/\./g, '').replace(',', '.') || '0');
      const valorExtenso = valorPorExtenso(valorTotal);
      
      // Só adiciona letra se tiver ambos os tipos de honorários
      const prefixo = temAmbos ? 'a) ' : '';
      
      if (tipoHonorarios === 'avista') {
        const formaPagamentoTexto = {
          'pix': 'via PIX',
          'cartao': 'via cartão de crédito',
          'boleto': 'via boleto bancário'
        }[formaPagamento];
        
        textoHonorariosIniciais = `${prefixo}R$${new Intl.NumberFormat('pt-BR').format(valorFormatado)} ${valorExtenso} à vista que serão pagos ${formaPagamentoTexto} até o dia ${dataVencimento || '[DATA]'} para a seguinte conta: Banco Itaú, agência 1403, conta corrente 68937-3, em nome de Egg Nunes Advogados Associados, CNPJ/PIX: 10378694/0001-59.`;
      } else {
        const numParcelas = parseInt(numeroParcelas) || 0;
        const valorParcelaNum = parseFloat(valorParcela.replace(/\./g, '').replace(',', '.') || '0');
        const valorEntradaNum = parseFloat(valorEntrada.replace(/\./g, '').replace(',', '.') || '0');
        
        const formaPagamentoTexto = {
          'pix': 'via PIX',
          'cartao': 'via cartão de crédito',
          'boleto': 'via boleto bancário'
        }[formaPagamento];
        
        if (temEntrada && valorEntradaNum > 0) {
          textoHonorariosIniciais = `${prefixo}R$${new Intl.NumberFormat('pt-BR').format(valorFormatado)} ${valorExtenso} parcelados, sendo R$${new Intl.NumberFormat('pt-BR').format(valorEntradaNum)} de entrada e mais ${numParcelas} parcelas de R$${new Intl.NumberFormat('pt-BR').format(valorParcelaNum)} cada, ${formaPagamentoTexto}, com vencimento para o dia ${dataVencimento || '[DATA]'} de cada mês, para a seguinte conta: Banco Itaú, agência 1403, conta corrente 68937-3, em nome de Egg Nunes Advogados Associados, CNPJ/PIX: 10378694/0001-59.`;
        } else {
          textoHonorariosIniciais = `${prefixo}R$${new Intl.NumberFormat('pt-BR').format(valorFormatado)} ${valorExtenso} parcelados em ${numParcelas} parcelas de R$${new Intl.NumberFormat('pt-BR').format(valorParcelaNum)} cada, ${formaPagamentoTexto}, com vencimento para o dia ${dataVencimento || '[DATA]'} de cada mês, para a seguinte conta: Banco Itaú, agência 1403, conta corrente 68937-3, em nome de Egg Nunes Advogados Associados, CNPJ/PIX: 10378694/0001-59.`;
        }
      }
    }
    
    let textoHonorariosExito = '';
    if (temHonorariosExito && clausulaExitoGerada) {
      // Só adiciona letra se tiver ambos os tipos de honorários
      const prefixo = temAmbos ? 'b) ' : '';
      textoHonorariosExito = `${prefixo}${clausulaExitoGerada}`;
    }
    
    // Montar texto final
    let clausulaCompleta = '';
    if (textoHonorariosIniciais && textoHonorariosExito) {
      clausulaCompleta = `${textoHonorariosIniciais}\n\n${textoHonorariosExito}`;
    } else if (textoHonorariosIniciais) {
      clausulaCompleta = textoHonorariosIniciais;
    } else if (textoHonorariosExito) {
      clausulaCompleta = textoHonorariosExito;
    } else {
      return `Em remuneração pelos serviços profissionais ora contratados serão devidos honorários advocatícios da seguinte forma:\n\n[Honorários não definidos]`;
    }
    
    return `Em remuneração pelos serviços profissionais ora contratados serão devidos honorários advocatícios da seguinte forma:\n\n${clausulaCompleta}`;
  };

  // Gerar texto completo do contrato para preview
  const gerarTextoContrato = (): string => {
    if (!client) return "";
    
    const dataAtual = format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
    const clausulaTerceira = gerarClausulaTerceira();
    
    const paragrafos = [
      'Parágrafo Primeiro - Na hipótese do(a) Contratante fazer acordo com a parte "ex-adversa", com ou sem o concurso do advogado, ou na hipótese de ser cassada a procuração outorgada (a qualquer tempo), e ainda caso não prossiga a ação por motivo que independa da vontade dos Contratados, os valores referentes aos honorários continuarão devidos.',
      'Parágrafo Segundo – Caso o(a) Contratante queira sustentação oral em seu favor em instâncias superiores, o que é opcional em um processo, pagará o valor constante na tabela de honorários mínimos da OAB/MG vigente à época.',
      'Parágrafo Terceiro - O não pagamento de qualquer prestação, caso haja parcelamento dos honorários, implicará na revogação dos poderes, além do acréscimo de multa de 20% sobre o devido para o caso da necessidade de cobrança judicial.',
      'Parágrafo Quarto – O atraso no pagamento de qualquer parcela, caso tenha optado pelo pagamento parcelado, acarretará o vencimento antecipado das demais - que poderão ser cobradas judicialmente.',
      'Parágrafo Quinto – Ficam os herdeiros do(a) Contratante comprometidos também ao pagamento dos valores acordados neste contrato em eventual ausência do(a) Contratante quando do recebimento.',
      'Parágrafo Sexto - O(a) Contratante autoriza, caso seja necessário, penhora em contracheque de salário/pensão em caso de não pagamento dos honorários.',
      'Parágrafo Sétimo – Caso o(a) Contratante tenha optado por pagamento via boleto bancário, fica ciente que cada boleto terá o acréscimo de R$4,00 referente à taxas bancárias.',
      'Parágrafo Oitavo – Na hipótese de desistência pelo(a) Contratante após assinatura deste contrato, e antes do ingresso da ação, serão devidos honorários de R$500,00 (quinhentos reais) a título de consultoria prestada.',
      `Parágrafo Nono - O(a) Contratante declara estar ciente que poderá receber citação/intimação judicial através do número de telefone ${client.telefone || '[TELEFONE]'}.`
    ];
    
    const demaisClausulas = [
      { titulo: 'Cláusula Quarta', texto: 'Os honorários de condenação (sucumbência), se houver, pertencerão aos Contratados, sem exclusão dos que ora são combinados, em conformidade com os artigos 23 da Lei nº 8.906/94 e 35, parágrafo 1º, do Código de Ética e Disciplina da Ordem dos Advogados do Brasil.' },
      { titulo: 'Cláusula Quinta', texto: 'O(a) Contratante pagará ainda as custas e despesas judiciais, além de quaisquer outras que decorrerem do serviço, mediante apresentação de demonstrativos analíticos pelos Contratados (caso haja referidas despesas).' },
      { titulo: 'Cláusula Sexta', texto: 'O presente contrato pode ser executado pelos dois Contratados em conjunto ou separadamente por apenas um dos Contratados.' },
      { titulo: 'Cláusula Sétima', texto: 'O(a) Contratante fica ciente que os únicos canais de comunicação oficiais dos Contratados são os números de telefone/WhatsApp 31-32268742 e/ou 31-993438742 sendo que os Contratados não se responsabilizam por contatos feitos por outros números desconhecidos.' },
      { titulo: 'Cláusula Oitava', texto: 'O(a) Contratante fica ciente que as informações do processo são públicas, exceto os processos em segredo de justiça, e que o Contratado não tem controle sobre elas, sendo a veiculação feita pelo respectivo Tribunal.' },
      { titulo: 'Cláusula Nona', texto: 'Elegem as partes o foro da Comarca de Belo Horizonte/MG para dirimir dúvidas sobre este contrato, podendo ainda os Contratados, em caso de execução do contrato, optarem pelo foro do domicílio do(a) Contratante.' }
    ];

    let texto = `CONTRATO DE PRESTAÇÃO DE SERVIÇOS ADVOCATÍCIOS

que entre si fazem, de um lado, como contratados, o escritório EGG NUNES ADVOGADOS ASSOCIADOS, inscrito no CNPJ sob o número 10.378.694./0001/59, neste ato representado por seu sócio Marcos Luiz Egg Nunes, OAB/MG 115.283, com escritório à Rua São Paulo nº 1104 / 9º andar – Belo Horizonte/MG, e o advogado RAFAEL EGG NUNES, OAB/MG 118.395, também com endereço à Rua São Paulo nº 1104 / 9º andar – Belo Horizonte/MG; e de outro lado, como cliente, ora contratante, ${qualification} ajustam, entre si, com fulcro no artigo 22 da Lei nº 8.906/94, mediante as seguintes cláusulas e condições, contrato de honorários advocatícios.

Cláusula Primeira
${clausulaPrimeiraGerada}

Parágrafo Único - A atuação compreende o processo de forma completa, inclusive eventuais e cabíveis fases recursais.

Cláusula Segunda
O(a) Contratante, que reconhece já haver recebido a orientação preventiva comportamental e jurídica para a consecução dos serviços, inclusive dos riscos sobre êxito na causa, fornecerá aos Contratados os documentos e meios necessários à comprovação processual do seu pretendido direito.

Cláusula Terceira
${clausulaTerceira}

${paragrafos.join('\n\n')}

${demaisClausulas.map(c => `${c.titulo}\n${c.texto}`).join('\n\n')}

E por estarem assim justos e contratados, assinam na presença de duas testemunhas para que passe a produzir todos os seus efeitos legais.

Belo Horizonte, ${dataAtual}.

_____________________________________
Contratado: Egg Nunes Advogados Associados
Neste ato representado por seu sócio Marcos Luiz Egg Nunes, OAB/MG 115.283

_______________________________________
Contratado: Rafael Egg Nunes, OAB/MG 118.395

_________________________________________
Contratante: ${client.nomeCompleto.toUpperCase()}

Testemunhas:
1ª) _______________________________
2ª) __________________________________`;

    return texto;
  };

  // Abrir pré-visualização
  const abrirPreview = () => {
    if (!client) {
      toast.error("Cliente não selecionado");
      return;
    }

    if (!clausulaPrimeiraGerada) {
      toast.error("Gere a cláusula primeira antes de continuar");
      return;
    }

    if (temHonorariosIniciais && (!valorTotal || !dataVencimento)) {
      toast.error("Preencha os dados de honorários iniciais");
      return;
    }

    if (!temHonorariosIniciais && !temHonorariosExito) {
      toast.error("Selecione pelo menos um tipo de honorários (iniciais ou êxito)");
      return;
    }

    if (temHonorariosExito && !clausulaExitoGerada) {
      toast.error("Gere a cláusula de honorários êxito");
      return;
    }

    const texto = gerarTextoContrato();
    setContractPreviewText(texto);
    setShowPreview(true);
  };

  // Gerar PDF do contrato a partir do texto da pré-visualização
  const gerarContratoPDF = async () => {
    if (!client || !contractPreviewText) {
      toast.error("Erro ao gerar contrato");
      return;
    }

    setGerandoContrato(true);
    
    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 20;
      const maxWidth = pageWidth - (margin * 2);
      let yPos = margin;
      
      // Função para adicionar nova página se necessário
      const checkPageBreak = (height: number) => {
        if (yPos + height > doc.internal.pageSize.getHeight() - margin) {
          doc.addPage();
          yPos = margin;
        }
      };
      
      // Processar o texto da pré-visualização linha por linha
      const lines = contractPreviewText.split('\n');
      
      doc.setFontSize(11);
      
      for (const line of lines) {
        const trimmedLine = line.trim();
        
        // Título principal
        if (trimmedLine === 'CONTRATO DE PRESTAÇÃO DE SERVIÇOS ADVOCATÍCIOS') {
          doc.setFontSize(14);
          doc.setFont('helvetica', 'bold');
          doc.text(trimmedLine, pageWidth / 2, yPos, { align: 'center' });
          doc.setFontSize(11);
          yPos += 15;
          continue;
        }
        
        // Cláusulas (títulos)
        if (trimmedLine.startsWith('Cláusula ') && trimmedLine.length < 30) {
          doc.setFont('helvetica', 'bold');
          checkPageBreak(20);
          doc.text(trimmedLine, margin, yPos);
          yPos += 8;
          continue;
        }
        
        // Linha vazia
        if (!trimmedLine) {
          yPos += 4;
          continue;
        }
        
        // Texto normal
        doc.setFont('helvetica', 'normal');
        const textLines = doc.splitTextToSize(trimmedLine, maxWidth);
        checkPageBreak(textLines.length * 6);
        doc.text(textLines, margin, yPos);
        yPos += textLines.length * 6 + 2;
      }
      
      // Salvar PDF
      const nomeArquivo = `Contrato_${client.nomeCompleto.replace(/\s+/g, '_')}_${format(new Date(), 'ddMMyyyy')}.pdf`;
      doc.save(nomeArquivo);
      
      toast.success("Contrato gerado com sucesso!");
      setShowPreview(false);
      onOpenChange(false);
      
    } catch (error) {
      console.error('Erro ao gerar contrato:', error);
      toast.error("Erro ao gerar contrato. Tente novamente.");
    } finally {
      setGerandoContrato(false);
    }
  };

  // Voltar para edição
  const voltarParaEdicao = () => {
    setShowPreview(false);
  };

  if (isCustomContractProduct) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSignature className="h-5 w-5" />
              Contrato Específico
            </DialogTitle>
            <DialogDescription>
              O produto "{productName}" possui um modelo de contrato específico.
            </DialogDescription>
          </DialogHeader>
          <div className="py-6 text-center">
            <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-sm text-muted-foreground">
              Este produto utiliza um modelo de contrato personalizado que ainda não foi configurado.
              Em breve você poderá gerar contratos para este tipo de produto.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh]">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <FileSignature className="h-5 w-5" />
              Gerador de Contrato Padrão
            </DialogTitle>
            <div className="flex items-center gap-2">
              {rascunhoExistente && (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={carregarRascunho}
                    disabled={carregandoRascunho}
                    title="Carregar rascunho salvo"
                  >
                    {carregandoRascunho ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <FolderOpen className="h-4 w-4" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={deletarRascunho}
                    disabled={deletandoRascunho}
                    title="Excluir rascunho"
                    className="text-destructive hover:text-destructive"
                  >
                    {deletandoRascunho ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </Button>
                </>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={salvarRascunho}
                disabled={salvandoRascunho}
                title="Salvar rascunho"
              >
                {salvandoRascunho ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-1" />
                )}
                Salvar
              </Button>
            </div>
          </div>
          <DialogDescription>
            Preencha os dados para gerar o contrato de {client?.nomeCompleto?.split(' ')[0]} - {productName}
            {rascunhoExistente && (
              <Badge variant="secondary" className="ml-2 text-xs">
                Rascunho disponível
              </Badge>
            )}
          </DialogDescription>
        </DialogHeader>
        
        <ScrollArea className="max-h-[70vh] pr-4">
          <div className="space-y-6 py-4">
            {/* Cláusula Primeira - Objeto */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Target className="h-4 w-4" />
                  Cláusula Primeira - Objeto do Contrato
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="contraPartida">Em face de (parte contrária) *</Label>
                  <Input
                    id="contraPartida"
                    placeholder="Ex: Estado de Minas Gerais, INSS, União Federal..."
                    value={contraPartida}
                    onChange={(e) => setContraPartida(e.target.value)}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="objetoContrato">Objeto do contrato (o que será requerido) *</Label>
                  <Textarea
                    id="objetoContrato"
                    placeholder="Ex: revisão de aposentadoria com inclusão do adicional de insalubridade..."
                    value={objetoContrato}
                    onChange={(e) => setObjetoContrato(e.target.value)}
                    className="min-h-[80px]"
                  />
                </div>
                
                <Button 
                  onClick={gerarClausulaPrimeira} 
                  disabled={gerandoClausulaPrimeira || !contraPartida || !objetoContrato}
                  className="w-full"
                >
                  {gerandoClausulaPrimeira ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4 mr-2" />
                  )}
                  Gerar Cláusula com IA
                </Button>
                
                {clausulaPrimeiraGerada && (
                  <div className="space-y-2">
                    <Label>Cláusula gerada:</Label>
                    <Textarea
                      value={clausulaPrimeiraGerada}
                      onChange={(e) => setClausulaPrimeiraGerada(e.target.value)}
                      className="min-h-[100px] text-sm"
                    />
                    <Badge variant="secondary" className="text-xs">
                      Você pode editar o texto acima se necessário
                    </Badge>
                  </div>
                )}
              </CardContent>
            </Card>
            
            <Separator />
            
            {/* Cláusula Terceira - Honorários */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <CreditCard className="h-4 w-4" />
                  Cláusula Terceira - Honorários
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <div>
                    <Label htmlFor="temHonorariosIniciais" className="cursor-pointer font-medium">
                      Possui honorários iniciais?
                    </Label>
                    <p className="text-xs text-muted-foreground mt-1">
                      Desative caso o cliente contrate apenas honorários de êxito
                    </p>
                  </div>
                  <Switch
                    id="temHonorariosIniciais"
                    checked={temHonorariosIniciais}
                    onCheckedChange={setTemHonorariosIniciais}
                  />
                </div>
                
                {temHonorariosIniciais && (
                  <>
                    <Separator />
                    
                    <div className="space-y-2">
                      <Label>Tipo de pagamento *</Label>
                      <RadioGroup
                        value={tipoHonorarios}
                        onValueChange={(v) => setTipoHonorarios(v as "avista" | "parcelado")}
                        className="flex gap-4"
                      >
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="avista" id="avista" />
                          <Label htmlFor="avista" className="cursor-pointer">À vista</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="parcelado" id="parcelado" />
                          <Label htmlFor="parcelado" className="cursor-pointer">Parcelado</Label>
                        </div>
                      </RadioGroup>
                    </div>
                
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="valorTotal">Valor total (R$) *</Label>
                        <Input
                          id="valorTotal"
                          placeholder="0,00"
                          value={valorTotal}
                          onChange={(e) => setValorTotal(e.target.value)}
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="dataVencimento">Data de vencimento *</Label>
                        <Input
                          id="dataVencimento"
                          placeholder="Ex: 10/01/2025 ou dia 10"
                          value={dataVencimento}
                          onChange={(e) => setDataVencimento(e.target.value)}
                        />
                      </div>
                    </div>
                    
                    {tipoHonorarios === 'parcelado' && (
                      <>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="numeroParcelas">Número de parcelas *</Label>
                            <Input
                              id="numeroParcelas"
                              type="number"
                              placeholder="12"
                              value={numeroParcelas}
                              onChange={(e) => setNumeroParcelas(e.target.value)}
                            />
                          </div>
                          
                          <div className="space-y-2">
                            <Label htmlFor="valorParcela">Valor de cada parcela (R$) *</Label>
                            <Input
                              id="valorParcela"
                              placeholder="0,00"
                              value={valorParcela}
                              onChange={(e) => setValorParcela(e.target.value)}
                            />
                          </div>
                        </div>
                        
                        <div className="flex items-center justify-between">
                          <Label htmlFor="temEntrada" className="cursor-pointer">Possui entrada?</Label>
                          <Switch
                            id="temEntrada"
                            checked={temEntrada}
                            onCheckedChange={setTemEntrada}
                          />
                        </div>
                        
                        {temEntrada && (
                          <div className="space-y-2">
                            <Label htmlFor="valorEntrada">Valor da entrada (R$) *</Label>
                            <Input
                              id="valorEntrada"
                              placeholder="0,00"
                              value={valorEntrada}
                              onChange={(e) => setValorEntrada(e.target.value)}
                            />
                          </div>
                        )}
                      </>
                    )}
                    
                    <div className="space-y-2">
                      <Label>Forma de pagamento *</Label>
                      <Select value={formaPagamento} onValueChange={(v) => setFormaPagamento(v as "pix" | "cartao" | "boleto")}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pix">PIX</SelectItem>
                          <SelectItem value="cartao">Cartão de Crédito</SelectItem>
                          <SelectItem value="boleto">Boleto Bancário</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
            
            <Separator />
            
            {/* Honorários de Êxito */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Award className="h-4 w-4" />
                    Honorários de Êxito
                  </CardTitle>
                  <Switch
                    checked={temHonorariosExito}
                    onCheckedChange={setTemHonorariosExito}
                  />
                </div>
              </CardHeader>
              {temHonorariosExito && (
                <CardContent className="space-y-4">
                  {/* Templates salvos */}
                  {templates.length > 0 && (
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">Templates salvos</Label>
                      <div className="flex flex-wrap gap-2">
                        {templates.map((template) => (
                          <div key={template.id} className="flex items-center gap-1">
                            <Badge 
                              variant="outline" 
                              className="cursor-pointer hover:bg-primary/10"
                              onClick={() => carregarTemplate(template)}
                            >
                              {template.name}
                            </Badge>
                            <button
                              onClick={() => deletarTemplate(template.id)}
                              className="text-muted-foreground hover:text-destructive p-0.5"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="descricaoHonorariosExito">
                        Descreva os honorários de êxito *
                      </Label>
                      {descricaoHonorariosExito && !showSaveTemplate && (
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => setShowSaveTemplate(true)}
                          className="h-6 text-xs"
                        >
                          <Save className="h-3 w-3 mr-1" />
                          Salvar como template
                        </Button>
                      )}
                    </div>
                    <Textarea
                      id="descricaoHonorariosExito"
                      placeholder="Ex: Em caso de êxito, será devido 20% do valor obtido na causa, a ser pago em até 6 parcelas..."
                      value={descricaoHonorariosExito}
                      onChange={(e) => setDescricaoHonorariosExito(e.target.value)}
                      className="min-h-[80px]"
                    />
                  </div>

                  {/* Salvar como template */}
                  {showSaveTemplate && (
                    <div className="flex gap-2 items-end p-3 rounded-lg bg-muted/50">
                      <div className="flex-1 space-y-1">
                        <Label htmlFor="templateName" className="text-xs">Nome do template</Label>
                        <Input
                          id="templateName"
                          placeholder="Ex: Êxito 20% - Padrão"
                          value={templateName}
                          onChange={(e) => setTemplateName(e.target.value)}
                          className="h-8"
                        />
                      </div>
                      <Button 
                        size="sm" 
                        onClick={salvarTemplate}
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
                  )}
                  
                  <Button 
                    onClick={gerarClausulaExito} 
                    disabled={gerandoClausulaExito || !descricaoHonorariosExito}
                    variant="outline"
                    className="w-full"
                  >
                    {gerandoClausulaExito ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Sparkles className="h-4 w-4 mr-2" />
                    )}
                    Gerar Cláusula de Êxito com IA
                  </Button>
                  
                  {clausulaExitoGerada && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label>Cláusula gerada:</Label>
                        <Badge variant="secondary" className="text-xs">
                          Editável - ajuste se necessário
                        </Badge>
                      </div>
                      <Textarea
                        value={clausulaExitoGerada}
                        onChange={(e) => setClausulaExitoGerada(e.target.value)}
                        className="min-h-[100px] text-sm"
                      />
                    </div>
                  )}
                </CardContent>
              )}
            </Card>
          </div>
        </ScrollArea>
        
        {/* Pré-visualização */}
        {showPreview ? (
          <>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Badge variant="outline" className="text-sm">
                  <FileText className="h-3 w-3 mr-1" />
                  Pré-visualização do Contrato
                </Badge>
                <p className="text-xs text-muted-foreground">
                  Edite o texto abaixo se necessário antes de gerar o PDF
                </p>
              </div>
              <Textarea
                value={contractPreviewText}
                onChange={(e) => setContractPreviewText(e.target.value)}
                className="min-h-[60vh] font-mono text-sm leading-relaxed"
              />
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={voltarParaEdicao}>
                Voltar e Editar
              </Button>
              <Button 
                onClick={gerarContratoPDF} 
                disabled={gerandoContrato}
              >
                {gerandoContrato ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Download className="h-4 w-4 mr-2" />
                )}
                Gerar PDF Final
              </Button>
            </DialogFooter>
          </>
        ) : (
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={abrirPreview} 
              disabled={!clausulaPrimeiraGerada || !valorTotal || !dataVencimento}
            >
              <FileText className="h-4 w-4 mr-2" />
              Pré-visualizar Contrato
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
};
