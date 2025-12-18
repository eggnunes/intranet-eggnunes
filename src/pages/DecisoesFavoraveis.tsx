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
import { toast } from 'sonner';
import { Plus, Search, Edit, Trash2, ExternalLink, RefreshCw, CheckCircle, XCircle, Filter, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

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

// Função para mapear nome de produto legado para produto RD Station
const mapProductName = (productName: string, rdProducts: RDProduct[]): string => {
  if (!productName) return '';
  
  const normalizedName = productName.toLowerCase().trim();
  
  // Primeiro tenta encontrar match exato nos produtos RD Station
  const exactMatch = rdProducts.find(p => 
    p.name.toLowerCase() === normalizedName
  );
  if (exactMatch) return exactMatch.name;
  
  // Depois tenta usar o mapeamento
  const mappedName = PRODUCT_NAME_MAPPING[normalizedName];
  if (mappedName) {
    const mappedProduct = rdProducts.find(p => 
      p.name.toLowerCase() === mappedName.toLowerCase()
    );
    if (mappedProduct) return mappedProduct.name;
  }
  
  // Tenta encontrar produto que contenha o termo
  const partialMatch = rdProducts.find(p => 
    p.name.toLowerCase().includes(normalizedName) ||
    normalizedName.includes(p.name.toLowerCase())
  );
  if (partialMatch) return partialMatch.name;
  
  // Retorna o nome original se nada foi encontrado
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
  const [showFilters, setShowFilters] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isSearchingClients, setIsSearchingClients] = useState(false);

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

  // Fetch Advbox clients - load in background on page load
  const { data: advboxClients = [], isLoading: loadingClients, refetch: refetchClients } = useQuery({
    queryKey: ['advbox-customers'],
    queryFn: async () => {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) throw new Error('Not authenticated');

      const response = await supabase.functions.invoke('advbox-integration/customers', {
        headers: {
          Authorization: `Bearer ${session.session.access_token}`,
        },
      });

      if (response.error) throw response.error;
      
      // Extract customers from cached data
      const customers = response.data?.data?.items || response.data?.data || [];
      return customers.map((c: any) => ({ id: c.id, name: c.name }));
    },
    staleTime: 10 * 60 * 1000, // Cache for 10 minutes
    enabled: true, // Always load in background
  });

  // Manual search function for Advbox clients
  const handleSearchClients = async () => {
    setIsSearchingClients(true);
    try {
      await refetchClients();
      toast.success('Clientes carregados do Advbox');
    } catch (error) {
      console.error('Error fetching clients:', error);
      toast.error('Erro ao buscar clientes no Advbox');
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

  // Fetch lawsuits for selected client
  const fetchClientLawsuits = async (clientId: string) => {
    if (!clientId) {
      setClientLawsuits([]);
      return;
    }

    setLoadingLawsuits(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) throw new Error('Not authenticated');

      const response = await supabase.functions.invoke('advbox-integration/lawsuits-full', {
        headers: {
          Authorization: `Bearer ${session.session.access_token}`,
        },
      });

      if (response.error) throw response.error;
      
      const allLawsuits = response.data?.data?.items || response.data?.data || [];
      const filteredLawsuits = allLawsuits.filter((l: any) => 
        l.customer_id?.toString() === clientId || 
        l.customers?.some((c: any) => c.id?.toString() === clientId)
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

  // Create/Update decision
  const saveMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      if (editingDecision) {
        const { error } = await supabase
          .from('favorable_decisions')
          .update({
            ...data,
            client_id: data.client_id || null,
            lawsuit_id: data.lawsuit_id || null,
          })
          .eq('id', editingDecision.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('favorable_decisions')
          .insert({
            ...data,
            client_id: data.client_id || null,
            lawsuit_id: data.lawsuit_id || null,
            created_by: user?.id,
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['favorable-decisions'] });
      toast.success(editingDecision ? 'Decisão atualizada!' : 'Decisão cadastrada!');
      resetForm();
      setIsDialogOpen(false);
      // Sync to Teams after saving
      syncToTeams();
    },
    onError: (error) => {
      console.error('Error saving decision:', error);
      toast.error('Erro ao salvar decisão');
    },
  });

  // Delete decision
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('favorable_decisions')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['favorable-decisions'] });
      toast.success('Decisão removida!');
      // Sync to Teams after deleting
      syncToTeams();
    },
    onError: (error) => {
      console.error('Error deleting decision:', error);
      toast.error('Erro ao remover decisão');
    },
  });

  // Sync from Teams (import data from Teams)
  const syncFromTeams = async () => {
    setIsSyncing(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) throw new Error('Not authenticated');

      const response = await supabase.functions.invoke('favorable-decisions-sync', {
        body: { action: 'sync-from-teams' },
        headers: {
          Authorization: `Bearer ${session.session.access_token}`,
        },
      });

      if (response.error) throw response.error;
      
      queryClient.invalidateQueries({ queryKey: ['favorable-decisions'] });
      toast.success('Dados importados do Teams!');
    } catch (error) {
      console.error('Error syncing from Teams:', error);
      toast.error('Erro ao importar do Teams');
    } finally {
      setIsSyncing(false);
    }
  };

  // Sync to Teams (export data to Teams - preserves header)
  const syncToTeams = async () => {
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) throw new Error('Not authenticated');

      const response = await supabase.functions.invoke('favorable-decisions-sync', {
        body: { action: 'sync-to-teams' },
        headers: {
          Authorization: `Bearer ${session.session.access_token}`,
        },
      });

      if (response.error) {
        console.error('Error syncing to Teams:', response.error);
        // Don't show error toast to avoid confusion - sync happens in background
      } else {
        console.log('Synced to Teams successfully');
      }
    } catch (error) {
      console.error('Error syncing to Teams:', error);
    }
  };

  const resetForm = () => {
    setFormData({
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
    });
    setSelectedClient(null);
    setClientSearch('');
    setClientLawsuits([]);
    setEditingDecision(null);
  };

  const openEditDialog = (decision: FavorableDecision) => {
    setEditingDecision(decision);
    // Mapeia o produto para o nome correto do RD Station
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
    });
    setProductSearch('');
    if (decision.client_id) {
      fetchClientLawsuits(decision.client_id);
    }
    setIsDialogOpen(true);
  };

  const handleClientSelect = (clientId: string) => {
    const client = advboxClients.find((c: AdvboxClient) => c.id.toString() === clientId);
    if (client) {
      setSelectedClient(client);
      setFormData(prev => ({
        ...prev,
        client_id: client.id.toString(),
        client_name: client.name,
      }));
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
    const matchesSearch = 
      d.client_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.process_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.product_name.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesType = filterType === 'all' || d.decision_type === filterType;
    
    return matchesSearch && matchesType;
  });

  // Filter clients for autocomplete - show results even if search is empty
  const filteredClients = clientSearch.length >= 2 
    ? advboxClients.filter((c: AdvboxClient) =>
        c.name.toLowerCase().includes(clientSearch.toLowerCase())
      ).slice(0, 15)
    : [];

  const getDecisionTypeLabel = (type: string) => {
    return DECISION_TYPES.find(t => t.value === type)?.label || type;
  };

  const getDecisionTypeBadgeColor = (type: string) => {
    switch (type) {
      case 'sentenca': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'liminar': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'acordao': return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
    }
  };

  return (
    <Layout>
      <div className="container mx-auto py-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold">Decisões Favoráveis</h1>
            <p className="text-muted-foreground">
              Gerencie as decisões favoráveis do escritório
            </p>
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              onClick={syncFromTeams}
              disabled={isSyncing}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isSyncing ? 'animate-spin' : ''}`} />
              Sincronizar Teams
            </Button>
            <Dialog open={isDialogOpen} onOpenChange={(open) => {
              setIsDialogOpen(open);
              if (!open) resetForm();
            }}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Nova Decisão
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>
                    {editingDecision ? 'Editar Decisão' : 'Cadastrar Nova Decisão'}
                  </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  {/* Decision Type */}
                  <div>
                    <Label>Tipo de Decisão *</Label>
                    <Select 
                      value={formData.decision_type} 
                      onValueChange={(v) => setFormData(prev => ({ ...prev, decision_type: v }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o tipo" />
                      </SelectTrigger>
                      <SelectContent>
                        {DECISION_TYPES.map(type => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Product/Subject with Search */}
                  <div>
                    <Label>Assunto (Produto) *</Label>
                    <div className="space-y-2">
                      <Input
                        placeholder="Pesquisar produto..."
                        value={productSearch}
                        onChange={(e) => setProductSearch(e.target.value)}
                        className="mb-2"
                      />
                      <Select 
                        value={formData.product_name} 
                        onValueChange={(v) => setFormData(prev => ({ ...prev, product_name: v }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o produto" />
                        </SelectTrigger>
                        <SelectContent className="max-h-60">
                          {rdProducts
                            .filter((product: RDProduct) => 
                              product.name.toLowerCase().includes(productSearch.toLowerCase())
                            )
                            .map((product: RDProduct) => (
                              <SelectItem key={product._id} value={product.name}>
                                {product.name}
                              </SelectItem>
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
                        <Input
                          placeholder="Digite para buscar cliente..."
                          value={clientSearch}
                          onChange={(e) => setClientSearch(e.target.value)}
                          className="flex-1"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          onClick={handleSearchClients}
                          disabled={isSearchingClients || loadingClients}
                        >
                          {isSearchingClients || loadingClients ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Search className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                      {loadingClients && advboxClients.length === 0 && (
                        <p className="text-sm text-muted-foreground">Carregando clientes do Advbox...</p>
                      )}
                      {clientSearch.length >= 2 && filteredClients.length > 0 && !selectedClient && (
                        <div className="border rounded-md max-h-40 overflow-y-auto">
                          {filteredClients.map((client: AdvboxClient) => (
                            <div
                              key={client.id}
                              className="p-2 hover:bg-muted cursor-pointer"
                              onClick={() => handleClientSelect(client.id.toString())}
                            >
                              {client.name}
                            </div>
                          ))}
                        </div>
                      )}
                      {clientSearch.length >= 2 && filteredClients.length === 0 && advboxClients.length > 0 && !selectedClient && (
                        <p className="text-sm text-muted-foreground">Nenhum cliente encontrado com "{clientSearch}"</p>
                      )}
                      {clientSearch.length > 0 && clientSearch.length < 2 && !selectedClient && (
                        <p className="text-sm text-muted-foreground">Digite ao menos 2 caracteres para buscar</p>
                      )}
                      {selectedClient && (
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary">{selectedClient.name}</Badge>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedClient(null);
                              setClientSearch('');
                              setFormData(prev => ({ ...prev, client_id: '', client_name: '' }));
                              setClientLawsuits([]);
                            }}
                          >
                            <XCircle className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                      {!selectedClient && formData.client_name && (
                        <Input
                          placeholder="Nome do cliente (manual)"
                          value={formData.client_name}
                          onChange={(e) => setFormData(prev => ({ ...prev, client_name: e.target.value }))}
                        />
                      )}
                    </div>
                  </div>

                  {/* Lawsuit Selection */}
                  {selectedClient && (
                    <div>
                      <Label>Processo</Label>
                      {loadingLawsuits ? (
                        <p className="text-sm text-muted-foreground">Carregando processos...</p>
                      ) : clientLawsuits.length > 0 ? (
                        <Select 
                          value={formData.lawsuit_id} 
                          onValueChange={handleLawsuitSelect}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione o processo" />
                          </SelectTrigger>
                          <SelectContent>
                            {clientLawsuits.map(lawsuit => (
                              <SelectItem key={lawsuit.id} value={lawsuit.id.toString()}>
                                {lawsuit.number}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <p className="text-sm text-muted-foreground">Nenhum processo encontrado</p>
                      )}
                    </div>
                  )}

                  {/* Process Number (editable) */}
                  <div>
                    <Label>Número do Processo</Label>
                    <Input
                      value={formData.process_number}
                      onChange={(e) => setFormData(prev => ({ ...prev, process_number: e.target.value }))}
                      placeholder="Número do processo"
                    />
                  </div>

                  {/* Court and Division */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Tribunal</Label>
                      <Input
                        value={formData.court}
                        onChange={(e) => setFormData(prev => ({ ...prev, court: e.target.value }))}
                        placeholder="Ex: TJMG, TRF1"
                      />
                    </div>
                    <div>
                      <Label>Vara/Câmara</Label>
                      <Input
                        value={formData.court_division}
                        onChange={(e) => setFormData(prev => ({ ...prev, court_division: e.target.value }))}
                        placeholder="Ex: 1ª Vara Cível"
                      />
                    </div>
                  </div>

                  {/* Decision Date */}
                  <div>
                    <Label>Data da Decisão *</Label>
                    <Input
                      type="date"
                      value={formData.decision_date}
                      onChange={(e) => setFormData(prev => ({ ...prev, decision_date: e.target.value }))}
                    />
                  </div>

                  {/* Decision Link */}
                  <div>
                    <Label>Link da Decisão (Teams)</Label>
                    <Input
                      value={formData.decision_link}
                      onChange={(e) => setFormData(prev => ({ ...prev, decision_link: e.target.value }))}
                      placeholder="Cole o link do arquivo no Teams"
                    />
                  </div>

                  {/* Observation */}
                  <div>
                    <Label>Observação</Label>
                    <Textarea
                      value={formData.observation}
                      onChange={(e) => setFormData(prev => ({ ...prev, observation: e.target.value }))}
                      placeholder="Detalhes adicionais sobre a decisão..."
                      rows={3}
                    />
                  </div>

                  {/* Checkboxes */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="was_posted"
                        checked={formData.was_posted}
                        onCheckedChange={(checked) => 
                          setFormData(prev => ({ ...prev, was_posted: checked === true }))
                        }
                      />
                      <Label htmlFor="was_posted" className="cursor-pointer">
                        Foi postado nas redes sociais?
                      </Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="evaluation_requested"
                        checked={formData.evaluation_requested}
                        onCheckedChange={(checked) => 
                          setFormData(prev => ({ ...prev, evaluation_requested: checked === true }))
                        }
                      />
                      <Label htmlFor="evaluation_requested" className="cursor-pointer">
                        Foi pedida avaliação ao cliente?
                      </Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="was_evaluated"
                        checked={formData.was_evaluated}
                        onCheckedChange={(checked) => 
                          setFormData(prev => ({ ...prev, was_evaluated: checked === true }))
                        }
                      />
                      <Label htmlFor="was_evaluated" className="cursor-pointer">
                        Cliente avaliou no Google Meu Negócio?
                      </Label>
                    </div>
                  </div>

                  {/* Submit */}
                  <div className="flex justify-end gap-2 pt-4">
                    <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                      Cancelar
                    </Button>
                    <Button type="submit" disabled={saveMutation.isPending}>
                      {saveMutation.isPending ? 'Salvando...' : (editingDecision ? 'Atualizar' : 'Cadastrar')}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por cliente, processo ou produto..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <Button
                variant="outline"
                onClick={() => setShowFilters(!showFilters)}
              >
                <Filter className="h-4 w-4 mr-2" />
                Filtros
              </Button>
            </div>

            {showFilters && (
              <div className="mt-4 flex flex-wrap gap-4">
                <div>
                  <Label className="text-sm">Tipo de Decisão</Label>
                  <Select value={filterType} onValueChange={setFilterType}>
                    <SelectTrigger className="w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      {DECISION_TYPES.map(type => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">{decisions.length}</div>
              <p className="text-sm text-muted-foreground">Total de Decisões</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-green-600">
                {decisions.filter(d => d.was_posted).length}
              </div>
              <p className="text-sm text-muted-foreground">Postadas</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-blue-600">
                {decisions.filter(d => d.evaluation_requested).length}
              </div>
              <p className="text-sm text-muted-foreground">Avaliações Pedidas</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-purple-600">
                {decisions.filter(d => d.was_evaluated).length}
              </div>
              <p className="text-sm text-muted-foreground">Avaliadas</p>
            </CardContent>
          </Card>
        </div>

        {/* Table */}
        <Card>
          <CardContent className="pt-6">
            {loadingDecisions ? (
              <div className="text-center py-8">Carregando decisões...</div>
            ) : filteredDecisions.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {searchTerm || filterType !== 'all' 
                  ? 'Nenhuma decisão encontrada com os filtros aplicados'
                  : 'Nenhuma decisão cadastrada ainda'
                }
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[80px]">Tipo</TableHead>
                      <TableHead className="w-[100px]">Produto</TableHead>
                      <TableHead className="min-w-[200px]">Cliente</TableHead>
                      <TableHead className="w-[130px]">Processo</TableHead>
                      <TableHead className="w-[100px]">Tribunal</TableHead>
                      <TableHead className="w-[80px]">Decisão</TableHead>
                      <TableHead className="w-[80px]">Cadastro</TableHead>
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
                              <span className="block max-w-[100px] truncate text-xs">
                                {decision.product_name}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>
                              {decision.product_name}
                            </TooltipContent>
                          </Tooltip>
                        </TableCell>
                        <TableCell className="py-2">
                          <span className="block text-sm" title={decision.client_name}>
                            {decision.client_name}
                          </span>
                        </TableCell>
                        <TableCell className="font-mono text-xs py-2">
                          {decision.process_number || '-'}
                        </TableCell>
                        <TableCell className="py-2">
                          <div className="text-sm">
                            {decision.court || '-'}
                            {decision.court_division && (
                              <span className="text-muted-foreground block text-xs truncate max-w-[120px]" title={decision.court_division}>
                                {decision.court_division}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm py-2">
                          {format(new Date(decision.decision_date), 'dd/MM/yyyy', { locale: ptBR })}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground py-2">
                          {format(new Date(decision.created_at), 'dd/MM/yyyy', { locale: ptBR })}
                        </TableCell>
                        <TableCell className="py-2">
                          <div className="flex justify-center gap-1">
                            <Tooltip>
                              <TooltipTrigger>
                                {decision.was_posted ? (
                                  <CheckCircle className="h-4 w-4 text-green-600" />
                                ) : (
                                  <XCircle className="h-4 w-4 text-muted-foreground" />
                                )}
                              </TooltipTrigger>
                              <TooltipContent>
                                {decision.was_posted ? 'Postado nas redes sociais' : 'Não postado'}
                              </TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger>
                                {/* Avaliação Pedida: se was_evaluated é true ou false (mas existe valor), implica que foi pedido */}
                                {decision.was_evaluated || decision.evaluation_requested ? (
                                  <CheckCircle className="h-4 w-4 text-blue-600" />
                                ) : (
                                  <XCircle className="h-4 w-4 text-muted-foreground" />
                                )}
                              </TooltipTrigger>
                              <TooltipContent>
                                {(decision.was_evaluated || decision.evaluation_requested) ? 'Avaliação pedida' : 'Avaliação não pedida'}
                              </TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger>
                                {decision.was_evaluated ? (
                                  <CheckCircle className="h-4 w-4 text-green-600" />
                                ) : (
                                  <XCircle className="h-4 w-4 text-red-500" />
                                )}
                              </TooltipTrigger>
                              <TooltipContent>
                                {decision.was_evaluated ? 'Cliente avaliou no Google' : 'Cliente não avaliou'}
                              </TooltipContent>
                            </Tooltip>
                          </div>
                        </TableCell>
                        <TableCell className="text-right py-2">
                          <div className="flex justify-end gap-0.5">
                            {decision.decision_link && decision.decision_link.startsWith('http') && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={() => window.open(decision.decision_link!, '_blank')}
                                  >
                                    <ExternalLink className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Abrir arquivo da decisão no Teams</TooltipContent>
                              </Tooltip>
                            )}
                            {isSocioOrRafael && (
                              <>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8"
                                      onClick={() => openEditDialog(decision)}
                                    >
                                      <Edit className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Editar decisão</TooltipContent>
                                </Tooltip>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8"
                                      onClick={() => {
                                        if (confirm('Remover esta decisão?')) {
                                          deleteMutation.mutate(decision.id);
                                        }
                                      }}
                                    >
                                      <Trash2 className="h-4 w-4 text-destructive" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Excluir decisão</TooltipContent>
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
      </div>
    </Layout>
  );
}
