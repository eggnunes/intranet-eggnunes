import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
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

// Helper para formatar múltiplas formas de pagamento
const formatarFormasPagamento = (formas: string[]): string => {
  const mapa: Record<string, string> = {
    'pix': 'PIX',
    'cartao': 'cartão de crédito',
    'boleto': 'boleto bancário'
  };
  
  const textos = formas.map(f => mapa[f] || f);
  
  if (textos.length === 1) {
    return `via ${textos[0]}`;
  } else if (textos.length === 2) {
    return `via ${textos[0]} ou ${textos[1]}`;
  } else {
    const ultimo = textos.pop();
    return `via ${textos.join(', ')} ou ${ultimo}`;
  }
};

// Helper para toggle de forma de pagamento em array
const toggleFormaPagamento = (
  formas: string[], 
  forma: string, 
  setFormas: (formas: string[]) => void
) => {
  if (formas.includes(forma)) {
    // Não permitir desmarcar se for a única opção
    if (formas.length > 1) {
      setFormas(formas.filter(f => f !== forma));
    }
  } else {
    setFormas([...formas, forma]);
  }
};

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
  // Múltiplas opções de pagamento (ex: PIX ou Cartão para entrada)
  const [formasPagamentoEntrada, setFormasPagamentoEntrada] = useState<string[]>(["pix"]);
  const [formasPagamentoParcelas, setFormasPagamentoParcelas] = useState<string[]>(["boleto"]);
  const [formasPagamento, setFormasPagamento] = useState<string[]>(["pix"]);
  const [dataVencimento, setDataVencimento] = useState("");

  // Honorários Êxito - Múltiplas opções
  interface ExitoOption {
    id: string;
    descricao: string;
    clausulaGerada: string;
    gerando: boolean;
  }
  const [temHonorariosExito, setTemHonorariosExito] = useState(false);
  const [exitoOptions, setExitoOptions] = useState<ExitoOption[]>([
    { id: crypto.randomUUID(), descricao: "", clausulaGerada: "", gerando: false }
  ]);
  
  // Templates de honorários êxito
  const [templates, setTemplates] = useState<{id: string; name: string; description: string; is_default?: boolean}[]>([]);
  const [showSaveTemplate, setShowSaveTemplate] = useState(false);
  const [showCreateDefaultExitoTemplate, setShowCreateDefaultExitoTemplate] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [loadingTemplates, setLoadingTemplates] = useState(false);

  // Templates de honorários iniciais
  interface InitialFeeTemplate {
    id: string;
    name: string;
    tipo_honorarios: string;
    valor_total?: string;
    numero_parcelas?: string;
    valor_parcela?: string;
    tem_entrada?: boolean;
    valor_entrada?: string;
    forma_pagamento?: string;
    forma_pagamento_entrada?: string;
    forma_pagamento_parcelas?: string;
    descricao?: string;
    is_default?: boolean;
  }
  const [initialFeeTemplates, setInitialFeeTemplates] = useState<InitialFeeTemplate[]>([]);
  const [showSaveInitialTemplate, setShowSaveInitialTemplate] = useState(false);
  const [showCreateDefaultTemplate, setShowCreateDefaultTemplate] = useState(false);
  const [initialTemplateName, setInitialTemplateName] = useState("");
  const [initialTemplateDescricao, setInitialTemplateDescricao] = useState("");
  const [savingInitialTemplate, setSavingInitialTemplate] = useState(false);

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
  const { isAdmin } = useUserRole();

  // Verificar se é um produto com contrato específico
  const isCustomContractProduct = CUSTOM_CONTRACT_PRODUCTS.some(
    p => productName.toLowerCase().includes(p.toLowerCase())
  );

  // Carregar templates de honorários êxito e iniciais
  useEffect(() => {
    const loadAllTemplates = async () => {
      if (!open) return;
      
      setLoadingTemplates(true);
      try {
        // Carregar templates de êxito (próprios e padrão)
        const { data: successData, error: successError } = await supabase
          .from('success_fee_templates')
          .select('id, name, description, is_default')
          .or(user ? `user_id.eq.${user.id},is_default.eq.true` : 'is_default.eq.true')
          .order('is_default', { ascending: false })
          .order('name');
        
        if (successError) throw successError;
        setTemplates(successData || []);

        // Carregar templates de honorários iniciais (próprios e padrão)
        const { data: initialData, error: initialError } = await supabase
          .from('initial_fee_templates')
          .select('*')
          .or(user ? `user_id.eq.${user.id},is_default.eq.true` : 'is_default.eq.true')
          .order('is_default', { ascending: false })
          .order('name');
        
        if (initialError) throw initialError;
        setInitialFeeTemplates(initialData || []);
      } catch (error) {
        console.error('Erro ao carregar templates:', error);
      } finally {
        setLoadingTemplates(false);
      }
    };

    loadAllTemplates();
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
        setFormasPagamento(data.forma_pagamento ? [data.forma_pagamento] : ["pix"]);
        setDataVencimento(data.data_vencimento || "");
        setTemHonorariosExito(data.tem_honorarios_exito || false);
        if (data.descricao_honorarios_exito || data.clausula_exito_gerada) {
          setExitoOptions([{
            id: crypto.randomUUID(),
            descricao: data.descricao_honorarios_exito || "",
            clausulaGerada: data.clausula_exito_gerada || "",
            gerando: false
          }]);
        }
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
        forma_pagamento: formasPagamento.join(','),
        data_vencimento: dataVencimento,
        tem_honorarios_exito: temHonorariosExito,
        descricao_honorarios_exito: exitoOptions.map(o => o.descricao).join(' | '),
        clausula_exito_gerada: exitoOptions.map(o => o.clausulaGerada).join('\n\n'),
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

  // Salvar template de honorários êxito (usuário comum)
  const salvarTemplate = async () => {
    const primeiraOpcao = exitoOptions[0];
    if (!templateName.trim() || !primeiraOpcao.descricao.trim() || !user) {
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
          description: primeiraOpcao.descricao.trim(),
        });

      if (error) throw error;

      // Recarregar templates
      const { data } = await supabase
        .from('success_fee_templates')
        .select('id, name, description, is_default')
        .or(user ? `user_id.eq.${user.id},is_default.eq.true` : 'is_default.eq.true')
        .order('is_default', { ascending: false })
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

  // Criar template padrão de êxito (apenas admin)
  const criarTemplatePadraoExito = async () => {
    const primeiraOpcao = exitoOptions[0];
    if (!templateName.trim() || !primeiraOpcao.descricao.trim() || !user || !isAdmin) {
      toast.error("Preencha o nome do template e a descrição");
      return;
    }

    setSavingTemplate(true);
    try {
      const { error } = await supabase
        .from('success_fee_templates')
        .insert({
          user_id: null,
          is_default: true,
          name: templateName.trim(),
          description: primeiraOpcao.descricao.trim(),
        });

      if (error) throw error;

      // Recarregar templates
      const { data } = await supabase
        .from('success_fee_templates')
        .select('id, name, description, is_default')
        .or(user ? `user_id.eq.${user.id},is_default.eq.true` : 'is_default.eq.true')
        .order('is_default', { ascending: false })
        .order('name');
      
      setTemplates(data || []);
      setTemplateName("");
      setShowCreateDefaultExitoTemplate(false);
      toast.success("Template padrão criado com sucesso!");
    } catch (error) {
      console.error('Erro ao criar template padrão:', error);
      toast.error("Erro ao criar template padrão");
    } finally {
      setSavingTemplate(false);
    }
  };

  // Carregar template de êxito selecionado (na primeira opção)
  const carregarTemplate = (template: {id: string; name: string; description: string}) => {
    setExitoOptions(prev => {
      const updated = [...prev];
      updated[0] = { ...updated[0], descricao: template.description, clausulaGerada: "" };
      return updated;
    });
    toast.success(`Template "${template.name}" carregado`);
  };

  // Deletar template de êxito (admin pode deletar padrão, usuário só os seus)
  const deletarTemplate = async (templateId: string, isDefault?: boolean) => {
    if (isDefault && !isAdmin) {
      toast.error("Apenas administradores podem excluir templates padrão");
      return;
    }
    
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

  // Adicionar nova opção de êxito
  const adicionarOpcaoExito = () => {
    setExitoOptions(prev => [...prev, { id: crypto.randomUUID(), descricao: "", clausulaGerada: "", gerando: false }]);
  };

  // Remover opção de êxito
  const removerOpcaoExito = (id: string) => {
    if (exitoOptions.length === 1) {
      toast.error("Deve haver pelo menos uma opção de honorários êxito");
      return;
    }
    setExitoOptions(prev => prev.filter(o => o.id !== id));
  };

  // Atualizar descrição de uma opção
  const atualizarDescricaoExito = (id: string, descricao: string) => {
    setExitoOptions(prev => prev.map(o => o.id === id ? { ...o, descricao } : o));
  };

  // Atualizar cláusula gerada de uma opção
  const atualizarClausulaExito = (id: string, clausulaGerada: string) => {
    setExitoOptions(prev => prev.map(o => o.id === id ? { ...o, clausulaGerada } : o));
  };

  // Salvar template de honorários iniciais (usuário comum)
  const salvarTemplateInicial = async () => {
    if (!initialTemplateName.trim() || !user) {
      toast.error("Preencha o nome do template");
      return;
    }

    setSavingInitialTemplate(true);
    try {
      const { error } = await supabase
        .from('initial_fee_templates')
        .insert({
          user_id: user.id,
          name: initialTemplateName.trim(),
          descricao: initialTemplateDescricao.trim() || null,
          tipo_honorarios: tipoHonorarios,
          valor_total: valorTotal || null,
          numero_parcelas: numeroParcelas || null,
          valor_parcela: valorParcela || null,
          tem_entrada: temEntrada,
          valor_entrada: valorEntrada || null,
          forma_pagamento: formasPagamento.join(','),
          forma_pagamento_entrada: temEntrada ? formasPagamentoEntrada.join(',') : null,
          forma_pagamento_parcelas: tipoHonorarios === 'parcelado' ? formasPagamentoParcelas.join(',') : null,
        });

      if (error) throw error;

      // Recarregar templates
      const { data } = await supabase
        .from('initial_fee_templates')
        .select('*')
        .or(user ? `user_id.eq.${user.id},is_default.eq.true` : 'is_default.eq.true')
        .order('is_default', { ascending: false })
        .order('name');
      
      setInitialFeeTemplates(data || []);
      setInitialTemplateName("");
      setInitialTemplateDescricao("");
      setShowSaveInitialTemplate(false);
      toast.success("Template de honorários iniciais salvo!");
    } catch (error) {
      console.error('Erro ao salvar template:', error);
      toast.error("Erro ao salvar template");
    } finally {
      setSavingInitialTemplate(false);
    }
  };

  // Criar template padrão (apenas admin)
  const criarTemplatePadrao = async () => {
    if (!initialTemplateName.trim() || !user || !isAdmin) {
      toast.error("Preencha o nome do template");
      return;
    }

    setSavingInitialTemplate(true);
    try {
      const { error } = await supabase
        .from('initial_fee_templates')
        .insert({
          user_id: null,
          is_default: true,
          name: initialTemplateName.trim(),
          descricao: initialTemplateDescricao.trim() || null,
          tipo_honorarios: tipoHonorarios,
          valor_total: valorTotal || null,
          numero_parcelas: numeroParcelas || null,
          valor_parcela: valorParcela || null,
          tem_entrada: temEntrada,
          valor_entrada: valorEntrada || null,
          forma_pagamento: formasPagamento.join(','),
          forma_pagamento_entrada: temEntrada ? formasPagamentoEntrada.join(',') : null,
          forma_pagamento_parcelas: tipoHonorarios === 'parcelado' ? formasPagamentoParcelas.join(',') : null,
        });

      if (error) throw error;

      // Recarregar templates
      const { data } = await supabase
        .from('initial_fee_templates')
        .select('*')
        .or(user ? `user_id.eq.${user.id},is_default.eq.true` : 'is_default.eq.true')
        .order('is_default', { ascending: false })
        .order('name');
      
      setInitialFeeTemplates(data || []);
      setInitialTemplateName("");
      setInitialTemplateDescricao("");
      setShowCreateDefaultTemplate(false);
      toast.success("Template padrão criado com sucesso!");
    } catch (error) {
      console.error('Erro ao criar template padrão:', error);
      toast.error("Erro ao criar template padrão");
    } finally {
      setSavingInitialTemplate(false);
    }
  };

  // Carregar template de honorários iniciais
  const carregarTemplateInicial = (template: InitialFeeTemplate) => {
    setTipoHonorarios((template.tipo_honorarios as "avista" | "parcelado") || "avista");
    if (template.valor_total) setValorTotal(template.valor_total);
    if (template.numero_parcelas) setNumeroParcelas(template.numero_parcelas);
    if (template.valor_parcela) setValorParcela(template.valor_parcela);
    setTemEntrada(template.tem_entrada || false);
    if (template.valor_entrada) setValorEntrada(template.valor_entrada);
    setFormasPagamento(template.forma_pagamento ? template.forma_pagamento.split(',') : ["pix"]);
    if (template.forma_pagamento_entrada) {
      setFormasPagamentoEntrada(template.forma_pagamento_entrada.split(','));
    }
    if (template.forma_pagamento_parcelas) {
      setFormasPagamentoParcelas(template.forma_pagamento_parcelas.split(','));
    }
    toast.success(`Template "${template.name}" carregado`);
  };

  // Deletar template de honorários iniciais (admin pode deletar padrão, usuário só os seus)
  const deletarTemplateInicial = async (templateId: string, isDefault?: boolean) => {
    if (isDefault && !isAdmin) {
      toast.error("Apenas administradores podem excluir templates padrão");
      return;
    }
    
    try {
      const { error } = await supabase
        .from('initial_fee_templates')
        .delete()
        .eq('id', templateId);
      
      if (error) throw error;
      
      setInitialFeeTemplates(prev => prev.filter(t => t.id !== templateId));
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

  // Gerar cláusula de honorários êxito com IA para uma opção específica
  const gerarClausulaExitoParaOpcao = async (opcaoId: string) => {
    const opcao = exitoOptions.find(o => o.id === opcaoId);
    if (!opcao || !opcao.descricao.trim()) {
      toast.error("Descreva os honorários de êxito");
      return;
    }

    // Marcar como gerando
    setExitoOptions(prev => prev.map(o => o.id === opcaoId ? { ...o, gerando: true } : o));
    
    try {
      const prompt = `Você é um advogado especialista em contratos de prestação de serviços advocatícios.

Gere uma cláusula de honorários de êxito para um contrato de prestação de serviços advocatícios.

Contexto do contrato:
- Parte contrária: ${contraPartida || 'Não informada'}
- Objeto do contrato: ${objetoContrato || 'Não informado'}

Descrição dos honorários de êxito informada pelo usuário:
${opcao.descricao}

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
        setExitoOptions(prev => prev.map(o => o.id === opcaoId ? { ...o, clausulaGerada: clausulaLimpa, gerando: false } : o));
        toast.success("Cláusula de honorários êxito gerada com sucesso!");
      }
    } catch (error) {
      console.error('Erro ao gerar cláusula de êxito:', error);
      toast.error("Erro ao gerar cláusula. Tente novamente.");
      setExitoOptions(prev => prev.map(o => o.id === opcaoId ? { ...o, gerando: false } : o));
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
    // Verificar se tem cláusulas de êxito geradas
    const clausulasExitoGeradas = exitoOptions.filter(o => o.clausulaGerada.trim());
    const temClausulasExito = temHonorariosExito && clausulasExitoGeradas.length > 0;
    const temAmbos = temHonorariosIniciais && temClausulasExito;
    
    let textoHonorariosIniciais = '';
    
    if (temHonorariosIniciais) {
      const valorFormatado = parseFloat(valorTotal.replace(/\./g, '').replace(',', '.') || '0');
      const valorExtenso = valorPorExtenso(valorTotal);
      
      // Só adiciona letra se tiver ambos os tipos de honorários
      const prefixo = temAmbos ? 'a) ' : '';
      
      if (tipoHonorarios === 'avista') {
        const formaPagamentoTexto = formatarFormasPagamento(formasPagamento);
        
        textoHonorariosIniciais = `${prefixo}R$${new Intl.NumberFormat('pt-BR').format(valorFormatado)} ${valorExtenso} à vista que serão pagos ${formaPagamentoTexto} até o dia ${dataVencimento || '[DATA]'} para a seguinte conta: Banco Itaú, agência 1403, conta corrente 68937-3, em nome de Egg Nunes Advogados Associados, CNPJ/PIX: 10378694/0001-59.`;
      } else {
        const numParcelas = parseInt(numeroParcelas) || 0;
        const valorParcelaNum = parseFloat(valorParcela.replace(/\./g, '').replace(',', '.') || '0');
        const valorEntradaNum = parseFloat(valorEntrada.replace(/\./g, '').replace(',', '.') || '0');
        
        if (temEntrada && valorEntradaNum > 0) {
          const formaPagamentoEntradaTexto = formatarFormasPagamento(formasPagamentoEntrada);
          const formaPagamentoParcelasTexto = formatarFormasPagamento(formasPagamentoParcelas);
          textoHonorariosIniciais = `${prefixo}R$${new Intl.NumberFormat('pt-BR').format(valorFormatado)} ${valorExtenso} parcelados, sendo R$${new Intl.NumberFormat('pt-BR').format(valorEntradaNum)} de entrada ${formaPagamentoEntradaTexto} e mais ${numParcelas} parcelas de R$${new Intl.NumberFormat('pt-BR').format(valorParcelaNum)} cada ${formaPagamentoParcelasTexto}, com vencimento para o dia ${dataVencimento || '[DATA]'} de cada mês, para a seguinte conta: Banco Itaú, agência 1403, conta corrente 68937-3, em nome de Egg Nunes Advogados Associados, CNPJ/PIX: 10378694/0001-59.`;
        } else {
          const formaPagamentoTexto = formatarFormasPagamento(formasPagamentoParcelas);
          textoHonorariosIniciais = `${prefixo}R$${new Intl.NumberFormat('pt-BR').format(valorFormatado)} ${valorExtenso} parcelados em ${numParcelas} parcelas de R$${new Intl.NumberFormat('pt-BR').format(valorParcelaNum)} cada, ${formaPagamentoTexto}, com vencimento para o dia ${dataVencimento || '[DATA]'} de cada mês, para a seguinte conta: Banco Itaú, agência 1403, conta corrente 68937-3, em nome de Egg Nunes Advogados Associados, CNPJ/PIX: 10378694/0001-59.`;
        }
      }
    }
    
    let textoHonorariosExito = '';
    if (temClausulasExito) {
      // Se tem apenas uma cláusula de êxito
      if (clausulasExitoGeradas.length === 1) {
        const prefixo = temAmbos ? 'b) ' : '';
        textoHonorariosExito = `${prefixo}${clausulasExitoGeradas[0].clausulaGerada}`;
      } else {
        // Múltiplas cláusulas de êxito - usar sub-letras (b.1, b.2, etc.)
        const prefixo = temAmbos ? 'b) Honorários de êxito:\n\n' : '';
        const clausulasFormatadas = clausulasExitoGeradas.map((opcao, index) => {
          const subLetra = temAmbos ? `b.${index + 1}) ` : `${String.fromCharCode(97 + index)}) `;
          return `${subLetra}${opcao.clausulaGerada}`;
        }).join('\n\n');
        textoHonorariosExito = prefixo + clausulasFormatadas;
      }
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

    const clausulasExitoGeradas = exitoOptions.filter(o => o.clausulaGerada.trim());
    if (temHonorariosExito && clausulasExitoGeradas.length === 0) {
      toast.error("Gere pelo menos uma cláusula de honorários êxito");
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

                    {/* Templates de honorários iniciais */}
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
                      {initialFeeTemplates.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {initialFeeTemplates.map((template) => (
                            <div key={template.id} className="flex items-center gap-1">
                              <Badge 
                                variant={template.is_default ? "secondary" : "outline"}
                                className="cursor-pointer hover:bg-primary/10"
                                onClick={() => carregarTemplateInicial(template)}
                                title={template.descricao || template.name}
                              >
                                {template.name}
                                {template.is_default && <span className="ml-1 text-[10px] opacity-60">(padrão)</span>}
                              </Badge>
                              {(!template.is_default || isAdmin) && (
                                <button
                                  onClick={() => deletarTemplateInicial(template.id, template.is_default)}
                                  className="text-muted-foreground hover:text-destructive p-0.5"
                                  title={template.is_default ? "Excluir template padrão (admin)" : "Excluir template"}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    
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
                    
                    {tipoHonorarios === 'avista' && (
                      <div className="space-y-2">
                        <Label>Formas de pagamento aceitas * <span className="text-xs text-muted-foreground">(selecione uma ou mais)</span></Label>
                        <div className="flex flex-wrap gap-3">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <Checkbox 
                              checked={formasPagamento.includes('pix')}
                              onCheckedChange={() => toggleFormaPagamento(formasPagamento, 'pix', setFormasPagamento)}
                            />
                            <span className="text-sm">PIX</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <Checkbox 
                              checked={formasPagamento.includes('cartao')}
                              onCheckedChange={() => toggleFormaPagamento(formasPagamento, 'cartao', setFormasPagamento)}
                            />
                            <span className="text-sm">Cartão de Crédito</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <Checkbox 
                              checked={formasPagamento.includes('boleto')}
                              onCheckedChange={() => toggleFormaPagamento(formasPagamento, 'boleto', setFormasPagamento)}
                            />
                            <span className="text-sm">Boleto Bancário</span>
                          </label>
                        </div>
                        {formasPagamento.length > 1 && (
                          <p className="text-xs text-muted-foreground">
                            No contrato: "{formatarFormasPagamento(formasPagamento)}"
                          </p>
                        )}
                      </div>
                    )}
                    
                    {tipoHonorarios === 'parcelado' && (
                      <>
                        <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                          <div>
                            <Label htmlFor="temEntrada" className="cursor-pointer font-medium">Possui entrada?</Label>
                            <p className="text-xs text-muted-foreground">Ex: entrada via PIX ou Cartão + parcelas via boleto</p>
                          </div>
                          <Switch
                            id="temEntrada"
                            checked={temEntrada}
                            onCheckedChange={setTemEntrada}
                          />
                        </div>
                        
                        {temEntrada && (
                          <div className="p-3 rounded-lg border border-primary/20 bg-primary/5 space-y-3">
                            <Label className="text-sm font-medium">Entrada</Label>
                            <div className="space-y-3">
                              <div className="space-y-1">
                                <Label htmlFor="valorEntrada" className="text-xs">Valor (R$) *</Label>
                                <Input
                                  id="valorEntrada"
                                  placeholder="0,00"
                                  value={valorEntrada}
                                  onChange={(e) => setValorEntrada(e.target.value)}
                                  className="h-9"
                                />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-xs">Formas de pagamento aceitas * <span className="text-muted-foreground">(selecione uma ou mais)</span></Label>
                                <div className="flex flex-wrap gap-3">
                                  <label className="flex items-center gap-2 cursor-pointer">
                                    <Checkbox 
                                      checked={formasPagamentoEntrada.includes('pix')}
                                      onCheckedChange={() => toggleFormaPagamento(formasPagamentoEntrada, 'pix', setFormasPagamentoEntrada)}
                                    />
                                    <span className="text-sm">PIX</span>
                                  </label>
                                  <label className="flex items-center gap-2 cursor-pointer">
                                    <Checkbox 
                                      checked={formasPagamentoEntrada.includes('cartao')}
                                      onCheckedChange={() => toggleFormaPagamento(formasPagamentoEntrada, 'cartao', setFormasPagamentoEntrada)}
                                    />
                                    <span className="text-sm">Cartão de Crédito</span>
                                  </label>
                                  <label className="flex items-center gap-2 cursor-pointer">
                                    <Checkbox 
                                      checked={formasPagamentoEntrada.includes('boleto')}
                                      onCheckedChange={() => toggleFormaPagamento(formasPagamentoEntrada, 'boleto', setFormasPagamentoEntrada)}
                                    />
                                    <span className="text-sm">Boleto Bancário</span>
                                  </label>
                                </div>
                                {formasPagamentoEntrada.length > 1 && (
                                  <p className="text-xs text-muted-foreground mt-1">
                                    No contrato: "{formatarFormasPagamento(formasPagamentoEntrada)}"
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                        
                        <div className="p-3 rounded-lg border space-y-3">
                          <Label className="text-sm font-medium">Parcelas</Label>
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <Label htmlFor="numeroParcelas" className="text-xs">Quantidade *</Label>
                              <Input
                                id="numeroParcelas"
                                type="number"
                                placeholder="12"
                                value={numeroParcelas}
                                onChange={(e) => setNumeroParcelas(e.target.value)}
                                className="h-9"
                              />
                            </div>
                            
                            <div className="space-y-1">
                              <Label htmlFor="valorParcela" className="text-xs">Valor (R$) *</Label>
                              <Input
                                id="valorParcela"
                                placeholder="0,00"
                                value={valorParcela}
                                onChange={(e) => setValorParcela(e.target.value)}
                                className="h-9"
                              />
                            </div>
                          </div>

                          <div className="space-y-1">
                            <Label className="text-xs">Formas de pagamento aceitas * <span className="text-muted-foreground">(selecione uma ou mais)</span></Label>
                            <div className="flex flex-wrap gap-3">
                              <label className="flex items-center gap-2 cursor-pointer">
                                <Checkbox 
                                  checked={formasPagamentoParcelas.includes('pix')}
                                  onCheckedChange={() => toggleFormaPagamento(formasPagamentoParcelas, 'pix', setFormasPagamentoParcelas)}
                                />
                                <span className="text-sm">PIX</span>
                              </label>
                              <label className="flex items-center gap-2 cursor-pointer">
                                <Checkbox 
                                  checked={formasPagamentoParcelas.includes('cartao')}
                                  onCheckedChange={() => toggleFormaPagamento(formasPagamentoParcelas, 'cartao', setFormasPagamentoParcelas)}
                                />
                                <span className="text-sm">Cartão de Crédito</span>
                              </label>
                              <label className="flex items-center gap-2 cursor-pointer">
                                <Checkbox 
                                  checked={formasPagamentoParcelas.includes('boleto')}
                                  onCheckedChange={() => toggleFormaPagamento(formasPagamentoParcelas, 'boleto', setFormasPagamentoParcelas)}
                                />
                                <span className="text-sm">Boleto Bancário</span>
                              </label>
                            </div>
                            {formasPagamentoParcelas.length > 1 && (
                              <p className="text-xs text-muted-foreground mt-1">
                                No contrato: "{formatarFormasPagamento(formasPagamentoParcelas)}"
                              </p>
                            )}
                          </div>
                        </div>
                      </>
                    )}

                    {/* Salvar como template */}
                    {!showSaveInitialTemplate && !showCreateDefaultTemplate ? (
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => setShowSaveInitialTemplate(true)}
                        className="w-full text-xs"
                      >
                        <Save className="h-3 w-3 mr-1" />
                        Salvar configuração como template pessoal
                      </Button>
                    ) : showSaveInitialTemplate ? (
                      <div className="space-y-2 p-3 rounded-lg bg-muted/50">
                        <div className="space-y-1">
                          <Label htmlFor="initialTemplateName" className="text-xs">Nome do template</Label>
                          <Input
                            id="initialTemplateName"
                            placeholder="Ex: Parcelado 12x com entrada"
                            value={initialTemplateName}
                            onChange={(e) => setInitialTemplateName(e.target.value)}
                            className="h-8"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor="initialTemplateDescricao" className="text-xs">Descrição (opcional)</Label>
                          <Input
                            id="initialTemplateDescricao"
                            placeholder="Ex: Entrada R$ 1.200 PIX + 12x boleto"
                            value={initialTemplateDescricao}
                            onChange={(e) => setInitialTemplateDescricao(e.target.value)}
                            className="h-8"
                          />
                        </div>
                        <div className="flex gap-2">
                          <Button 
                            size="sm" 
                            onClick={salvarTemplateInicial}
                            disabled={savingInitialTemplate || !initialTemplateName.trim()}
                            className="h-8"
                          >
                            {savingInitialTemplate ? <Loader2 className="h-3 w-3 animate-spin" /> : "Salvar"}
                          </Button>
                          <Button 
                            size="sm" 
                            variant="ghost"
                            onClick={() => {
                              setShowSaveInitialTemplate(false);
                              setInitialTemplateName("");
                              setInitialTemplateDescricao("");
                            }}
                            className="h-8"
                          >
                            Cancelar
                          </Button>
                        </div>
                      </div>
                    ) : showCreateDefaultTemplate && isAdmin ? (
                      <div className="space-y-2 p-3 rounded-lg bg-primary/5 border border-primary/20">
                        <Label className="text-xs font-medium text-primary">Criar Template Padrão (visível para todos)</Label>
                        <div className="space-y-1">
                          <Label htmlFor="defaultTemplateName" className="text-xs">Nome do template</Label>
                          <Input
                            id="defaultTemplateName"
                            placeholder="Ex: Parcelado 12x com entrada"
                            value={initialTemplateName}
                            onChange={(e) => setInitialTemplateName(e.target.value)}
                            className="h-8"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor="defaultTemplateDescricao" className="text-xs">Descrição (opcional)</Label>
                          <Input
                            id="defaultTemplateDescricao"
                            placeholder="Ex: Entrada R$ 1.200 PIX + 12x boleto"
                            value={initialTemplateDescricao}
                            onChange={(e) => setInitialTemplateDescricao(e.target.value)}
                            className="h-8"
                          />
                        </div>
                        <div className="flex gap-2">
                          <Button 
                            size="sm" 
                            onClick={criarTemplatePadrao}
                            disabled={savingInitialTemplate || !initialTemplateName.trim()}
                            className="h-8"
                          >
                            {savingInitialTemplate ? <Loader2 className="h-3 w-3 animate-spin" /> : "Criar Template Padrão"}
                          </Button>
                          <Button 
                            size="sm" 
                            variant="ghost"
                            onClick={() => {
                              setShowCreateDefaultTemplate(false);
                              setInitialTemplateName("");
                              setInitialTemplateDescricao("");
                            }}
                            className="h-8"
                          >
                            Cancelar
                          </Button>
                        </div>
                      </div>
                    ) : null}
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
                  {/* Templates salvos e padrão */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs text-muted-foreground">Templates disponíveis</Label>
                      {isAdmin && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setShowCreateDefaultExitoTemplate(true)}
                          className="h-6 text-xs px-2"
                        >
                          + Novo Template Padrão
                        </Button>
                      )}
                    </div>
                    {templates.length > 0 && (
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
                                title={template.is_default ? "Excluir template padrão (admin)" : "Excluir template"}
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Múltiplas opções de êxito */}
                  {exitoOptions.map((opcao, index) => (
                    <div key={opcao.id} className="space-y-3 p-3 rounded-lg border">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm font-medium">
                          {exitoOptions.length > 1 ? `Opção ${index + 1}` : 'Descrição dos honorários de êxito *'}
                        </Label>
                        {exitoOptions.length > 1 && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removerOpcaoExito(opcao.id)}
                            className="h-6 text-xs text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-3 w-3 mr-1" />
                            Remover
                          </Button>
                        )}
                      </div>
                      
                      <Textarea
                        placeholder="Ex: 30% dos 12 primeiros meses de pagamento..."
                        value={opcao.descricao}
                        onChange={(e) => atualizarDescricaoExito(opcao.id, e.target.value)}
                        className="min-h-[60px]"
                      />
                      
                      <Button 
                        onClick={() => gerarClausulaExitoParaOpcao(opcao.id)} 
                        disabled={opcao.gerando || !opcao.descricao.trim()}
                        variant="outline"
                        size="sm"
                        className="w-full"
                      >
                        {opcao.gerando ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Sparkles className="h-4 w-4 mr-2" />
                        )}
                        Gerar Cláusula com IA
                      </Button>
                      
                      {opcao.clausulaGerada && (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <Label className="text-xs">Cláusula gerada:</Label>
                            <Badge variant="secondary" className="text-xs">
                              Editável
                            </Badge>
                          </div>
                          <Textarea
                            value={opcao.clausulaGerada}
                            onChange={(e) => atualizarClausulaExito(opcao.id, e.target.value)}
                            className="min-h-[80px] text-sm"
                          />
                        </div>
                      )}
                    </div>
                  ))}

                  {/* Botão adicionar opção */}
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={adicionarOpcaoExito}
                    className="w-full"
                  >
                    + Adicionar outra opção de êxito
                  </Button>

                  {/* Salvar como template */}
                  {exitoOptions[0]?.descricao && !showSaveTemplate && !showCreateDefaultExitoTemplate && (
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => setShowSaveTemplate(true)}
                      className="w-full text-xs"
                    >
                      <Save className="h-3 w-3 mr-1" />
                      Salvar primeira opção como template pessoal
                    </Button>
                  )}

                  {showSaveTemplate && (
                    <div className="space-y-2 p-3 rounded-lg bg-muted/50">
                      <div className="space-y-1">
                        <Label htmlFor="templateName" className="text-xs">Nome do template</Label>
                        <Input
                          id="templateName"
                          placeholder="Ex: Êxito 20% - Padrão"
                          value={templateName}
                          onChange={(e) => setTemplateName(e.target.value)}
                          className="h-8"
                        />
                      </div>
                      <div className="flex gap-2">
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
                    </div>
                  )}

                  {showCreateDefaultExitoTemplate && isAdmin && (
                    <div className="space-y-2 p-3 rounded-lg bg-primary/5 border border-primary/20">
                      <Label className="text-xs font-medium text-primary">Criar Template Padrão (visível para todos)</Label>
                      <div className="space-y-1">
                        <Label htmlFor="defaultExitoTemplateName" className="text-xs">Nome do template</Label>
                        <Input
                          id="defaultExitoTemplateName"
                          placeholder="Ex: Êxito 30% retroativos"
                          value={templateName}
                          onChange={(e) => setTemplateName(e.target.value)}
                          className="h-8"
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Será usado o texto da primeira opção de êxito: "{exitoOptions[0]?.descricao?.substring(0, 50) || '...'}..."
                      </p>
                      <div className="flex gap-2">
                        <Button 
                          size="sm" 
                          onClick={criarTemplatePadraoExito}
                          disabled={savingTemplate || !templateName.trim() || !exitoOptions[0]?.descricao}
                          className="h-8"
                        >
                          {savingTemplate ? <Loader2 className="h-3 w-3 animate-spin" /> : "Criar Template Padrão"}
                        </Button>
                        <Button 
                          size="sm" 
                          variant="ghost"
                          onClick={() => {
                            setShowCreateDefaultExitoTemplate(false);
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
