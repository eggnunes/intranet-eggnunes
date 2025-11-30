import { useState, useEffect } from 'react';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Briefcase, AlertCircle, TrendingUp, Search, Filter } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Lawsuit {
  id: number;
  process_number: string;
  protocol_number: string | null;
  folder: string | null;
  process_date: string | null;
  fees_expec: number | null;
  fees_money: number | null;
  contingency: number | null;
  type_lawsuit_id: number;
  type: string;
  group_id: number;
  group: string;
  created_at: string;
  status_closure: string | null;
  exit_production: string | null;
  exit_execution: string | null;
  responsible_id: number;
  responsible: string;
  customers?: string; // Nome dos clientes
}

interface Movement {
  lawsuit_id: number;
  date: string;
  title: string;
  header: string;
  process_number: string;
  protocol_number: string | null;
  customers: string;
}

export default function ProcessosDashboard() {
  const [lawsuits, setLawsuits] = useState<Lawsuit[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [movementSearchTerm, setMovementSearchTerm] = useState('');
  const [selectedResponsibles, setSelectedResponsibles] = useState<string[]>([]);
  const [showAllResponsibles, setShowAllResponsibles] = useState(true);
  const { toast } = useToast();
  
  // Extrair lista única de responsáveis
  const responsibles = Array.from(new Set(lawsuits.map(l => l.responsible).filter(Boolean)));
  
  // Filtrar processos
  const filteredLawsuits = lawsuits.filter(lawsuit => {
    const matchesSearch = !searchTerm || 
      lawsuit.process_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lawsuit.type.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lawsuit.group.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lawsuit.customers?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lawsuit.responsible?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesResponsible = showAllResponsibles || 
      selectedResponsibles.includes(lawsuit.responsible);
    
    return matchesSearch && matchesResponsible;
  });
  
  // Filtrar movimentações
  const filteredMovements = movements.filter(movement => {
    return !movementSearchTerm ||
      movement.process_number.toLowerCase().includes(movementSearchTerm.toLowerCase()) ||
      movement.title.toLowerCase().includes(movementSearchTerm.toLowerCase()) ||
      movement.customers?.toLowerCase().includes(movementSearchTerm.toLowerCase()) ||
      movement.header?.toLowerCase().includes(movementSearchTerm.toLowerCase());
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [lawsuitsRes, movementsRes] = await Promise.all([
        supabase.functions.invoke('advbox-integration/lawsuits'),
        supabase.functions.invoke('advbox-integration/last-movements'),
      ]);

      if (lawsuitsRes.error) throw lawsuitsRes.error;
      if (movementsRes.error) throw movementsRes.error;

      setLawsuits(lawsuitsRes.data?.data || []);
      setMovements(movementsRes.data?.data || []);
    } catch (error) {
      console.error('Error fetching Advbox data:', error);
      toast({
        title: 'Erro ao carregar dados',
        description: 'Não foi possível carregar os dados do Advbox.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-muted-foreground">Carregando processos...</div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Briefcase className="h-8 w-8 text-primary" />
            Dashboard de Processos
          </h1>
          <p className="text-muted-foreground mt-2">
            Acompanhe seus processos e movimentações em tempo real
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Estatísticas */}
          <Card className="lg:col-span-3">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Visão Geral
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center p-4 bg-primary/5 rounded-lg">
                  <div className="text-3xl font-bold text-primary">{filteredLawsuits.length}</div>
                  <div className="text-sm text-muted-foreground mt-1">Processos {searchTerm || !showAllResponsibles ? 'Filtrados' : 'Ativos'}</div>
                </div>
                <div className="text-center p-4 bg-blue-500/5 rounded-lg">
                  <div className="text-3xl font-bold text-blue-600">{filteredMovements.length}</div>
                  <div className="text-sm text-muted-foreground mt-1">Movimentações {movementSearchTerm ? 'Filtradas' : 'Recentes'}</div>
                </div>
                <div className="text-center p-4 bg-orange-500/5 rounded-lg">
                  <div className="text-3xl font-bold text-orange-600">
                    {filteredMovements.filter(m => {
                      const date = new Date(m.date);
                      const today = new Date();
                      const diffDays = Math.floor((today.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
                      return diffDays <= 7;
                    }).length}
                  </div>
                  <div className="text-sm text-muted-foreground mt-1">Alertas (Últimos 7 dias)</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Processos Ativos */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <div className="flex flex-col gap-3">
                <div>
                  <CardTitle>Processos Ativos</CardTitle>
                  <CardDescription>Seus processos em andamento</CardDescription>
                </div>
                
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar processos..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                  
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="icon">
                        <Filter className="h-4 w-4" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-80">
                      <div className="space-y-4">
                        <h4 className="font-medium">Filtrar por Responsável</h4>
                        
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="all-responsibles"
                            checked={showAllResponsibles}
                            onCheckedChange={(checked) => {
                              setShowAllResponsibles(checked as boolean);
                              if (checked) setSelectedResponsibles([]);
                            }}
                          />
                          <label htmlFor="all-responsibles" className="text-sm font-medium cursor-pointer">
                            Todos os responsáveis
                          </label>
                        </div>
                        
                        <div className="border-t pt-2 space-y-2 max-h-60 overflow-y-auto">
                          {responsibles.map((responsible) => (
                            <div key={responsible} className="flex items-center space-x-2">
                              <Checkbox
                                id={responsible}
                                checked={selectedResponsibles.includes(responsible)}
                                disabled={showAllResponsibles}
                                onCheckedChange={(checked) => {
                                  if (checked) {
                                    setSelectedResponsibles([...selectedResponsibles, responsible]);
                                    setShowAllResponsibles(false);
                                  } else {
                                    setSelectedResponsibles(selectedResponsibles.filter(r => r !== responsible));
                                  }
                                }}
                              />
                              <label htmlFor={responsible} className="text-sm cursor-pointer">
                                {responsible}
                              </label>
                            </div>
                          ))}
                        </div>
                        
                        {!showAllResponsibles && selectedResponsibles.length > 0 && (
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => {
                              setSelectedResponsibles([]);
                              setShowAllResponsibles(true);
                            }}
                            className="w-full"
                          >
                            Limpar Filtros
                          </Button>
                        )}
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                <div className="space-y-3">
                   {filteredLawsuits.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      {searchTerm || !showAllResponsibles ? 'Nenhum processo encontrado com os filtros aplicados' : 'Nenhum processo encontrado'}
                    </p>
                  ) : (
                    filteredLawsuits.map((lawsuit) => (
                      <Card key={lawsuit.id} className="hover:shadow-md transition-shadow">
                        <CardContent className="p-4">
                          <div className="space-y-3">
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1">
                                <p className="font-semibold text-sm mb-1">{lawsuit.process_number}</p>
                                {lawsuit.customers && (
                                  <p className="text-xs text-muted-foreground mb-2">
                                    Cliente: <span className="font-medium text-foreground">{lawsuit.customers}</span>
                                  </p>
                                )}
                                <div className="flex gap-2 mt-2">
                                  <Badge variant="outline" className="text-xs">
                                    {lawsuit.type}
                                  </Badge>
                                  <Badge variant="secondary" className="text-xs">
                                    {lawsuit.group}
                                  </Badge>
                                </div>
                              </div>
                            </div>
                            
                            {lawsuit.responsible && (
                              <div className="text-xs">
                                <span className="text-muted-foreground">Responsável: </span>
                                <span className="font-medium">{lawsuit.responsible}</span>
                              </div>
                            )}
                            
                            {lawsuit.folder && (
                              <div className="text-xs">
                                <span className="text-muted-foreground">Pasta: </span>
                                <span>{lawsuit.folder}</span>
                              </div>
                            )}
                            
                            <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t">
                              {lawsuit.created_at && (
                                <div>
                                  <span className="text-muted-foreground">Criado: </span>
                                  <span>{new Date(lawsuit.created_at).toLocaleDateString('pt-BR')}</span>
                                </div>
                              )}
                              {lawsuit.status_closure && (
                                <div>
                                  <span className="text-muted-foreground">Encerrado: </span>
                                  <span>{new Date(lawsuit.status_closure).toLocaleDateString('pt-BR')}</span>
                                </div>
                              )}
                              {lawsuit.exit_production && (
                                <div>
                                  <span className="text-muted-foreground">Saída produção: </span>
                                  <span>{new Date(lawsuit.exit_production).toLocaleDateString('pt-BR')}</span>
                                </div>
                              )}
                              {lawsuit.process_date && (
                                <div>
                                  <span className="text-muted-foreground">Data processo: </span>
                                  <span>{new Date(lawsuit.process_date).toLocaleDateString('pt-BR')}</span>
                                </div>
                              )}
                            </div>
                            
                            {(lawsuit.fees_expec || lawsuit.fees_money || lawsuit.contingency) && (
                              <div className="grid grid-cols-3 gap-2 text-xs pt-2 border-t">
                                {lawsuit.fees_expec && (
                                  <div>
                                    <span className="text-muted-foreground">Honorários Esperados: </span>
                                    <span className="font-medium">
                                      {lawsuit.fees_expec.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                    </span>
                                  </div>
                                )}
                                {lawsuit.fees_money && (
                                  <div>
                                    <span className="text-muted-foreground">Honorários: </span>
                                    <span className="font-medium">
                                      {lawsuit.fees_money.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                    </span>
                                  </div>
                                )}
                                {lawsuit.contingency && (
                                  <div>
                                    <span className="text-muted-foreground">Contingência: </span>
                                    <span className="font-medium">
                                      {lawsuit.contingency.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                    </span>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Movimentações Recentes */}
          <Card>
            <CardHeader>
              <div className="flex flex-col gap-3">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <AlertCircle className="h-5 w-5" />
                    Movimentações Recentes
                  </CardTitle>
                  <CardDescription>Últimas atualizações dos processos</CardDescription>
                </div>
                
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar movimentações..."
                    value={movementSearchTerm}
                    onChange={(e) => setMovementSearchTerm(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                <div className="space-y-3">
                  {filteredMovements.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      {movementSearchTerm ? 'Nenhuma movimentação encontrada com os filtros aplicados' : 'Nenhuma movimentação encontrada'}
                    </p>
                  ) : (
                    filteredMovements.map((movement, index) => (
                      <div key={`${movement.lawsuit_id}-${index}`} className="border-l-2 border-primary/30 pl-3 pb-4 mb-3">
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <Badge variant="outline" className="text-xs">
                            {new Date(movement.date).toLocaleDateString('pt-BR')}
                          </Badge>
                        </div>
                        
                        <div className="space-y-2">
                          <div>
                            <p className="text-xs font-semibold text-primary mb-1">
                              {movement.process_number}
                            </p>
                            {movement.customers && (
                              <p className="text-xs text-muted-foreground">
                                Cliente: {movement.customers}
                              </p>
                            )}
                          </div>
                          
                          <div className="bg-muted/30 p-2 rounded">
                            <p className="text-xs font-medium mb-1">{movement.title}</p>
                            {movement.header && (
                              <p className="text-xs text-muted-foreground">{movement.header}</p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
