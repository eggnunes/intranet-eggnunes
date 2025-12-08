import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAdminPermissions } from "@/hooks/useAdminPermissions";
import { cn } from "@/lib/utils";
import { ContractGenerator } from "@/components/ContractGenerator";
import { 
  RefreshCw, 
  Search, 
  FileText, 
  Users, 
  Clock,
  Eye,
  FileSignature,
  Scale,
  FileCheck,
  Phone,
  Mail,
  MapPin,
  Calendar as CalendarIcon,
  CreditCard,
  X,
  Package,
  Loader2,
  Check,
  RotateCcw,
  Save
} from "lucide-react";
import { format, parse, isAfter, isBefore, isEqual, startOfDay, endOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Client {
  id: number;
  timestamp: string;
  nomeCompleto: string;
  cpf: string;
  documentoIdentidade: string;
  comoConheceu: string;
  dataNascimento: string;
  estadoCivil: string;
  profissao: string;
  telefone: string;
  temWhatsapp: string;
  email: string;
  cep: string;
  cidade: string;
  rua: string;
  numero: string;
  complemento: string;
  bairro: string;
  estado: string;
  nomePai: string;
  nomeMae: string;
  opcaoPagamento: string;
  quantidadeParcelas: string;
  dataVencimento: string;
  aposentado: string;
  previsaoAposentadoria: string;
  possuiEmprestimo: string;
  doencaGrave: string;
  planoSaude: string;
  qualPlanoSaude: string;
  negativaPlano: string;
  doencaNegativa: string;
  conheceAlguemSituacao: string;
  conheceAlguemMesmaSituacao: string;
  telefoneAlternativo: string;
}

interface RDStationProduct {
  _id: string;
  name: string;
  description?: string;
  base_price?: number;
  recurrence?: string;
}

// Função para formatar CPF no padrão XXX.XXX.XXX-XX
const formatCPF = (cpf: string): string => {
  if (!cpf) return '[CPF]';
  // Remove tudo que não é número
  const cleanCPF = cpf.replace(/\D/g, '');
  if (cleanCPF.length !== 11) return cpf; // Retorna original se não tiver 11 dígitos
  return cleanCPF.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
};

// Função para gerar a qualificação do cliente no formato jurídico
const generateClientQualification = (client: Client): string => {
  const parts = [
    client.nomeCompleto || '[NOME]',
    'brasileiro(a)',
    client.estadoCivil?.toLowerCase() || '[ESTADO CIVIL]',
    client.profissao?.toLowerCase() || '[PROFISSÃO]',
    `portador(a) do documento de identidade nº ${client.documentoIdentidade || '[RG]'}`,
    `e do CPF nº ${formatCPF(client.cpf)}`,
    `nascido(a) em ${client.dataNascimento || '[DATA NASCIMENTO]'}`,
    `residente na ${client.rua || '[RUA]'}`,
    `nº ${client.numero || '[NÚMERO]'}`,
    client.complemento ? client.complemento : null,
    `bairro ${client.bairro || '[BAIRRO]'}`,
    client.cidade || '[CIDADE]',
    client.estado || '[ESTADO]',
    `CEP ${client.cep || '[CEP]'}`,
    `e-mail: ${client.email || '[E-MAIL]'}`,
    `telefone: ${client.telefone || '[TELEFONE]'}`
  ];

  // Remove valores nulos e junta com vírgula, terminando com ponto e vírgula
  return parts.filter(Boolean).join(', ') + ';';
};

const SetorComercial = () => {
  const navigate = useNavigate();
  const { hasPermission, loading: permissionsLoading } = useAdminPermissions();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  
  // RD Station products
  const [products, setProducts] = useState<RDStationProduct[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [productDialogOpen, setProductDialogOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<string>("");
  const [clientForDocument, setClientForDocument] = useState<Client | null>(null);
  
  // Qualificação editável
  const [editedQualification, setEditedQualification] = useState<string>("");
  const [qualificationSaved, setQualificationSaved] = useState(false);
  
  // Contract generator
  const [contractGeneratorOpen, setContractGeneratorOpen] = useState(false);

  const fetchProducts = async () => {
    try {
      setProductsLoading(true);
      const { data, error } = await supabase.functions.invoke('rd-station-products');
      
      if (error) throw error;
      
      if (data.products) {
        setProducts(data.products);
      }
    } catch (error: unknown) {
      console.error('Error fetching products:', error);
      const errorMessage = error instanceof Error ? error.message : 'Erro ao carregar produtos';
      toast.error(errorMessage);
    } finally {
      setProductsLoading(false);
    }
  };

  const fetchClients = async (showToast = false) => {
    try {
      if (showToast) setRefreshing(true);
      
      const { data, error } = await supabase.functions.invoke('google-sheets-integration');
      
      if (error) throw error;
      
      if (data.clients) {
        setClients(data.clients);
        if (showToast) {
          toast.success(`${data.clients.length} clientes carregados`);
        }
      }
    } catch (error: unknown) {
      console.error('Error fetching clients:', error);
      const errorMessage = error instanceof Error ? error.message : 'Erro ao carregar dados';
      toast.error(errorMessage);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchClients();
    fetchProducts();
  }, []);

  // Parse timestamp from Google Sheets format (DD/MM/YYYY HH:MM:SS)
  const parseTimestamp = (timestamp: string): Date | null => {
    if (!timestamp) return null;
    try {
      // Try parsing DD/MM/YYYY HH:MM:SS format
      const parsed = parse(timestamp, 'dd/MM/yyyy HH:mm:ss', new Date());
      if (!isNaN(parsed.getTime())) return parsed;
      
      // Try parsing DD/MM/YYYY format
      const parsedDate = parse(timestamp, 'dd/MM/yyyy', new Date());
      if (!isNaN(parsedDate.getTime())) return parsedDate;
      
      return null;
    } catch {
      return null;
    }
  };

  // Reverse order to show most recent first
  const reversedClients = [...clients].reverse();
  
  // Apply date filter
  const dateFilteredClients = reversedClients.filter(client => {
    if (!startDate && !endDate) return true;
    
    const clientDate = parseTimestamp(client.timestamp);
    if (!clientDate) return true;
    
    const clientDay = startOfDay(clientDate);
    
    if (startDate && endDate) {
      return (isAfter(clientDay, startOfDay(startDate)) || isEqual(clientDay, startOfDay(startDate))) &&
             (isBefore(clientDay, endOfDay(endDate)) || isEqual(clientDay, startOfDay(endDate)));
    }
    
    if (startDate) {
      return isAfter(clientDay, startOfDay(startDate)) || isEqual(clientDay, startOfDay(startDate));
    }
    
    if (endDate) {
      return isBefore(clientDay, endOfDay(endDate)) || isEqual(clientDay, startOfDay(endDate));
    }
    
    return true;
  });
  
  const filteredClients = dateFilteredClients.filter(client => 
    client.nomeCompleto?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.cpf?.includes(searchTerm) ||
    client.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.telefone?.includes(searchTerm)
  );
  
  // Limit to 30 unless showAll is true
  const displayedClients = showAll ? filteredClients : filteredClients.slice(0, 30);
  const hasMoreClients = filteredClients.length > 30;
  
  const clearDateFilters = () => {
    setStartDate(undefined);
    setEndDate(undefined);
  };

  const handleViewDetails = (client: Client) => {
    setSelectedClient(client);
    setEditedQualification(generateClientQualification(client));
    setQualificationSaved(false);
    setDetailsOpen(true);
  };

  const openProductDialog = (client: Client) => {
    setClientForDocument(client);
    setSelectedProduct("");
    setProductDialogOpen(true);
  };

  const handleGenerateDocument = () => {
    if (!selectedProduct) {
      toast.error('Selecione um produto');
      return;
    }

    if (!clientForDocument) {
      toast.error('Cliente não selecionado');
      return;
    }

    setProductDialogOpen(false);
    setContractGeneratorOpen(true);
  };

  const handleGenerateContract = (client: Client) => {
    openProductDialog(client);
  };

  const handleGenerateProcuracao = (client: Client) => {
    const qualification = generateClientQualification(client);
    console.log('Qualificação do cliente para procuração:', qualification);
    toast.info(`Gerando procuração para ${client.nomeCompleto}`);
    // TODO: Implement procuracao generation
    // A qualificação está disponível na variável 'qualification' para ser inserida no modelo
  };

  const handleGenerateDeclaracao = (client: Client) => {
    toast.info('Funcionalidade de geração de declaração em desenvolvimento');
    // TODO: Implement declaracao generation
  };

  if (permissionsLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </Layout>
    );
  }

  const canAccess = hasPermission('advbox', 'view');

  if (!canAccess) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center h-64 space-y-4">
          <Scale className="h-16 w-16 text-muted-foreground" />
          <h2 className="text-xl font-semibold">Acesso Restrito</h2>
          <p className="text-muted-foreground">Você não tem permissão para acessar esta seção.</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Setor Comercial</h1>
            <p className="text-muted-foreground">
              Geração de contratos e documentos a partir dos formulários de clientes
            </p>
          </div>
          <Button 
            onClick={() => fetchClients(true)} 
            disabled={refreshing}
            variant="outline"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total de Clientes que Preencheram o Formulário</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{clients.length}</div>
              <p className="text-xs text-muted-foreground">
                registros no formulário
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Último Registro</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {reversedClients.length > 0 
                  ? reversedClients[0]?.nomeCompleto?.split(' ')[0] || '-'
                  : '-'
                }
              </div>
              <p className="text-xs text-muted-foreground">
                {reversedClients.length > 0 ? reversedClients[0]?.timestamp : 'Nenhum registro'}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Documentos</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">3</div>
              <p className="text-xs text-muted-foreground">
                tipos disponíveis para geração
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Search and Table */}
        <Card>
          <CardHeader>
            <CardTitle>Clientes do Formulário</CardTitle>
            <CardDescription>
              Dados recebidos via Google Forms para geração de documentos
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
              <div className="relative flex-1 w-full sm:w-auto">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome, CPF, email ou telefone..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              
              {/* Date filters */}
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "justify-start text-left font-normal w-full sm:w-[140px]",
                        !startDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {startDate ? format(startDate, "dd/MM/yyyy") : "Data início"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={startDate}
                      onSelect={setStartDate}
                      initialFocus
                      locale={ptBR}
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>
                
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "justify-start text-left font-normal w-full sm:w-[140px]",
                        !endDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {endDate ? format(endDate, "dd/MM/yyyy") : "Data fim"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={endDate}
                      onSelect={setEndDate}
                      initialFocus
                      locale={ptBR}
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>
                
                {(startDate || endDate) && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={clearDateFilters}
                    title="Limpar filtros de data"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
            
            {/* Active filters badge */}
            {(startDate || endDate) && (
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-xs">
                  {startDate && endDate 
                    ? `${format(startDate, "dd/MM/yyyy")} - ${format(endDate, "dd/MM/yyyy")}`
                    : startDate 
                      ? `A partir de ${format(startDate, "dd/MM/yyyy")}`
                      : `Até ${format(endDate!, "dd/MM/yyyy")}`
                  }
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {filteredClients.length} resultado(s)
                </span>
              </div>
            )}

            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : filteredClients.length === 0 ? (
              <div className="text-center py-12">
                <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium">Nenhum cliente encontrado</h3>
                <p className="text-muted-foreground">
                  {searchTerm ? 'Tente uma busca diferente' : 'Aguardando respostas do formulário'}
                </p>
              </div>
            ) : (
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>CPF</TableHead>
                      <TableHead className="hidden md:table-cell">Telefone</TableHead>
                      <TableHead className="hidden lg:table-cell">Email</TableHead>
                      <TableHead className="hidden xl:table-cell">Pagamento</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {displayedClients.map((client) => (
                      <TableRow key={client.id}>
                        <TableCell className="font-medium">
                          <div>
                            <p className="font-medium">{client.nomeCompleto}</p>
                            <p className="text-xs text-muted-foreground md:hidden">
                              {client.telefone}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>{client.cpf}</TableCell>
                        <TableCell className="hidden md:table-cell">{client.telefone}</TableCell>
                        <TableCell className="hidden lg:table-cell">{client.email}</TableCell>
                        <TableCell className="hidden xl:table-cell">
                          <Badge variant="outline">
                            {client.opcaoPagamento || 'Não informado'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleViewDetails(client)}
                              title="Ver detalhes"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleGenerateContract(client)}
                              title="Gerar contrato"
                            >
                              <FileSignature className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleGenerateProcuracao(client)}
                              title="Gerar procuração"
                            >
                              <Scale className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleGenerateDeclaracao(client)}
                              title="Gerar declaração"
                            >
                              <FileCheck className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
            
            {/* Show more button */}
            {!loading && hasMoreClients && !searchTerm && (
              <div className="flex justify-center pt-4">
                <Button
                  variant="outline"
                  onClick={() => setShowAll(!showAll)}
                >
                  {showAll 
                    ? 'Mostrar apenas os 30 últimos' 
                    : `Ver todos os ${filteredClients.length} clientes`
                  }
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Client Details Dialog */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Detalhes do Cliente</DialogTitle>
            <DialogDescription>
              Informações completas do formulário
            </DialogDescription>
          </DialogHeader>
          {selectedClient && (
            <ScrollArea className="max-h-[70vh] pr-4">
              <div className="space-y-6">
                {/* Personal Info */}
                <div>
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Dados Pessoais
                  </h3>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-muted-foreground">Nome Completo</p>
                      <p className="font-medium">{selectedClient.nomeCompleto}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">CPF</p>
                      <p className="font-medium">{selectedClient.cpf}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">RG</p>
                      <p className="font-medium">{selectedClient.documentoIdentidade}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Data de Nascimento</p>
                      <p className="font-medium">{selectedClient.dataNascimento}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Estado Civil</p>
                      <p className="font-medium">{selectedClient.estadoCivil}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Profissão</p>
                      <p className="font-medium">{selectedClient.profissao}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Nome do Pai</p>
                      <p className="font-medium">{selectedClient.nomePai || '-'}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Nome da Mãe</p>
                      <p className="font-medium">{selectedClient.nomeMae || '-'}</p>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Contact Info */}
                <div>
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <Phone className="h-4 w-4" />
                    Contato
                  </h3>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-muted-foreground">Telefone</p>
                      <p className="font-medium">{selectedClient.telefone}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">WhatsApp</p>
                      <p className="font-medium">{selectedClient.temWhatsapp}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Email</p>
                      <p className="font-medium">{selectedClient.email}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Telefone Alternativo</p>
                      <p className="font-medium">{selectedClient.telefoneAlternativo || '-'}</p>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Address */}
                <div>
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    Endereço
                  </h3>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-muted-foreground">CEP</p>
                      <p className="font-medium">{selectedClient.cep}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Estado</p>
                      <p className="font-medium">{selectedClient.estado}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Cidade</p>
                      <p className="font-medium">{selectedClient.cidade}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Bairro</p>
                      <p className="font-medium">{selectedClient.bairro}</p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-muted-foreground">Endereço</p>
                      <p className="font-medium">
                        {selectedClient.rua}, {selectedClient.numero}
                        {selectedClient.complemento && ` - ${selectedClient.complemento}`}
                      </p>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Payment Info */}
                <div>
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <CreditCard className="h-4 w-4" />
                    Pagamento
                  </h3>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-muted-foreground">Opção de Pagamento</p>
                      <p className="font-medium">{selectedClient.opcaoPagamento || '-'}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Parcelas</p>
                      <p className="font-medium">{selectedClient.quantidadeParcelas || '-'}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Vencimento</p>
                      <p className="font-medium">{selectedClient.dataVencimento || '-'}</p>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Additional Info */}
                <div>
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Informações Adicionais
                  </h3>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-muted-foreground">Aposentado</p>
                      <p className="font-medium">{selectedClient.aposentado}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Previsão Aposentadoria</p>
                      <p className="font-medium">{selectedClient.previsaoAposentadoria || '-'}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Empréstimo Consignado</p>
                      <p className="font-medium">{selectedClient.possuiEmprestimo}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Doença Grave</p>
                      <p className="font-medium">{selectedClient.doencaGrave}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Plano de Saúde</p>
                      <p className="font-medium">{selectedClient.planoSaude}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Qual Plano</p>
                      <p className="font-medium">{selectedClient.qualPlanoSaude || '-'}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Como Conheceu</p>
                      <p className="font-medium">{selectedClient.comoConheceu}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Data do Registro</p>
                      <p className="font-medium">{selectedClient.timestamp}</p>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Qualification Preview - Editable */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold flex items-center gap-2">
                      <FileSignature className="h-4 w-4" />
                      Qualificação do Cliente
                    </h3>
                    {qualificationSaved && (
                      <Badge variant="secondary" className="text-xs">
                        <Check className="h-3 w-3 mr-1" />
                        Salvo
                      </Badge>
                    )}
                  </div>
                  <Textarea
                    value={editedQualification}
                    onChange={(e) => {
                      setEditedQualification(e.target.value);
                      setQualificationSaved(false);
                    }}
                    className="min-h-[120px] text-sm leading-relaxed"
                    placeholder="Qualificação do cliente..."
                  />
                  <div className="flex items-center justify-between mt-2">
                    <p className="text-xs text-muted-foreground">
                      Edite conforme necessário. A versão salva será usada nos documentos.
                    </p>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setEditedQualification(generateClientQualification(selectedClient));
                          setQualificationSaved(false);
                        }}
                      >
                        <RotateCcw className="h-3 w-3 mr-1" />
                        Restaurar
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => {
                          setQualificationSaved(true);
                          toast.success("Qualificação salva com sucesso!");
                        }}
                        disabled={qualificationSaved}
                      >
                        <Save className="h-3 w-3 mr-1" />
                        Salvar
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-wrap gap-2 pt-4">
                  <Button onClick={() => handleGenerateContract(selectedClient)}>
                    <FileSignature className="h-4 w-4 mr-2" />
                    Gerar Contrato
                  </Button>
                  <Button variant="outline" onClick={() => handleGenerateProcuracao(selectedClient)}>
                    <Scale className="h-4 w-4 mr-2" />
                    Gerar Procuração
                  </Button>
                  <Button variant="outline" onClick={() => handleGenerateDeclaracao(selectedClient)}>
                    <FileCheck className="h-4 w-4 mr-2" />
                    Gerar Declaração
                  </Button>
                </div>
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>

      {/* Product Selection Dialog - Only for Contracts */}
      <Dialog open={productDialogOpen} onOpenChange={setProductDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Selecionar Produto
            </DialogTitle>
            <DialogDescription>
              Selecione o produto/serviço para o contrato de {clientForDocument?.nomeCompleto?.split(' ')[0]}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="product">Produto *</Label>
              {productsLoading ? (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Carregando produtos do RD Station...
                </div>
              ) : products.length === 0 ? (
                <div className="text-sm text-muted-foreground">
                  <p>Nenhum produto encontrado no RD Station.</p>
                  <Button 
                    variant="link" 
                    className="p-0 h-auto" 
                    onClick={fetchProducts}
                  >
                    Tentar novamente
                  </Button>
                </div>
              ) : (
                <Select value={selectedProduct} onValueChange={setSelectedProduct}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um produto" />
                  </SelectTrigger>
                  <SelectContent>
                    {products.map((product) => (
                      <SelectItem key={product._id} value={product._id}>
                        <div className="flex flex-col">
                          <span>{product.name}</span>
                          {product.base_price && (
                            <span className="text-xs text-muted-foreground">
                              R$ {product.base_price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </span>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setProductDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleGenerateDocument} disabled={!selectedProduct || productsLoading}>
              <FileSignature className="h-4 w-4 mr-2" />
              Gerar Contrato
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Contract Generator Dialog */}
      <ContractGenerator
        open={contractGeneratorOpen}
        onOpenChange={setContractGeneratorOpen}
        client={clientForDocument}
        productName={products.find(p => p._id === selectedProduct)?.name || ''}
        qualification={clientForDocument ? (qualificationSaved ? editedQualification : generateClientQualification(clientForDocument)) : ''}
      />
    </Layout>
  );
};

export default SetorComercial;
