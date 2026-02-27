import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useAdminPermissions } from '@/hooks/useAdminPermissions';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Plus, Search, Edit, Trash2, ExternalLink, RefreshCw, CheckCircle, XCircle, Filter, Loader2, Sparkles, Bell, BarChart3 } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { JurimetriaDashboard } from '@/components/JurimetriaDashboard';

interface FavorableDecision {
  id: string;
  decision_type: string;
  product_name: string;
  client_name: string;
  client_id: string | null;
  lawsuit_id: string | null;
  process_number: string | null;
  court: string | null;
  court_division: string | null;
  decision_date: string;
  decision_link: string | null;
  observation: string | null;
  was_posted: boolean;
  evaluation_requested: boolean;
  was_evaluated: boolean;
  created_at: string;
  created_by: string;
  reu: string | null;
  regiao: string | null;
  materia: string | null;
  resultado: string | null;
  decisao_texto: string | null;
  ai_analysis: any;
  notify_team: boolean;
  notify_message: string | null;
}

interface AdvboxClient {
  id: number;
  name: string;
}

interface AdvboxLawsuit {
  id: number;
  number: string;
  court?: string;
  court_division?: string;
  customer_id?: number;
}

interface RDProduct {
  _id: string;
  name: string;
}

const DECISION_TYPES = [
  { value: 'sentenca', label: 'Sentença' },
  { value: 'liminar', label: 'Liminar' },
  { value: 'acordao', label: 'Acórdão' },
  { value: 'decisao_interlocutoria', label: 'Decisão Interlocutória' },
];

const MATERIAS = [
  { value: 'civil', label: 'Civil' },
  { value: 'trabalhista', label: 'Trabalhista' },
  { value: 'previdenciario', label: 'Previdenciário' },
  { value: 'tributario', label: 'Tributário' },
  { value: 'administrativo', label: 'Administrativo' },
  { value: 'consumidor', label: 'Consumidor' },
  { value: 'imobiliario', label: 'Imobiliário' },
  { value: 'servidor_publico', label: 'Servidor Público' },
  { value: 'outro', label: 'Outro' },
];

const RESULTADOS = [
  { value: 'procedente', label: 'Procedente' },
  { value: 'improcedente', label: 'Improcedente' },
  { value: 'parcialmente_procedente', label: 'Parcialmente Procedente' },
];

// Mapeamento de produtos legados para produtos RD Station
const PRODUCT_NAME_MAPPING: Record<string, string> = {
  'aliquota': 'Retroativo - Alíquota e PSM',
  'alíquota': 'Retroativo - Alíquota e PSM',
  'ipsm': 'Retroativo - Alíquota e PSM',
  'ipsm aliquota': 'Retroativo - Alíquota e PSM',
  'ipsm alíquota': 'Retroativo - Alíquota e PSM',
  'retroativo aliquota': 'Retroativo - Alíquota e PSM',
  'retroativo - alíquota e psm': 'Retroativo - Alíquota e PSM',
  'férias-prêmio': 'Férias Prêmio',
  'ferias-premio': 'Férias Prêmio',
  'férias prêmio': 'Férias Prêmio',
  'ferias premio': 'Férias Prêmio',
  'multipropriedade': 'Imobiliário - Multipropriedade',
  'timeshare': 'Imobiliário - Multipropriedade',
  'atraso em obra': 'Imobiliário - Atraso em obra',
  'atraso obra': 'Imobiliário - Atraso em obra',
  'rescisão': 'Imobiliário - Rescisão de contrato abusivo',
  'rescisao': 'Imobiliário - Rescisão de contrato abusivo',
  'terço de férias': 'Servidor Público - Terço de Férias',
  'terco de ferias': 'Servidor Público - Terço de Férias',
  'vale refeição': 'Servidor Público - Vale Refeição',
  'vale refeicao': 'Servidor Público - Vale Refeição',
  'isenção ir': 'Servidor Público - Isenção de IR',
  'isencao ir': 'Servidor Público - Isenção de IR',
  'concurso': 'Servidor Público - Concurso Público',
  'concurso público': 'Servidor Público - Concurso Público',
  'concurso publico': 'Servidor Público - Concurso Público',
};

const mapProductName = (productName: string, rdProducts: RDProduct[]): string => {
  if (!productName) return '';
  const normalizedName = productName.toLowerCase().trim();
  const exactMatch = rdProducts.find(p => p.name.toLowerCase() === normalizedName);
  if (exactMatch) return exactMatch.name;
  const mappedName = PRODUCT_NAME_MAPPING[normalizedName];
  if (mappedName) {
    const mappedProduct = rdProducts.find(p => p.name.toLowerCase() === mappedName.toLowerCase());
    if (mappedProduct) return mappedProduct.name;
  }
  const partialMatch = rdProducts.find(p => 
    p.name.toLowerCase().includes(normalizedName) || normalizedName.includes(p.name.toLowerCase())
  );
  if (partialMatch) return partialMatch.name;
  return productName;
};

