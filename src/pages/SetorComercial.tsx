import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAdminPermissions } from "@/hooks/useAdminPermissions";
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
  Calendar,
  CreditCard
} from "lucide-react";
import { format } from "date-fns";
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
    } catch (error: any) {
      console.error('Error fetching clients:', error);
      toast.error('Erro ao carregar dados: ' + error.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchClients();
  }, []);

  // Reverse order to show most recent first
  const reversedClients = [...clients].reverse();
  
  const filteredClients = reversedClients.filter(client => 
    client.nomeCompleto?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.cpf?.includes(searchTerm) ||
    client.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.telefone?.includes(searchTerm)
  );
  
  // Limit to 30 unless showAll is true
  const displayedClients = showAll ? filteredClients : filteredClients.slice(0, 30);
  const hasMoreClients = filteredClients.length > 30;

  const handleViewDetails = (client: Client) => {
    setSelectedClient(client);
    setDetailsOpen(true);
  };

  const handleGenerateContract = (client: Client) => {
    toast.info('Funcionalidade de geração de contrato em desenvolvimento');
    // TODO: Implement contract generation
  };

  const handleGenerateProcuracao = (client: Client) => {
    toast.info('Funcionalidade de geração de procuração em desenvolvimento');
    // TODO: Implement procuracao generation
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
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome, CPF, email ou telefone..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

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
    </Layout>
  );
};

export default SetorComercial;
