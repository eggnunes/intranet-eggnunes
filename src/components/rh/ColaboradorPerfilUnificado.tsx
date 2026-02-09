import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { 
  User, Calendar, Briefcase, DollarSign, TrendingUp, CheckSquare, 
  FileText, Phone, MapPin, Mail, IdCard, Award, Cake, CalendarCheck,
  ArrowLeft, Clock, FileSignature, Palmtree, Heart, MessageSquare, Plus, Camera
} from 'lucide-react';
import { useStartConversation } from '@/hooks/useStartConversation';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format, parse, subMonths, differenceInMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { formatMesReferencia, formatLocalDate, parseLocalDate } from '@/lib/dateUtils';
import { ColaboradorDocumentos, ColaboradorDocumentosMedicos, PromocaoDialog } from '@/components/rh';
import { useUserRole } from '@/hooks/useUserRole';
import { InformalVacationSummary } from '@/components/ferias';

interface ColaboradorPerfilUnificadoProps {
  colaboradorId: string;
  initialTab?: string;
}

interface Colaborador {
  id: string;
  full_name: string;
  email: string;
  position: string;
  avatar_url: string | null;
  join_date: string | null;
  birth_date: string | null;
  salario: number | null;
  cargo_id: string | null;
  telefone: string | null;
  cpf: string | null;
  endereco_cep: string | null;
  endereco_logradouro: string | null;
  endereco_numero: string | null;
  endereco_complemento: string | null;
  endereco_bairro: string | null;
  endereco_cidade: string | null;
  endereco_estado: string | null;
  oab_number: string | null;
  oab_state: string | null;
}

interface Cargo {
  id: string;
  nome: string;
  valor_base: number;
}

interface Promocao {
  id: string;
  cargo_anterior_nome: string;
  cargo_novo_nome: string;
  data_promocao: string;
  observacoes: string | null;
}

interface HistoricoSalario {
  id: string;
  salario_anterior: number;
  salario_novo: number;
  data_alteracao: string;
  observacao: string | null;
}

interface Pagamento {
  id: string;
  mes_referencia: string;
  total_liquido: number;
  total_vantagens: number;
  total_descontos: number;
  data_pagamento: string | null;
  status: string;
}

interface PontuacaoAdvbox {
  mes: string;
  tarefas_concluidas: number;
  tarefas_atribuidas: number;
  percentual_conclusao: number;
}

interface Ferias {
  id: string;
  data_inicio: string;
  data_fim: string;
  status: string;
  dias_totais: number;
}

const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff7c43', '#a4de6c'];