export default function DecisoesFavoraveis() {
  const { user } = useAuth();
  const { isSocioOrRafael } = useAdminPermissions();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingDecision, setEditingDecision] = useState<FavorableDecision | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterMateria, setFilterMateria] = useState<string>('all');
  const [filterResultado, setFilterResultado] = useState<string>('all');
  const [filterRegiao, setFilterRegiao] = useState<string>('all');
  const [filterReu, setFilterReu] = useState('');
  const [filterDateStart, setFilterDateStart] = useState('');
  const [filterDateEnd, setFilterDateEnd] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isSearchingClients, setIsSearchingClients] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showMissingLinksDialog, setShowMissingLinksDialog] = useState(false);
  const [missingLinksData, setMissingLinksData] = useState<Array<{
    client_name: string;
    decision_date: string;
    product_name: string;
    found: boolean;
    responsible_name?: string;
    lawsuit_number?: string;
  }>>([]);
  const [isLoadingMissingLinks, setIsLoadingMissingLinks] = useState(false);
  const [activeTab, setActiveTab] = useState('decisoes');

  // Form state
  const [formData, setFormData] = useState({
    decision_type: '',
    product_name: '',
    client_name: '',
    client_id: '',
    lawsuit_id: '',
    process_number: '',
    court: '',
    court_division: '',
    decision_date: '',
    decision_link: '',
    observation: '',
    was_posted: false,
    evaluation_requested: false,
    was_evaluated: false,
    reu: '',
    regiao: '',
    materia: '',
    resultado: '',
    decisao_texto: '',
    notify_team: false,
    notify_message: '',
  });

  const [selectedClient, setSelectedClient] = useState<AdvboxClient | null>(null);
  const [clientSearch, setClientSearch] = useState('');
  const [clientLawsuits, setClientLawsuits] = useState<AdvboxLawsuit[]>([]);
  const [loadingLawsuits, setLoadingLawsuits] = useState(false);
  const [productSearch, setProductSearch] = useState('');

  // Fetch decisions
  const { data: decisions = [], isLoading: loadingDecisions } = useQuery({
    queryKey: ['favorable-decisions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('favorable_decisions')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as FavorableDecision[];
    },
  });

  // Fetch Advbox clients from local synced table
  const { data: advboxClients = [], isLoading: loadingClients, refetch: refetchClients } = useQuery({
    queryKey: ['advbox-customers-search', clientSearch],
    queryFn: async () => {
      if (clientSearch.length < 2) return [];
      const normalizedSearch = clientSearch.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
      const { data, error } = await supabase
        .from('advbox_customers')
        .select('advbox_id, name')
        .or(`name.ilike.%${clientSearch}%,name.ilike.%${normalizedSearch}%`)
        .order('name')
        .limit(50);
      if (error) throw error;
      return (data || []).map((c) => ({ id: c.advbox_id, name: c.name })).filter((c) => c.id && c.name);
    },
    staleTime: 30 * 1000,
    enabled: clientSearch.length >= 2,
  });

  const handleSearchClients = async () => {
    setIsSearchingClients(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) throw new Error('Not authenticated');
      const response = await supabase.functions.invoke('sync-advbox-customers', {
        headers: { Authorization: `Bearer ${session.session.access_token}` },
      });
      await refetchClients();
      const result = response.data;
      if (result?.status === 'partial') {
        toast.info(`${result.total_upserted} clientes sincronizados. Clique novamente para continuar.`);
      } else {
        toast.success('Clientes sincronizados do Advbox');
      }
    } catch (error) {
      console.error('Error syncing clients:', error);
      toast.error('Erro ao sincronizar clientes do Advbox');
    } finally {
      setIsSearchingClients(false);
    }
  };

  // Fetch RD Station products
  const { data: rdProducts = [] } = useQuery({
    queryKey: ['rd-station-products'],
    queryFn: async () => {
      const response = await supabase.functions.invoke('rd-station-products');
      if (response.error) throw response.error;
      return response.data?.products || [];
    },
    staleTime: 5 * 60 * 1000,
  });

  const fetchClientLawsuits = async (clientId: string) => {
    if (!clientId) { setClientLawsuits([]); return; }
    setLoadingLawsuits(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) throw new Error('Not authenticated');
      const response = await supabase.functions.invoke('advbox-integration/lawsuits-full', {
        headers: { Authorization: `Bearer ${session.session.access_token}` },
      });
      if (response.error) throw response.error;
      const allLawsuits = response.data?.data?.items || response.data?.data || [];
      const filteredLawsuits = allLawsuits.filter((l: any) => 
        l.customer_id?.toString() === clientId || l.customers?.some((c: any) => c.id?.toString() === clientId)
      );
      setClientLawsuits(filteredLawsuits.map((l: any) => ({
        id: l.id,
        number: l.number || l.lawsuit_number || '',
        court: l.court || l.tribunal || '',
        court_division: l.court_division || l.vara || l.camara || '',
      })));
    } catch (error) {
      console.error('Error fetching lawsuits:', error);
      setClientLawsuits([]);
    } finally {
      setLoadingLawsuits(false);
    }
  };

  // AI Analysis
  const handleAIAnalysis = async () => {
    if (!formData.observation && !formData.decisao_texto && !formData.product_name) {
      toast.error('Preencha ao menos a observação, texto da decisão ou produto para analisar');
      return;
    }
    setIsAnalyzing(true);
    try {
      const { data, error } = await supabase.functions.invoke('analyze-decision', {
        body: {
          observation: formData.observation,
          decisao_texto: formData.decisao_texto,
          client_name: formData.client_name,
          product_name: formData.product_name,
          court: formData.court,
          decision_type: formData.decision_type,
        },
      });
      if (error) throw error;
      if (data.error) { toast.error(data.error); return; }

      setFormData(prev => ({
        ...prev,
        reu: data.reu || prev.reu,
        regiao: data.regiao || prev.regiao,
        materia: data.materia || prev.materia,
        resultado: data.resultado || prev.resultado,
      }));
      toast.success('Análise de IA concluída! Campos preenchidos automaticamente.');
    } catch (error: any) {
      console.error('AI analysis error:', error);
      toast.error('Erro na análise de IA');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Save decision
  const saveMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const payload = {
        decision_type: data.decision_type,
        product_name: data.product_name,
        client_name: data.client_name,
        client_id: data.client_id || null,
        lawsuit_id: data.lawsuit_id || null,
        process_number: data.process_number || null,
        court: data.court || null,
        court_division: data.court_division || null,
        decision_date: data.decision_date,
        decision_link: data.decision_link || null,
        observation: data.observation || null,
        was_posted: data.was_posted,
        evaluation_requested: data.evaluation_requested,
        was_evaluated: data.was_evaluated,
        reu: data.reu || null,
        regiao: data.regiao || null,
        materia: data.materia || null,
        resultado: data.resultado || null,
        decisao_texto: data.decisao_texto || null,
        notify_team: data.notify_team,
        notify_message: data.notify_message || null,
      };

      if (editingDecision) {
        const { error } = await supabase
          .from('favorable_decisions')
          .update(payload)
          .eq('id', editingDecision.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('favorable_decisions')
          .insert({ ...payload, created_by: user?.id });
        if (error) throw error;
      }

      // Notify team if requested
      if (data.notify_team && data.notify_message && !editingDecision) {
        try {
          const { data: approvedUsers } = await supabase
            .from('profiles')
            .select('id')
            .eq('approval_status', 'approved')
            .eq('is_active', true);

          if (approvedUsers && approvedUsers.length > 0) {
            const notifications = approvedUsers
              .filter(u => u.id !== user?.id)
              .map(u => ({
                user_id: u.id,
                title: '🏛️ Nova Decisão Favorável',
                message: `${data.client_name} - ${data.product_name}: ${data.notify_message.slice(0, 200)}`,
                type: 'favorable_decision',
                action_url: '/decisoes-favoraveis',
              }));

            if (notifications.length > 0) {
              await supabase.from('user_notifications').insert(notifications);
            }
          }
        } catch (err) {
          console.error('Error notifying team:', err);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['favorable-decisions'] });
      toast.success(editingDecision ? 'Decisão atualizada!' : 'Decisão cadastrada!');
      resetForm();
      setIsDialogOpen(false);
      syncToTeams();
    },
    onError: (error) => {
      console.error('Error saving decision:', error);
      toast.error('Erro ao salvar decisão');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('favorable_decisions').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['favorable-decisions'] });
      toast.success('Decisão removida!');
      syncToTeams();
    },
    onError: () => toast.error('Erro ao remover decisão'),
  });

  const syncFromTeams = async () => {
    setIsSyncing(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) throw new Error('Not authenticated');
      await supabase.functions.invoke('favorable-decisions-sync', {
        body: { action: 'sync-from-teams' },
        headers: { Authorization: `Bearer ${session.session.access_token}` },
      });
      queryClient.invalidateQueries({ queryKey: ['favorable-decisions'] });
      toast.success('Dados importados do Teams!');
    } catch (error) {
      console.error('Error syncing from Teams:', error);
      toast.error('Erro ao importar do Teams');
    } finally {
      setIsSyncing(false);
    }
  };

  const syncToTeams = async () => {
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) return;
      await supabase.functions.invoke('favorable-decisions-sync', {
        body: { action: 'sync-to-teams' },
        headers: { Authorization: `Bearer ${session.session.access_token}` },
      });
    } catch (error) {
      console.error('Error syncing to Teams:', error);
    }
  };

  const resetForm = () => {
    setFormData({
      decision_type: '', product_name: '', client_name: '', client_id: '', lawsuit_id: '',
      process_number: '', court: '', court_division: '', decision_date: '', decision_link: '',
      observation: '', was_posted: false, evaluation_requested: false, was_evaluated: false,
      reu: '', regiao: '', materia: '', resultado: '', decisao_texto: '',
      notify_team: false, notify_message: '',
    });
    setSelectedClient(null);
    setClientSearch('');
    setClientLawsuits([]);
    setEditingDecision(null);
  };

  const openEditDialog = (decision: FavorableDecision) => {
    setEditingDecision(decision);
    const mappedProductName = mapProductName(decision.product_name, rdProducts);
    setFormData({
      decision_type: decision.decision_type,
      product_name: mappedProductName,
      client_name: decision.client_name,
      client_id: decision.client_id || '',
      lawsuit_id: decision.lawsuit_id || '',
      process_number: decision.process_number || '',
      court: decision.court || '',
      court_division: decision.court_division || '',
      decision_date: decision.decision_date,
      decision_link: decision.decision_link || '',
      observation: decision.observation || '',
      was_posted: decision.was_posted,
      evaluation_requested: decision.evaluation_requested,
      was_evaluated: decision.was_evaluated,
      reu: decision.reu || '',
      regiao: decision.regiao || '',
      materia: decision.materia || '',
      resultado: decision.resultado || '',
      decisao_texto: decision.decisao_texto || '',
      notify_team: false,
      notify_message: '',
    });
    setProductSearch('');
    if (decision.client_id) fetchClientLawsuits(decision.client_id);
    setIsDialogOpen(true);
  };

  const handleClientSelect = (clientId: string) => {
    const client = advboxClients.find((c: AdvboxClient) => c.id.toString() === clientId);
    if (client) {
      setSelectedClient(client);
      setFormData(prev => ({ ...prev, client_id: client.id.toString(), client_name: client.name }));
      fetchClientLawsuits(client.id.toString());
    }
  };

  const handleLawsuitSelect = (lawsuitId: string) => {
    const lawsuit = clientLawsuits.find(l => l.id.toString() === lawsuitId);
    if (lawsuit) {
      setFormData(prev => ({
        ...prev,
        lawsuit_id: lawsuit.id.toString(),
        process_number: lawsuit.number,
        court: lawsuit.court || prev.court,
        court_division: lawsuit.court_division || prev.court_division,
      }));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.decision_type || !formData.product_name || !formData.client_name || !formData.decision_date) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }
    saveMutation.mutate(formData);
  };

  // Filter decisions
  const filteredDecisions = decisions.filter(d => {
    const matchesSearch = !searchTerm ||
      d.client_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.process_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.product_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.reu?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = filterType === 'all' || d.decision_type === filterType;
    const matchesMateria = filterMateria === 'all' || d.materia === filterMateria;
    const matchesResultado = filterResultado === 'all' || d.resultado === filterResultado;
    const matchesRegiao = filterRegiao === 'all' || d.regiao === filterRegiao;
    const matchesReu = !filterReu || d.reu?.toLowerCase().includes(filterReu.toLowerCase());
    const matchesDateStart = !filterDateStart || d.decision_date >= filterDateStart;
    const matchesDateEnd = !filterDateEnd || d.decision_date <= filterDateEnd;
    return matchesSearch && matchesType && matchesMateria && matchesResultado && matchesRegiao && matchesReu && matchesDateStart && matchesDateEnd;
  });

  const filteredClients = advboxClients;

  const getDecisionTypeLabel = (type: string) => DECISION_TYPES.find(t => t.value === type)?.label || type;

  const getDecisionTypeBadgeColor = (type: string) => {
    switch (type) {
      case 'sentenca': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'liminar': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'acordao': return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
    }
  };

  const getMateriaLabel = (m: string) => MATERIAS.find(x => x.value === m)?.label || m;
  const getResultadoLabel = (r: string) => RESULTADOS.find(x => x.value === r)?.label || r;

  const uniqueRegioes = [...new Set(decisions.map(d => d.regiao).filter(Boolean))] as string[];

  const fetchMissingLinksWithResponsibles = async () => {
    setIsLoadingMissingLinks(true);
    try {
      const decisionsWithoutLinks = decisions.filter(d => !d.decision_link || !d.decision_link.startsWith('http'));
      if (decisionsWithoutLinks.length === 0) {
        toast.info('Todas as decisões possuem links válidos');
        setMissingLinksData([]);
        setShowMissingLinksDialog(true);
        return;
      }
      const clientNames = decisionsWithoutLinks.map(d => d.client_name);
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) throw new Error('Not authenticated');
      const response = await supabase.functions.invoke('advbox-integration/find-responsibles', {
        method: 'POST',
        body: { client_names: clientNames },
        headers: { Authorization: `Bearer ${session.session.access_token}` },
      });
      if (response.error) throw response.error;
      const results = response.data?.data || [];
      const mergedData = decisionsWithoutLinks.map((decision, index) => {
        const result = results[index] || { found: false };
        return {
          client_name: decision.client_name,
          decision_date: decision.decision_date,
          product_name: decision.product_name,
          found: result.found,
          responsible_name: result.responsible_name,
          lawsuit_number: result.lawsuit_number,
        };
      });
      setMissingLinksData(mergedData);
      setShowMissingLinksDialog(true);
    } catch (error) {
      console.error('Error fetching missing links:', error);
      toast.error('Erro ao buscar responsáveis no Advbox');
    } finally {
      setIsLoadingMissingLinks(false);
    }
  };

  return (
    <Layout>
      <div className="container mx-auto py-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold">Decisões Favoráveis</h1>
            <p className="text-muted-foreground">Gerencie as decisões favoráveis e análises de jurimetria</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={fetchMissingLinksWithResponsibles} disabled={isLoadingMissingLinks}>
              {isLoadingMissingLinks ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Search className="h-4 w-4 mr-2" />}
              Links Faltantes
            </Button>
            <Button variant="outline" onClick={syncFromTeams} disabled={isSyncing}>
              <RefreshCw className={`h-4 w-4 mr-2 ${isSyncing ? 'animate-spin' : ''}`} />
              Sincronizar Teams
            </Button>
            <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) resetForm(); }}>
              <DialogTrigger asChild>
                <Button><Plus className="h-4 w-4 mr-2" />Nova Decisão</Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>{editingDecision ? 'Editar Decisão' : 'Cadastrar Nova Decisão'}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  {/* Decision Type */}
                  <div>
                    <Label>Tipo de Decisão *</Label>
                    <Select value={formData.decision_type} onValueChange={(v) => setFormData(prev => ({ ...prev, decision_type: v }))}>
                      <SelectTrigger><SelectValue placeholder="Selecione o tipo" /></SelectTrigger>
                      <SelectContent>
                        {DECISION_TYPES.map(type => (
                          <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Product/Subject */}
                  <div>
                    <Label>Assunto (Produto) *</Label>
                    <div className="space-y-2">
                      <Input placeholder="Pesquisar produto..." value={productSearch} onChange={(e) => setProductSearch(e.target.value)} className="mb-2" />
                      <Select value={formData.product_name} onValueChange={(v) => setFormData(prev => ({ ...prev, product_name: v }))}>
                        <SelectTrigger><SelectValue placeholder="Selecione o produto" /></SelectTrigger>
                        <SelectContent className="max-h-60">
                          {rdProducts.filter((p: RDProduct) => p.name.toLowerCase().includes(productSearch.toLowerCase())).map((p: RDProduct) => (
                            <SelectItem key={p._id} value={p.name}>{p.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Client Search */}
                  <div>
                    <Label>Cliente (Advbox) *</Label>
                    <div className="space-y-2">
                      <div className="flex gap-2">
                        <Input placeholder="Digite para buscar cliente..." value={clientSearch} onChange={(e) => setClientSearch(e.target.value)} className="flex-1" />
                        <Button type="button" variant="outline" onClick={handleSearchClients} disabled={isSearchingClients || loadingClients}>
                          {isSearchingClients || loadingClients ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                        </Button>
                      </div>
                      {loadingClients && advboxClients.length === 0 && <p className="text-sm text-muted-foreground">Carregando clientes do Advbox...</p>}
                      {advboxClients.length > 0 && !selectedClient && clientSearch.length >= 2 && (
                        <p className="text-xs text-muted-foreground">{advboxClients.length} clientes encontrados</p>
                      )}
                      {advboxClients.length === 0 && clientSearch.length >= 2 && !loadingClients && !isSearchingClients && (
                        <p className="text-sm text-muted-foreground">Nenhum cliente encontrado. Clique no botão de busca para sincronizar.</p>
                      )}
                      {isSearchingClients && (
                        <p className="text-sm text-muted-foreground flex items-center gap-1">
                          <Loader2 className="h-3 w-3 animate-spin" />Sincronizando clientes...
                        </p>
                      )}
                      {clientSearch.length >= 2 && filteredClients.length > 0 && !selectedClient && (
                        <div className="border rounded-md max-h-40 overflow-y-auto">
                          {filteredClients.map((client: AdvboxClient) => (
                            <div key={client.id} className="p-2 hover:bg-muted cursor-pointer" onClick={() => handleClientSelect(client.id.toString())}>
                              {client.name}
                            </div>
                          ))}
                        </div>
                      )}
                      {selectedClient && (
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary">{selectedClient.name}</Badge>
                          <Button type="button" variant="ghost" size="sm" onClick={() => {
                            setSelectedClient(null); setClientSearch('');
                            setFormData(prev => ({ ...prev, client_id: '', client_name: '' }));
                            setClientLawsuits([]);
                          }}><XCircle className="h-4 w-4" /></Button>
                        </div>
                      )}
                      {!selectedClient && formData.client_name && (
                        <Input placeholder="Nome do cliente (manual)" value={formData.client_name} onChange={(e) => setFormData(prev => ({ ...prev, client_name: e.target.value }))} />
                      )}
                    </div>
                  </div>

                  {/* Lawsuit */}
                  {selectedClient && (
                    <div>
                      <Label>Processo</Label>
                      {loadingLawsuits ? <p className="text-sm text-muted-foreground">Carregando processos...</p> :
                        clientLawsuits.length > 0 ? (
                          <Select value={formData.lawsuit_id} onValueChange={handleLawsuitSelect}>
                            <SelectTrigger><SelectValue placeholder="Selecione o processo" /></SelectTrigger>
                            <SelectContent>
                              {clientLawsuits.map(l => <SelectItem key={l.id} value={l.id.toString()}>{l.number}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        ) : <p className="text-sm text-muted-foreground">Nenhum processo encontrado</p>
                      }
                    </div>
                  )}

                  {/* Process Number */}
                  <div>
                    <Label>Número do Processo</Label>
                    <Input value={formData.process_number} onChange={(e) => setFormData(prev => ({ ...prev, process_number: e.target.value }))} placeholder="Número do processo" />
                  </div>

                  {/* Court and Division */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Tribunal</Label>
                      <Input value={formData.court} onChange={(e) => setFormData(prev => ({ ...prev, court: e.target.value }))} placeholder="Ex: TJMG, TRF1" />
                    </div>
                    <div>
                      <Label>Vara/Câmara</Label>
                      <Input value={formData.court_division} onChange={(e) => setFormData(prev => ({ ...prev, court_division: e.target.value }))} placeholder="Ex: 1ª Vara Cível" />
                    </div>
                  </div>

                  {/* Réu */}
                  <div>
                    <Label>Réu</Label>
                    <Input value={formData.reu} onChange={(e) => setFormData(prev => ({ ...prev, reu: e.target.value }))} placeholder="Nome do réu" />
                  </div>

                  {/* Região */}
                  <div>
                    <Label>Região</Label>
                    <Input value={formData.regiao} onChange={(e) => setFormData(prev => ({ ...prev, regiao: e.target.value }))} placeholder="Ex: MG, SP, Federal 1ª Região" />
                  </div>

                  {/* Matéria and Resultado */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Matéria</Label>
                      <Select value={formData.materia} onValueChange={(v) => setFormData(prev => ({ ...prev, materia: v }))}>
                        <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                        <SelectContent>
                          {MATERIAS.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Resultado</Label>
                      <Select value={formData.resultado} onValueChange={(v) => setFormData(prev => ({ ...prev, resultado: v }))}>
                        <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                        <SelectContent>
                          {RESULTADOS.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Decision Date */}
                  <div>
                    <Label>Data da Decisão *</Label>
                    <Input type="date" value={formData.decision_date} onChange={(e) => setFormData(prev => ({ ...prev, decision_date: e.target.value }))} />
                  </div>

                  {/* Decision Link */}
                  <div>
                    <Label>Link da Decisão (Teams)</Label>
                    <Input value={formData.decision_link} onChange={(e) => setFormData(prev => ({ ...prev, decision_link: e.target.value }))} placeholder="Cole o link do arquivo no Teams" />
                  </div>

                  {/* Texto da Decisão */}
                  <div>
                    <Label>Texto/Trecho da Decisão</Label>
                    <Textarea value={formData.decisao_texto} onChange={(e) => setFormData(prev => ({ ...prev, decisao_texto: e.target.value }))} placeholder="Cole aqui o trecho relevante da decisão..." rows={4} />
                  </div>

                  {/* AI Analysis Button */}
                  <Button type="button" variant="outline" className="w-full" onClick={handleAIAnalysis} disabled={isAnalyzing}>
                    {isAnalyzing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
                    {isAnalyzing ? 'Analisando com IA...' : 'Analisar com IA (preencher Réu, Matéria, Resultado, Região)'}
                  </Button>

                  {/* Observation */}
                  <div>
                    <Label>Observação</Label>
                    <Textarea value={formData.observation} onChange={(e) => setFormData(prev => ({ ...prev, observation: e.target.value }))} placeholder="Detalhes adicionais..." rows={3} />
                  </div>

                  {/* Social Checkboxes */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Checkbox id="was_posted" checked={formData.was_posted} onCheckedChange={(c) => setFormData(prev => ({ ...prev, was_posted: c === true }))} />
                      <Label htmlFor="was_posted" className="cursor-pointer">Foi postado nas redes sociais?</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox id="evaluation_requested" checked={formData.evaluation_requested} onCheckedChange={(c) => setFormData(prev => ({ ...prev, evaluation_requested: c === true }))} />
                      <Label htmlFor="evaluation_requested" className="cursor-pointer">Foi pedida avaliação ao cliente?</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox id="was_evaluated" checked={formData.was_evaluated} onCheckedChange={(c) => setFormData(prev => ({ ...prev, was_evaluated: c === true }))} />
                      <Label htmlFor="was_evaluated" className="cursor-pointer">Cliente avaliou no Google Meu Negócio?</Label>
                    </div>
                  </div>

                  {/* Team Notification */}
                  <div className="border rounded-lg p-4 space-y-3 bg-muted/30">
                    <div className="flex items-center gap-2">
                      <Checkbox id="notify_team" checked={formData.notify_team} onCheckedChange={(c) => setFormData(prev => ({ ...prev, notify_team: c === true }))} />
                      <Label htmlFor="notify_team" className="cursor-pointer flex items-center gap-2">
                        <Bell className="h-4 w-4" />
                        Notificar equipe sobre esta decisão
                      </Label>
                    </div>
                    {formData.notify_team && (
                      <div>
                        <Label className="text-sm">Trecho da decisão para notificação</Label>
                        <Textarea
                          value={formData.notify_message}
                          onChange={(e) => setFormData(prev => ({ ...prev, notify_message: e.target.value }))}
                          placeholder="Digite o trecho da decisão que deseja compartilhar com a equipe..."
                          rows={3}
                        />
                      </div>
                    )}
                  </div>

                  {/* Submit */}
                  <div className="flex justify-end gap-2 pt-4">
                    <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
                    <Button type="submit" disabled={saveMutation.isPending}>
                      {saveMutation.isPending ? 'Salvando...' : (editingDecision ? 'Atualizar' : 'Cadastrar')}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="decisoes">Decisões</TabsTrigger>
            <TabsTrigger value="jurimetria" className="flex items-center gap-1.5">
              <BarChart3 className="h-4 w-4" />
              Jurimetria
            </TabsTrigger>
          </TabsList>

          <TabsContent value="decisoes" className="space-y-6 mt-4">
            {/* Filters */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex flex-col md:flex-row gap-4">
                  <div className="flex-1">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input placeholder="Buscar por cliente, processo, produto ou réu..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10" />
                    </div>
                  </div>
                  <Button variant="outline" onClick={() => setShowFilters(!showFilters)}>
                    <Filter className="h-4 w-4 mr-2" />Filtros
                  </Button>
                </div>

                {showFilters && (
                  <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <Label className="text-sm">Tipo de Decisão</Label>
                      <Select value={filterType} onValueChange={setFilterType}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todos</SelectItem>
                          {DECISION_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-sm">Matéria</Label>
                      <Select value={filterMateria} onValueChange={setFilterMateria}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todas</SelectItem>
                          {MATERIAS.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-sm">Resultado</Label>
                      <Select value={filterResultado} onValueChange={setFilterResultado}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todos</SelectItem>
                          {RESULTADOS.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-sm">Região/Tribunal</Label>
                      <Select value={filterRegiao} onValueChange={setFilterRegiao}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todas</SelectItem>
                          {uniqueRegioes.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-sm">Réu</Label>
                      <Input placeholder="Filtrar por réu..." value={filterReu} onChange={(e) => setFilterReu(e.target.value)} />
                    </div>
                    <div>
                      <Label className="text-sm">Data Início</Label>
                      <Input type="date" value={filterDateStart} onChange={(e) => setFilterDateStart(e.target.value)} />
                    </div>
                    <div>
                      <Label className="text-sm">Data Fim</Label>
                      <Input type="date" value={filterDateEnd} onChange={(e) => setFilterDateEnd(e.target.value)} />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card><CardContent className="pt-6"><div className="text-2xl font-bold">{decisions.length}</div><p className="text-sm text-muted-foreground">Total de Decisões</p></CardContent></Card>
              <Card><CardContent className="pt-6"><div className="text-2xl font-bold text-green-600">{decisions.filter(d => d.was_posted).length}</div><p className="text-sm text-muted-foreground">Postadas</p></CardContent></Card>
              <Card><CardContent className="pt-6"><div className="text-2xl font-bold text-blue-600">{decisions.filter(d => d.evaluation_requested).length}</div><p className="text-sm text-muted-foreground">Avaliações Pedidas</p></CardContent></Card>
              <Card><CardContent className="pt-6"><div className="text-2xl font-bold text-purple-600">{decisions.filter(d => d.was_evaluated).length}</div><p className="text-sm text-muted-foreground">Avaliadas</p></CardContent></Card>
            </div>

            {/* Table */}
            <Card>
              <CardContent className="pt-6">
                {loadingDecisions ? (
                  <div className="text-center py-8">Carregando decisões...</div>
                ) : filteredDecisions.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    {searchTerm || filterType !== 'all' ? 'Nenhuma decisão encontrada com os filtros aplicados' : 'Nenhuma decisão cadastrada ainda'}
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[80px]">Tipo</TableHead>
                          <TableHead className="w-[100px]">Produto</TableHead>
                          <TableHead className="min-w-[180px]">Cliente</TableHead>
                          <TableHead className="w-[100px]">Réu</TableHead>
                          <TableHead className="w-[80px]">Matéria</TableHead>
                          <TableHead className="w-[80px]">Resultado</TableHead>
                          <TableHead className="w-[100px]">Tribunal</TableHead>
                          <TableHead className="w-[80px]">Decisão</TableHead>
                          <TableHead className="w-[90px] text-center">Status</TableHead>
                          <TableHead className="w-[90px] text-right">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredDecisions.map((decision) => (
                          <TableRow key={decision.id}>
                            <TableCell className="py-2 px-2">
                              <Badge className={`text-[10px] whitespace-nowrap ${getDecisionTypeBadgeColor(decision.decision_type)}`}>
                                {getDecisionTypeLabel(decision.decision_type)}
                              </Badge>
                            </TableCell>
                            <TableCell className="py-2 px-2">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="block max-w-[100px] truncate text-xs">{decision.product_name}</span>
                                </TooltipTrigger>
                                <TooltipContent>{decision.product_name}</TooltipContent>
                              </Tooltip>
                            </TableCell>
                            <TableCell className="py-2">
                              <span className="block text-sm" title={decision.client_name}>{decision.client_name}</span>
                            </TableCell>
                            <TableCell className="py-2 text-xs text-muted-foreground">
                              <span className="block max-w-[100px] truncate" title={decision.reu || ''}>{decision.reu || '-'}</span>
                            </TableCell>
                            <TableCell className="py-2">
                              {decision.materia ? (
                                <Badge variant="outline" className="text-[10px]">{getMateriaLabel(decision.materia)}</Badge>
                              ) : <span className="text-xs text-muted-foreground">-</span>}
                            </TableCell>
                            <TableCell className="py-2">
                              {decision.resultado ? (
                                <Badge variant={decision.resultado === 'procedente' || decision.resultado === 'parcialmente_procedente' ? 'default' : 'destructive'} className="text-[10px]">
                                  {getResultadoLabel(decision.resultado)}
                                </Badge>
                              ) : <span className="text-xs text-muted-foreground">-</span>}
                            </TableCell>
                            <TableCell className="py-2">
                              <div className="text-sm">
                                {decision.regiao || decision.court || '-'}
                                {decision.court_division && (
                                  <span className="text-muted-foreground block text-xs truncate max-w-[120px]" title={decision.court_division}>{decision.court_division}</span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-sm py-2">
                              {format(new Date(decision.decision_date), 'dd/MM/yyyy', { locale: ptBR })}
                            </TableCell>
                            <TableCell className="py-2">
                              <div className="flex justify-center gap-1">
                                <Tooltip>
                                  <TooltipTrigger>
                                    {decision.was_posted ? <CheckCircle className="h-4 w-4 text-green-600" /> : <XCircle className="h-4 w-4 text-muted-foreground" />}
                                  </TooltipTrigger>
                                  <TooltipContent>{decision.was_posted ? 'Postado' : 'Não postado'}</TooltipContent>
                                </Tooltip>
                                <Tooltip>
                                  <TooltipTrigger>
                                    {decision.was_evaluated || decision.evaluation_requested ? <CheckCircle className="h-4 w-4 text-blue-600" /> : <XCircle className="h-4 w-4 text-muted-foreground" />}
                                  </TooltipTrigger>
                                  <TooltipContent>{(decision.was_evaluated || decision.evaluation_requested) ? 'Avaliação pedida' : 'Avaliação não pedida'}</TooltipContent>
                                </Tooltip>
                                <Tooltip>
                                  <TooltipTrigger>
                                    {decision.was_evaluated ? <CheckCircle className="h-4 w-4 text-green-600" /> : <XCircle className="h-4 w-4 text-red-500" />}
                                  </TooltipTrigger>
                                  <TooltipContent>{decision.was_evaluated ? 'Cliente avaliou no Google' : 'Cliente não avaliou'}</TooltipContent>
                                </Tooltip>
                              </div>
                            </TableCell>
                            <TableCell className="text-right py-2">
                              <div className="flex justify-end gap-0.5">
                                {decision.decision_link && decision.decision_link.startsWith('http') && (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => window.open(decision.decision_link!, '_blank')}>
                                        <ExternalLink className="h-4 w-4" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Abrir arquivo no Teams</TooltipContent>
                                  </Tooltip>
                                )}
                                {isSocioOrRafael && (
                                  <>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditDialog(decision)}>
                                          <Edit className="h-4 w-4" />
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>Editar</TooltipContent>
                                    </Tooltip>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { if (confirm('Remover esta decisão?')) deleteMutation.mutate(decision.id); }}>
                                          <Trash2 className="h-4 w-4 text-destructive" />
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>Excluir</TooltipContent>
                                    </Tooltip>
                                  </>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="jurimetria" className="mt-4">
            <JurimetriaDashboard decisions={decisions} />
          </TabsContent>
        </Tabs>

        {/* Missing Links Dialog */}
        <Dialog open={showMissingLinksDialog} onOpenChange={setShowMissingLinksDialog}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Decisões sem Link Válido - Responsáveis</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Lista de decisões sem link válido, com o advogado responsável identificado no Advbox.
              </p>
              {missingLinksData.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">Todas as decisões possuem links válidos.</div>
              ) : (
                <>
                  <div className="flex gap-4 text-sm">
                    <Badge variant="outline">Total: {missingLinksData.length}</Badge>
                    <Badge variant="secondary" className="bg-green-100 text-green-800">Encontrados: {missingLinksData.filter(d => d.found).length}</Badge>
                    <Badge variant="secondary" className="bg-red-100 text-red-800">Não encontrados: {missingLinksData.filter(d => !d.found).length}</Badge>
                  </div>
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Cliente</TableHead>
                          <TableHead>Produto</TableHead>
                          <TableHead>Data Decisão</TableHead>
                          <TableHead>Responsável</TableHead>
                          <TableHead>Nº Processo</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {missingLinksData.map((item, index) => (
                          <TableRow key={index}>
                            <TableCell className="font-medium">{item.client_name}</TableCell>
                            <TableCell><Badge variant="outline" className="text-xs">{item.product_name}</Badge></TableCell>
                            <TableCell>{format(new Date(item.decision_date), 'dd/MM/yyyy', { locale: ptBR })}</TableCell>
                            <TableCell>
                              {item.found ? <span className="text-green-600 font-medium">{item.responsible_name || 'N/A'}</span> : <span className="text-red-500 text-sm">Não encontrado</span>}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">{item.lawsuit_number || '-'}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  <div className="flex justify-end">
                    <Button variant="outline" onClick={() => setShowMissingLinksDialog(false)}>Fechar</Button>
                  </div>
                </>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
