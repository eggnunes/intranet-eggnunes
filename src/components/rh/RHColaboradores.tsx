import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel } from '@/components/ui/dropdown-menu';
import { Users, AlertTriangle, FileCheck, X, MoreVertical, User, DollarSign, Briefcase, FileText, Heart, MessageSquare, Palmtree, ExternalLink } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { useStartConversation } from '@/hooks/useStartConversation';

interface Colaborador {
  id: string;
  full_name: string;
  email: string;
  position: string;
  avatar_url: string | null;
  cargo_id: string | null;
  contrato_associado_registrado: boolean | null;
  rh_cargos?: { id: string; nome: string; valor_base: number } | null;
}

interface Cargo {
  id: string;
  nome: string;
  valor_base: number;
}

export function RHColaboradores() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { startConversation } = useStartConversation();
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([]);
  const [cargos, setCargos] = useState<Cargo[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);

  const isRafael = currentUserEmail === 'rafael@eggnunes.com.br';

  useEffect(() => {
    if (user?.email) {
      setCurrentUserEmail(user.email);
    }
    fetchData();
  }, [user]);

  const fetchData = async () => {
    try {
      const [colabRes, cargosRes] = await Promise.all([
        supabase
          .from('profiles')
          .select('id, full_name, email, position, avatar_url, cargo_id, contrato_associado_registrado')
          .eq('approval_status', 'approved')
          .eq('is_active', true)
          .order('full_name'),
        supabase
          .from('rh_cargos')
          .select('*')
          .eq('is_active', true)
          .order('valor_base')
      ]);

      if (colabRes.error) throw colabRes.error;
      if (cargosRes.error) throw cargosRes.error;

      // Map cargos to colaboradores
      const cargosMap = new Map((cargosRes.data || []).map(c => [c.id, c]));
      const colabsWithCargos = (colabRes.data || []).map(c => ({
        ...c,
        rh_cargos: c.cargo_id ? cargosMap.get(c.cargo_id) || null : null
      }));

      setColaboradores(colabsWithCargos as Colaborador[]);
      setCargos(cargosRes.data || []);
    } catch (error: any) {
      toast.error('Erro ao carregar dados: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCargoChange = async (colaboradorId: string, cargoId: string) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ cargo_id: cargoId || null })
        .eq('id', colaboradorId);

      if (error) throw error;

      toast.success('Cargo atualizado!');
      fetchData();
    } catch (error: any) {
      toast.error('Erro ao atualizar cargo: ' + error.message);
    }
  };

  const handleContratoChange = async (colaboradorId: string, registrado: boolean) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ contrato_associado_registrado: registrado })
        .eq('id', colaboradorId);

      if (error) throw error;

      toast.success('Status do contrato atualizado!');
      fetchData();
    } catch (error: any) {
      toast.error('Erro ao atualizar status: ' + error.message);
    }
  };

  // Apenas Rafael pode dispensar alerta de contrato (marcando como registrado)
  const handleDispensarAlertaContrato = async (colaboradorId: string) => {
    if (!isRafael) return;
    
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ contrato_associado_registrado: true })
        .eq('id', colaboradorId);

      if (error) throw error;

      toast.success('Alerta dispensado!');
      fetchData();
    } catch (error: any) {
      toast.error('Erro ao dispensar alerta: ' + error.message);
    }
  };

  const getPositionLabel = (position: string) => {
    const labels: Record<string, string> = {
      'socio': 'Sócio',
      'advogado': 'Advogado',
      'estagiario': 'Estagiário',
      'comercial': 'Comercial',
      'administrativo': 'Administrativo'
    };
    return labels[position] || position;
  };

  const formatCurrency = (value: number) => {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  // Apenas advogados precisam de contrato (sócios não)
  const isAdvogado = (position: string) => {
    return position === 'advogado';
  };

  // Filtrar apenas advogados (não sócios) sem contrato
  const advogadosSemContrato = colaboradores.filter(
    c => isAdvogado(c.position) && c.contrato_associado_registrado !== true
  );

  if (loading) {
    return <div className="flex items-center justify-center p-8">Carregando...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Alerta de Pendências - Apenas advogados (não sócios) */}
      {advogadosSemContrato.length > 0 && (
        <Card className="border-orange-200 bg-orange-50 dark:bg-orange-950/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-orange-600">
              <AlertTriangle className="h-5 w-5" />
              Contratos Pendentes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-3">
              Os seguintes advogados não possuem contrato de associado registrado:
            </p>
            <div className="flex flex-wrap gap-2">
              {advogadosSemContrato.map(c => (
                <Badge 
                  key={c.id} 
                  variant="outline" 
                  className="border-orange-300 flex items-center gap-1"
                >
                  {c.full_name}
                  {isRafael && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-4 w-4 p-0 ml-1 hover:bg-orange-200"
                      onClick={() => handleDispensarAlertaContrato(c.id)}
                      title="Dispensar alerta"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  )}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Lista de Colaboradores */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Colaboradores - Cargos e Contratos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Colaborador</TableHead>
                <TableHead>Função</TableHead>
                <TableHead>Cargo</TableHead>
                <TableHead>Valor Base</TableHead>
                <TableHead>Contrato Associado</TableHead>
                <TableHead className="w-[100px]">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {colaboradores.map((colab) => (
                <TableRow key={colab.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={colab.avatar_url || undefined} />
                        <AvatarFallback>
                          {colab.full_name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-medium">{colab.full_name}</div>
                        <div className="text-xs text-muted-foreground">{colab.email}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{getPositionLabel(colab.position)}</Badge>
                  </TableCell>
                  <TableCell>
                    <Select
                      value={colab.cargo_id || 'none'}
                      onValueChange={(value) => handleCargoChange(colab.id, value === 'none' ? '' : value)}
                    >
                      <SelectTrigger className="w-48">
                        <SelectValue placeholder="Selecionar cargo" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Sem cargo definido</SelectItem>
                        {cargos.map(c => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    {colab.rh_cargos ? (
                      <span className="font-medium">{formatCurrency(colab.rh_cargos.valor_base)}</span>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {isAdvogado(colab.position) ? (
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={colab.contrato_associado_registrado === true}
                          onCheckedChange={(checked) => handleContratoChange(colab.id, checked)}
                        />
                        <Label className="text-sm">
                          {colab.contrato_associado_registrado ? (
                            <span className="text-green-600 flex items-center gap-1">
                              <FileCheck className="h-4 w-4" />
                              Registrado
                            </span>
                          ) : (
                            <span className="text-orange-600">Pendente</span>
                          )}
                        </Label>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">N/A</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-56">
                        <DropdownMenuLabel>Atalhos do Perfil</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => navigate(`/rh?colaboradorId=${colab.id}&tab=dados`)}>
                          <User className="h-4 w-4 mr-2" />
                          Dados Pessoais
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => navigate(`/rh?colaboradorId=${colab.id}&tab=pagamentos`)}>
                          <DollarSign className="h-4 w-4 mr-2" />
                          Pagamentos
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => navigate(`/rh?colaboradorId=${colab.id}&tab=carreira`)}>
                          <Briefcase className="h-4 w-4 mr-2" />
                          Carreira / Férias
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => navigate(`/rh?colaboradorId=${colab.id}&tab=documentos`)}>
                          <FileText className="h-4 w-4 mr-2" />
                          Documentos
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => navigate(`/rh?colaboradorId=${colab.id}&tab=documentos-medicos`)}>
                          <Heart className="h-4 w-4 mr-2" />
                          Docs. Médicos
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => startConversation(colab.id, colab.full_name)}>
                          <MessageSquare className="h-4 w-4 mr-2" />
                          Enviar Mensagem
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => navigate(`/rh?colaboradorId=${colab.id}`)}>
                          <ExternalLink className="h-4 w-4 mr-2" />
                          Ver Perfil Completo
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