export function ColaboradorPerfilUnificado({ colaboradorId, initialTab = 'dados' }: ColaboradorPerfilUnificadoProps) {
  const navigate = useNavigate();
  const { isAdmin, profile: currentUserProfile } = useUserRole();
  const { startConversation } = useStartConversation();
  const isSocio = currentUserProfile?.position === 'socio';
  const canViewMedical = isAdmin || isSocio;
  const [activeTab, setActiveTab] = useState(initialTab);
  const [promocaoDialogOpen, setPromocaoDialogOpen] = useState(false);
  
  const [colaborador, setColaborador] = useState<Colaborador | null>(null);
  const [cargo, setCargo] = useState<Cargo | null>(null);
  const [promocoes, setPromocoes] = useState<Promocao[]>([]);
  const [historicoSalario, setHistoricoSalario] = useState<HistoricoSalario[]>([]);
  const [pagamentos, setPagamentos] = useState<Pagamento[]>([]);
  const [pagamentosGrafico, setPagamentosGrafico] = useState<any[]>([]);
  const [pontuacaoAdvbox, setPontuacaoAdvbox] = useState<PontuacaoAdvbox[]>([]);
  const [ferias, setFerias] = useState<Ferias[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [reembolsosPorPagamento, setReembolsosPorPagamento] = useState<Record<string, number>>({});
  
  const canManagePromocoes = isAdmin || isSocio;
  const canEditPhoto = isAdmin || isSocio;

  useEffect(() => {
    fetchColaboradorCompleto();
  }, [colaboradorId]);

  const fetchColaboradorCompleto = async () => {
    setLoading(true);
    try {
      // Buscar todos os dados em paralelo
      const [
        profileRes,
        promocoesRes,
        historicoRes,
        pagamentosRes,
        feriasRes
      ] = await Promise.all([
        supabase
          .from('profiles')
          .select('*')
          .eq('id', colaboradorId)
          .single(),
        supabase
          .from('rh_promocoes')
          .select('id, cargo_anterior_nome, cargo_novo_nome, data_promocao, observacoes')
          .eq('colaborador_id', colaboradorId)
          .order('data_promocao', { ascending: false }),
        supabase
          .from('rh_historico_salario')
          .select('id, salario_anterior, salario_novo, data_alteracao, observacao')
          .eq('colaborador_id', colaboradorId)
          .order('data_alteracao', { ascending: false }),
        supabase
          .from('rh_pagamentos')
          .select('id, mes_referencia, total_liquido, total_vantagens, total_descontos, data_pagamento, status')
          .eq('colaborador_id', colaboradorId)
          .order('mes_referencia', { ascending: false })
          .limit(24),
        supabase
          .from('vacation_requests')
          .select('id, start_date, end_date, status, business_days')
          .eq('user_id', colaboradorId)
          .order('start_date', { ascending: false })
          .limit(10)
      ]);

      if (profileRes.error) throw profileRes.error;
      
      const profileData = profileRes.data as unknown as Colaborador;
      setColaborador(profileData);

      // Buscar cargo se existir
      if (profileData?.cargo_id) {
        const { data: cargoData } = await supabase
          .from('rh_cargos')
          .select('id, nome, valor_base')
          .eq('id', profileData.cargo_id)
          .single();
        if (cargoData) {
          setCargo(cargoData as Cargo);
        }
      }

      if (!promocoesRes.error) {
        setPromocoes(promocoesRes.data as Promocao[]);
      }

      if (!historicoRes.error) {
        setHistoricoSalario(historicoRes.data as HistoricoSalario[]);
      }

      if (!pagamentosRes.error) {
        const pags = pagamentosRes.data as Pagamento[];
        setPagamentos(pags);

        // Buscar reembolsos para cada pagamento
        const pagIds = pags.map(p => p.id);
        let reembolsosMap: Record<string, number> = {};
        if (pagIds.length > 0) {
          const { data: reembolsosData } = await supabase
            .from('rh_pagamento_itens')
            .select('pagamento_id, valor')
            .eq('rubrica_id', '47d8ce78-a5c8-4eb4-8799-420a97e144db')
            .in('pagamento_id', pagIds);
          
          (reembolsosData || []).forEach((item: any) => {
            reembolsosMap[item.pagamento_id] = (reembolsosMap[item.pagamento_id] || 0) + (item.valor || 0);
          });
        }
        setReembolsosPorPagamento(reembolsosMap);
        
        // Preparar dados para gráfico (já com reembolsos abatidos)
        const startDate = format(subMonths(new Date(), 12), 'yyyy-MM-dd');
        const pagamentosRecentes = pags.filter(p => p.mes_referencia >= startDate);
        const pagamentosFormatados = pagamentosRecentes
          .sort((a, b) => a.mes_referencia.localeCompare(b.mes_referencia))
          .map(p => {
            const reembolso = reembolsosMap[p.id] || 0;
            return {
              mes: formatMesReferencia(p.mes_referencia, 'MMM/yy'),
              total_liquido: p.total_liquido - reembolso,
              total_vantagens: p.total_vantagens - reembolso,
              total_descontos: p.total_descontos
            };
          });
        setPagamentosGrafico(pagamentosFormatados);
      }

      if (!feriasRes.error && feriasRes.data) {
        const feriasData = feriasRes.data.map((f: any) => ({
          id: f.id,
          data_inicio: f.start_date,
          data_fim: f.end_date,
          status: f.status,
          dias_totais: f.business_days || 0
        }));
        setFerias(feriasData);
      }

      // Buscar pontuação ADVBOX
      await fetchPontuacaoAdvbox(profileData);
    } catch (error: any) {
      toast.error('Erro ao carregar dados do colaborador: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchPontuacaoAdvbox = async (colaboradorData: Colaborador) => {
    try {
      const colaboradorNome = colaboradorData.full_name || '';
      if (!colaboradorNome) return;

      // Query tasks from database filtered by collaborator name
      const { data: tasks, error } = await supabase
        .from('advbox_tasks')
        .select('due_date, status, points, assigned_users')
        .ilike('assigned_users', `%${colaboradorNome.split(' ')[0]}%`);

      if (error) {
        console.error('Erro ao buscar tarefas ADVBOX:', error);
        return;
      }

      // Group by month
      const porMes: Record<string, { concluidas: number; total: number }> = {};
      
      (tasks || []).forEach((task: any) => {
        if (!task.due_date) return;
        
        const mes = formatMesReferencia(task.due_date.substring(0, 10), 'MMM/yy');
        if (!porMes[mes]) {
          porMes[mes] = { concluidas: 0, total: 0 };
        }
        porMes[mes].total++;
        
        if (task.status === 'completed') {
          porMes[mes].concluidas++;
        }
      });

      const pontuacaoArray = Object.entries(porMes).map(([mes, dados]) => ({
        mes,
        tarefas_concluidas: dados.concluidas,
        tarefas_atribuidas: dados.total,
        percentual_conclusao: dados.total > 0 ? Math.round((dados.concluidas / dados.total) * 100) : 0
      }));

      setPontuacaoAdvbox(pontuacaoArray);
    } catch (error) {
      console.error('Erro ao buscar pontuação ADVBOX:', error);
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

  const formatCurrency = (value: number | null | undefined) => {
    if (value === null || value === undefined) return 'R$ 0,00';
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const calculateTenure = (joinDate: string | null) => {
    if (!joinDate) return null;
    const join = parse(joinDate, 'yyyy-MM-dd', new Date());
    const totalMonths = differenceInMonths(new Date(), join);
    const years = Math.floor(totalMonths / 12);
    const months = totalMonths % 12;
    
    if (years === 0 && months === 0) return 'Menos de 1 mês';
    if (years === 0) return `${months} ${months === 1 ? 'mês' : 'meses'}`;
    if (months === 0) return `${years} ${years === 1 ? 'ano' : 'anos'}`;
    return `${years} ${years === 1 ? 'ano' : 'anos'} e ${months} ${months === 1 ? 'mês' : 'meses'}`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pago': return 'bg-green-500';
      case 'pendente': return 'bg-yellow-500';
      case 'cancelado': return 'bg-red-500';
      case 'approved': return 'bg-green-500';
      case 'pending': return 'bg-yellow-500';
      case 'rejected': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-muted-foreground">Carregando perfil...</div>
      </div>
    );
  }

  if (!colaborador) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">Colaborador não encontrado</p>
        <Button onClick={() => navigate('/rh')} className="mt-4">
          Voltar
        </Button>
      </div>
    );
  }

  const totalPago = pagamentos.reduce((acc, p) => acc + p.total_liquido - (reembolsosPorPagamento[p.id] || 0), 0);
  const mediaMensal = pagamentos.length > 0 ? totalPago / pagamentos.length : 0;
  const totalTarefasConcluidas = pontuacaoAdvbox.reduce((acc, p) => acc + p.tarefas_concluidas, 0);
  const totalTarefas = pontuacaoAdvbox.reduce((acc, p) => acc + p.tarefas_atribuidas, 0);

  return (
    <div className="space-y-6">
      {/* Cabeçalho do Colaborador */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row items-start gap-6">
            <div className="relative group">
              <Avatar className="h-24 w-24 border-4 border-primary/30">
                <AvatarImage src={colaborador.avatar_url || undefined} />
                <AvatarFallback className="bg-gradient-to-br from-primary/20 to-accent/20 text-primary text-3xl">
                  {colaborador.full_name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              {canEditPhoto && (
                <>
                  <input
                    type="file"
                    id={`avatar-upload-${colaboradorId}`}
                    accept="image/*"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      if (file.size > 5 * 1024 * 1024) {
                        toast.error('A imagem deve ter no máximo 5MB');
                        return;
                      }
                      setUploadingPhoto(true);
                      try {
                        const ext = file.name.split('.').pop();
                        const filePath = `${colaboradorId}/${Date.now()}.${ext}`;
                        const { error: uploadError } = await supabase.storage
                          .from('avatars')
                          .upload(filePath, file, { upsert: true });
                        if (uploadError) throw uploadError;
                        const { data: urlData } = supabase.storage
                          .from('avatars')
                          .getPublicUrl(filePath);
                        const { error: updateError } = await supabase
                          .from('profiles')
                          .update({ avatar_url: urlData.publicUrl })
                          .eq('id', colaboradorId);
                        if (updateError) throw updateError;
                        setColaborador(prev => prev ? { ...prev, avatar_url: urlData.publicUrl } : prev);
                        toast.success('Foto atualizada com sucesso!');
                      } catch (err: any) {
                        toast.error('Erro ao atualizar foto: ' + err.message);
                      } finally {
                        setUploadingPhoto(false);
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => document.getElementById(`avatar-upload-${colaboradorId}`)?.click()}
                    disabled={uploadingPhoto}
                    className="absolute bottom-0 right-0 bg-primary text-primary-foreground rounded-full p-1.5 shadow-md opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-50"
                    title="Alterar foto"
                  >
                    <Camera className="h-4 w-4" />
                  </button>
                </>
              )}
            </div>
            <div className="flex-1">
              <h2 className="text-3xl font-bold">{colaborador.full_name}</h2>
              <p className="text-muted-foreground flex items-center gap-2 mt-1">
                <Mail className="h-4 w-4" />
                {colaborador.email}
              </p>
              <div className="flex items-center gap-2 mt-3 flex-wrap">
                <Badge className="text-sm">{getPositionLabel(colaborador.position)}</Badge>
                {cargo && (
                  <Badge variant="outline" className="text-sm">{cargo.nome}</Badge>
                )}
                {colaborador.join_date && (
                  <Badge variant="secondary" className="flex items-center gap-1">
                    <CalendarCheck className="h-3 w-3" />
                    {calculateTenure(colaborador.join_date)}
                  </Badge>
                )}
              </div>
              {/* Botão de Mensagem */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => startConversation(colaboradorId, colaborador.full_name)}
                className="gap-2"
              >
                <MessageSquare className="h-4 w-4" />
                Enviar Mensagem
              </Button>
            </div>
            <div className="text-right">
              {colaborador.salario && (
                <div>
                  <p className="text-sm text-muted-foreground">
                    {colaborador.position === 'advogado' || colaborador.position === 'socio' ? 'Pagamento' : 'Salário'} Atual
                  </p>
                  <p className="text-3xl font-bold text-green-600 dark:text-green-400">
                    {formatCurrency(colaborador.salario)}
                  </p>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Cards de Métricas */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Pago (12 meses)</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalPago)}</div>
            <p className="text-xs text-muted-foreground">
              Média: {formatCurrency(mediaMensal)}/mês
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Promoções</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{promocoes.length}</div>
            <p className="text-xs text-muted-foreground">
              {promocoes.length > 0 
                ? `Última: ${format(parse(promocoes[0].data_promocao, 'yyyy-MM-dd', new Date()), "MMM/yyyy", { locale: ptBR })}`
                : 'Nenhuma promoção'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tarefas ADVBOX</CardTitle>
            <CheckSquare className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalTarefasConcluidas}/{totalTarefas}</div>
            <p className="text-xs text-muted-foreground">
              {totalTarefas > 0 
                ? `${Math.round((totalTarefasConcluidas / totalTarefas) * 100)}% concluídas`
                : 'Sem dados'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Férias</CardTitle>
            <Palmtree className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{ferias.filter(f => f.status === 'approved').length}</div>
            <p className="text-xs text-muted-foreground">
              Períodos aprovados
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Abas de Conteúdo */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid grid-cols-2 md:grid-cols-6 w-full">
          <TabsTrigger value="dados">Dados Pessoais</TabsTrigger>
          <TabsTrigger value="pagamentos">Pagamentos</TabsTrigger>
          <TabsTrigger value="advbox">ADVBOX</TabsTrigger>
          <TabsTrigger value="carreira">Carreira</TabsTrigger>
          <TabsTrigger value="documentos">Documentos</TabsTrigger>
          {canViewMedical && (
            <TabsTrigger value="documentos-medicos">Docs. Médicos</TabsTrigger>
          )}
        </TabsList>

        {/* Dados Pessoais */}
        <TabsContent value="dados" className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Informações Pessoais
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Telefone</p>
                    <p className="font-medium flex items-center gap-2">
                      <Phone className="h-4 w-4" />
                      {colaborador.telefone || 'Não informado'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">CPF</p>
                    <p className="font-medium">{colaborador.cpf || 'Não informado'}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Data de Nascimento</p>
                    <p className="font-medium flex items-center gap-2">
                      <Cake className="h-4 w-4" />
                      {colaborador.birth_date 
                        ? format(parse(colaborador.birth_date, 'yyyy-MM-dd', new Date()), "dd/MM/yyyy")
                        : 'Não informado'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Data de Ingresso</p>
                    <p className="font-medium flex items-center gap-2">
                      <CalendarCheck className="h-4 w-4" />
                      {colaborador.join_date 
                        ? format(parse(colaborador.join_date, 'yyyy-MM-dd', new Date()), "dd/MM/yyyy")
                        : 'Não informado'}
                    </p>
                  </div>
                </div>
                {(colaborador.oab_number || colaborador.oab_state) && (
                  <div>
                    <p className="text-sm text-muted-foreground">OAB</p>
                    <p className="font-medium flex items-center gap-2">
                      <IdCard className="h-4 w-4" />
                      {colaborador.oab_state}/{colaborador.oab_number}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="h-5 w-5" />
                  Endereço
                </CardTitle>
              </CardHeader>
              <CardContent>
                {colaborador.endereco_logradouro ? (
                  <div className="space-y-2">
                    <p className="font-medium">
                      {colaborador.endereco_logradouro}, {colaborador.endereco_numero}
                      {colaborador.endereco_complemento && ` - ${colaborador.endereco_complemento}`}
                    </p>
                    <p className="text-muted-foreground">
                      {colaborador.endereco_bairro && `${colaborador.endereco_bairro}, `}
                      {colaborador.endereco_cidade && `${colaborador.endereco_cidade} - `}
                      {colaborador.endereco_estado}
                    </p>
                    {colaborador.endereco_cep && (
                      <p className="text-sm text-muted-foreground">CEP: {colaborador.endereco_cep}</p>
                    )}
                  </div>
                ) : (
                  <p className="text-muted-foreground">Endereço não informado</p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Pagamentos */}
        <TabsContent value="pagamentos" className="space-y-4">
          {/* Gráfico de Evolução */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Evolução de Pagamentos (12 meses)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {pagamentosGrafico.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={pagamentosGrafico}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="mes" />
                    <YAxis tickFormatter={(v) => `R$${(v/1000).toFixed(0)}k`} />
                    <Tooltip formatter={(value: number) => formatCurrency(value)} />
                    <Legend />
                    <Line type="monotone" dataKey="total_liquido" name="Líquido" stroke="#22c55e" strokeWidth={2} />
                    <Line type="monotone" dataKey="total_vantagens" name="Vantagens" stroke="#3b82f6" strokeWidth={2} />
                    <Line type="monotone" dataKey="total_descontos" name="Descontos" stroke="#ef4444" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                  Nenhum pagamento registrado
                </div>
              )}
            </CardContent>
          </Card>

          {/* Tabela de Pagamentos */}
          <Card>
            <CardHeader>
              <CardTitle>Histórico de Pagamentos</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Mês Ref.</TableHead>
                    <TableHead>Data Pagamento</TableHead>
                    <TableHead className="text-right">Valor Líquido</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pagamentos.slice(0, 12).map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>
                        {formatMesReferencia(p.mes_referencia, 'MMMM/yyyy')}
                      </TableCell>
                      <TableCell>
                        {p.data_pagamento 
                          ? formatLocalDate(p.data_pagamento)
                          : '-'}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(p.total_liquido - (reembolsosPorPagamento[p.id] || 0))}
                      </TableCell>
                      <TableCell>
                        <Badge className={getStatusColor(p.status)}>
                          {p.status === 'pago' ? 'Pago' : p.status === 'pendente' ? 'Pendente' : p.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                  {pagamentos.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground">
                        Nenhum pagamento registrado
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ADVBOX */}
        <TabsContent value="advbox" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckSquare className="h-5 w-5" />
                Pontuação Mensal - Tarefas
              </CardTitle>
            </CardHeader>
            <CardContent>
              {pontuacaoAdvbox.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={pontuacaoAdvbox}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="mes" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="tarefas_atribuidas" name="Atribuídas" fill="#94a3b8" />
                    <Bar dataKey="tarefas_concluidas" name="Concluídas" fill="#22c55e" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                  Sem dados de tarefas
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Carreira */}
        <TabsContent value="carreira" className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            {/* Promoções */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Award className="h-5 w-5" />
                    Histórico de Promoções
                  </CardTitle>
                  {canManagePromocoes && (
                    <Button size="sm" variant="outline" onClick={() => setPromocaoDialogOpen(true)}>
                      <Plus className="h-4 w-4 mr-1" />
                      Nova
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {promocoes.length > 0 ? (
                  <div className="space-y-4">
                    {promocoes.map((p, index) => (
                      <div key={p.id} className="flex items-start gap-3">
                        <div className={`w-3 h-3 rounded-full mt-1.5 ${index === 0 ? 'bg-green-500' : 'bg-muted'}`} />
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground">{p.cargo_anterior_nome}</span>
                            <span>→</span>
                            <span className="font-medium">{p.cargo_novo_nome}</span>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {format(parse(p.data_promocao, 'yyyy-MM-dd', new Date()), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                          </p>
                          {p.observacoes && (
                            <p className="text-sm mt-1">{p.observacoes}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-4">
                    <p className="text-muted-foreground mb-3">Nenhuma promoção registrada</p>
                    {canManagePromocoes && (
                      <Button variant="outline" size="sm" onClick={() => setPromocaoDialogOpen(true)}>
                        <Plus className="h-4 w-4 mr-1" />
                        Registrar Promoção
                      </Button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Férias */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Palmtree className="h-5 w-5" />
                  Histórico de Férias
                </CardTitle>
              </CardHeader>
              <CardContent>
                {ferias.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Período</TableHead>
                        <TableHead>Dias</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {ferias.map((f) => (
                        <TableRow key={f.id}>
                          <TableCell>
                            {formatLocalDate(f.data_inicio, 'dd/MM/yy')} - {formatLocalDate(f.data_fim, 'dd/MM/yy')}
                          </TableCell>
                          <TableCell>{f.dias_totais}</TableCell>
                          <TableCell>
                            <Badge className={getStatusColor(f.status)}>
                              {f.status === 'approved' ? 'Aprovado' : f.status === 'pending' ? 'Pendente' : f.status}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <p className="text-muted-foreground text-center py-4">
                    Nenhum registro de férias
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Férias Informais - Apenas para Admins/Sócios */}
          {canViewMedical && (
            <InformalVacationSummary colaboradorId={colaboradorId} />
          )}

          {/* Histórico de Salário */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Histórico de Alterações Salariais
              </CardTitle>
            </CardHeader>
            <CardContent>
              {historicoSalario.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead className="text-right">Anterior</TableHead>
                      <TableHead className="text-right">Novo</TableHead>
                      <TableHead>Observação</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {historicoSalario.map((h) => (
                      <TableRow key={h.id}>
                        <TableCell>
                          {formatLocalDate(h.data_alteracao)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(h.salario_anterior)}
                        </TableCell>
                        <TableCell className="text-right font-medium text-green-600">
                          {formatCurrency(h.salario_novo)}
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate">
                          {h.observacao || '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-muted-foreground text-center py-4">
                  Nenhuma alteração salarial registrada
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Documentos */}
        <TabsContent value="documentos">
          <ColaboradorDocumentos colaboradorId={colaboradorId} />
        </TabsContent>

        {/* Documentos Médicos */}
        {canViewMedical && (
          <TabsContent value="documentos-medicos">
            <ColaboradorDocumentosMedicos colaboradorId={colaboradorId} />
          </TabsContent>
        )}
      </Tabs>

      {/* Dialog de Promoção */}
      {canManagePromocoes && colaborador && (
        <PromocaoDialog
          open={promocaoDialogOpen}
          onOpenChange={setPromocaoDialogOpen}
          colaborador={{
            id: colaborador.id,
            full_name: colaborador.full_name,
            cargo_id: colaborador.cargo_id,
            position: colaborador.position
          }}
          onSuccess={fetchColaboradorCompleto}
        />
      )}
    </div>
  );
}
