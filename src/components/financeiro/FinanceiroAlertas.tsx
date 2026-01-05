import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { 
  Bell,
  AlertTriangle,
  Calendar,
  CheckCircle,
  Clock,
  Loader2,
  RefreshCw,
  X,
  Target,
  Database,
  TrendingUp,
  TrendingDown
} from 'lucide-react';
import { toast } from 'sonner';
import { format, differenceInDays, addDays, isPast, isToday, isTomorrow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Alerta {
  id: string;
  tipo: 'vencimento_hoje' | 'vencimento_proximo' | 'vencido' | 'saldo_baixo' | 'meta' | 'sistema';
  lancamento_id: string | null;
  titulo: string;
  mensagem: string;
  dataVencimento: string | null;
  valor: number;
  diasRestantes: number;
  fromDb?: boolean;
}

interface AlertaDB {
  id: string;
  tipo: string;
  mensagem: string;
  data_alerta: string;
  lido: boolean;
}

export function FinanceiroAlertas() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [alertas, setAlertas] = useState<Alerta[]>([]);
  const [alertasDB, setAlertasDB] = useState<AlertaDB[]>([]);
  const [alertasDismissed, setAlertasDismissed] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchAlertas();
  }, []);

  const fetchAlertas = async () => {
    setLoading(true);
    try {
      const hoje = new Date();
      const em7Dias = addDays(hoje, 7);

      // Buscar lançamentos pendentes com vencimento
      const { data: lancamentos } = await supabase
        .from('fin_lancamentos')
        .select('id, descricao, valor, tipo, data_vencimento, status')
        .eq('status', 'pendente')
        .not('data_vencimento', 'is', null)
        .lte('data_vencimento', format(em7Dias, 'yyyy-MM-dd'))
        .is('deleted_at', null)
        .order('data_vencimento');

      // Buscar saldo das contas
      const { data: contas } = await supabase
        .from('fin_contas')
        .select('nome, saldo_atual')
        .eq('ativa', true);

      // Buscar alertas do banco de dados (metas, backups, etc)
      const { data: alertasDoSistema } = await supabase
        .from('fin_alertas')
        .select('*')
        .eq('lido', false)
        .order('created_at', { ascending: false })
        .limit(20);

      setAlertasDB(alertasDoSistema || []);

      const alertasGerados: Alerta[] = [];

      // Adicionar alertas do sistema (metas, backups, etc)
      alertasDoSistema?.forEach(a => {
        let tipoAlerta: Alerta['tipo'] = 'sistema';
        
        if (a.tipo.includes('meta')) {
          tipoAlerta = 'meta';
        }
        
        alertasGerados.push({
          id: `db_${a.id}`,
          tipo: tipoAlerta,
          lancamento_id: null,
          titulo: a.tipo.includes('atingida') ? '🎉 Meta Atingida' : 
                  a.tipo.includes('ultrapassada') ? '🚨 Meta Ultrapassada' :
                  a.tipo.includes('risco') ? '⚠️ Meta em Risco' :
                  a.tipo.includes('backup') ? '💾 Backup' :
                  a.tipo.includes('recorrencia') ? '🔄 Recorrência' :
                  a.tipo.includes('advbox') ? '📁 ADVBOX' : 'Sistema',
          mensagem: a.mensagem,
          dataVencimento: a.data_alerta,
          valor: 0,
          diasRestantes: 0,
          fromDb: true
        });
      });

      // Gerar alertas de vencimento
      lancamentos?.forEach(l => {
        if (!l.data_vencimento) return;
        
        const dataVenc = new Date(l.data_vencimento);
        const diasRestantes = differenceInDays(dataVenc, hoje);
        
        let tipo: Alerta['tipo'];
        let titulo: string;
        
        if (isPast(dataVenc) && !isToday(dataVenc)) {
          tipo = 'vencido';
          titulo = `Lançamento vencido há ${Math.abs(diasRestantes)} dia(s)`;
        } else if (isToday(dataVenc)) {
          tipo = 'vencimento_hoje';
          titulo = 'Vence hoje!';
        } else if (isTomorrow(dataVenc)) {
          tipo = 'vencimento_proximo';
          titulo = 'Vence amanhã';
        } else {
          tipo = 'vencimento_proximo';
          titulo = `Vence em ${diasRestantes} dias`;
        }

        alertasGerados.push({
          id: `lanc_${l.id}`,
          tipo,
          lancamento_id: l.id,
          titulo,
          mensagem: l.descricao,
          dataVencimento: l.data_vencimento,
          valor: l.valor,
          diasRestantes
        });
      });

      // Alertas de saldo baixo
      contas?.forEach(c => {
        if (c.saldo_atual < 1000) {
          alertasGerados.push({
            id: `saldo_${c.nome}`,
            tipo: 'saldo_baixo',
            lancamento_id: null,
            titulo: 'Saldo baixo',
            mensagem: `A conta "${c.nome}" está com saldo baixo`,
            dataVencimento: null,
            valor: c.saldo_atual,
            diasRestantes: 0
          });
        }
      });

      // Ordenar por prioridade
      alertasGerados.sort((a, b) => {
        const prioridade: Record<string, number> = {
          vencido: 0,
          vencimento_hoje: 1,
          meta: 2,
          saldo_baixo: 3,
          vencimento_proximo: 4,
          sistema: 5
        };
        return (prioridade[a.tipo] || 5) - (prioridade[b.tipo] || 5);
      });

      setAlertas(alertasGerados);
    } catch (error) {
      console.error('Erro:', error);
    } finally {
      setLoading(false);
    }
  };

  const dismissAlerta = async (id: string) => {
    setAlertasDismissed(prev => new Set(prev).add(id));
    
    // Se for alerta do banco, marcar como lido
    if (id.startsWith('db_')) {
      const dbId = id.replace('db_', '');
      await supabase
        .from('fin_alertas')
        .update({ lido: true, lido_em: new Date().toISOString(), lido_por: user?.id })
        .eq('id', dbId);
    }
  };

  const marcarComoPago = async (lancamentoId: string) => {
    try {
      const { error } = await supabase
        .from('fin_lancamentos')
        .update({ status: 'pago' })
        .eq('id', lancamentoId);
      
      if (error) throw error;
      
      toast.success('Lançamento marcado como pago!');
      fetchAlertas();
    } catch (error) {
      toast.error('Erro ao atualizar lançamento');
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const getAlertaStyle = (tipo: Alerta['tipo']) => {
    switch (tipo) {
      case 'vencido':
        return {
          bg: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800',
          icon: <AlertTriangle className="h-5 w-5 text-red-500" />,
          badge: <Badge variant="destructive">Vencido</Badge>
        };
      case 'vencimento_hoje':
        return {
          bg: 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800',
          icon: <Clock className="h-5 w-5 text-orange-500" />,
          badge: <Badge className="bg-orange-500">Hoje</Badge>
        };
      case 'saldo_baixo':
        return {
          bg: 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800',
          icon: <AlertTriangle className="h-5 w-5 text-yellow-500" />,
          badge: <Badge className="bg-yellow-500">Atenção</Badge>
        };
      case 'meta':
        return {
          bg: 'bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800',
          icon: <Target className="h-5 w-5 text-purple-500" />,
          badge: <Badge className="bg-purple-500">Meta</Badge>
        };
      case 'sistema':
        return {
          bg: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800',
          icon: <Database className="h-5 w-5 text-green-500" />,
          badge: <Badge className="bg-green-500">Sistema</Badge>
        };
      case 'vencimento_proximo':
      default:
        return {
          bg: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800',
          icon: <Calendar className="h-5 w-5 text-blue-500" />,
          badge: <Badge variant="secondary">Próximo</Badge>
        };
    }
  };

  const alertasFiltrados = alertas.filter(a => !alertasDismissed.has(a.id));

  const alertasVencidos = alertasFiltrados.filter(a => a.tipo === 'vencido');
  const alertasHoje = alertasFiltrados.filter(a => a.tipo === 'vencimento_hoje');
  const alertasProximos = alertasFiltrados.filter(a => a.tipo === 'vencimento_proximo');
  const alertasSaldo = alertasFiltrados.filter(a => a.tipo === 'saldo_baixo');
  const alertasMetas = alertasFiltrados.filter(a => a.tipo === 'meta');
  const alertasSistema = alertasFiltrados.filter(a => a.tipo === 'sistema');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Bell className="h-6 w-6" />
          <div>
            <h2 className="text-xl font-bold">Alertas Financeiros</h2>
            <p className="text-sm text-muted-foreground">
              {alertasFiltrados.length} alerta(s) pendente(s)
            </p>
          </div>
        </div>
        <Button variant="outline" onClick={fetchAlertas} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      ) : alertasFiltrados.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <CheckCircle className="h-16 w-16 mx-auto mb-4 text-green-500" />
            <h3 className="text-xl font-medium">Tudo em dia!</h3>
            <p className="text-muted-foreground">
              Não há alertas pendentes no momento.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Vencidos */}
          {alertasVencidos.length > 0 && (
            <Card className="border-red-200 dark:border-red-800">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2 text-red-600">
                  <AlertTriangle className="h-5 w-5" />
                  Vencidos ({alertasVencidos.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {alertasVencidos.map(alerta => {
                  const style = getAlertaStyle(alerta.tipo);
                  return (
                    <div key={alerta.id} className={`p-4 rounded-lg border ${style.bg}`}>
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3">
                          {style.icon}
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-medium">{alerta.titulo}</span>
                              {style.badge}
                            </div>
                            <p className="text-sm text-muted-foreground">{alerta.mensagem}</p>
                            <p className="text-sm font-medium mt-1">{formatCurrency(alerta.valor)}</p>
                            {alerta.dataVencimento && (
                              <p className="text-xs text-muted-foreground mt-1">
                                Venceu em {format(new Date(alerta.dataVencimento), 'dd/MM/yyyy')}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {alerta.lancamento_id && (
                            <Button size="sm" onClick={() => marcarComoPago(alerta.lancamento_id!)}>
                              <CheckCircle className="h-4 w-4 mr-1" />
                              Pagar
                            </Button>
                          )}
                          <Button variant="ghost" size="icon" onClick={() => dismissAlerta(alerta.id)}>
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}

          {/* Vence Hoje */}
          {alertasHoje.length > 0 && (
            <Card className="border-orange-200 dark:border-orange-800">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2 text-orange-600">
                  <Clock className="h-5 w-5" />
                  Vence Hoje ({alertasHoje.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {alertasHoje.map(alerta => {
                  const style = getAlertaStyle(alerta.tipo);
                  return (
                    <div key={alerta.id} className={`p-4 rounded-lg border ${style.bg}`}>
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3">
                          {style.icon}
                          <div>
                            <span className="font-medium">{alerta.mensagem}</span>
                            <p className="text-sm font-medium mt-1">{formatCurrency(alerta.valor)}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {alerta.lancamento_id && (
                            <Button size="sm" onClick={() => marcarComoPago(alerta.lancamento_id!)}>
                              <CheckCircle className="h-4 w-4 mr-1" />
                              Pagar
                            </Button>
                          )}
                          <Button variant="ghost" size="icon" onClick={() => dismissAlerta(alerta.id)}>
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}

          {/* Saldo Baixo */}
          {alertasSaldo.length > 0 && (
            <Card className="border-yellow-200 dark:border-yellow-800">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2 text-yellow-600">
                  <AlertTriangle className="h-5 w-5" />
                  Saldo Baixo ({alertasSaldo.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {alertasSaldo.map(alerta => {
                  const style = getAlertaStyle(alerta.tipo);
                  return (
                    <div key={alerta.id} className={`p-4 rounded-lg border ${style.bg}`}>
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3">
                          {style.icon}
                          <div>
                            <span className="font-medium">{alerta.mensagem}</span>
                            <p className="text-sm font-medium mt-1">
                              Saldo atual: {formatCurrency(alerta.valor)}
                            </p>
                          </div>
                        </div>
                        <Button variant="ghost" size="icon" onClick={() => dismissAlerta(alerta.id)}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}

          {/* Alertas de Metas */}
          {alertasMetas.length > 0 && (
            <Card className="border-purple-200 dark:border-purple-800">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2 text-purple-600">
                  <Target className="h-5 w-5" />
                  Alertas de Metas ({alertasMetas.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {alertasMetas.map(alerta => {
                  const style = getAlertaStyle(alerta.tipo);
                  return (
                    <div key={alerta.id} className={`p-4 rounded-lg border ${style.bg}`}>
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3">
                          {style.icon}
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-medium">{alerta.titulo}</span>
                              {style.badge}
                            </div>
                            <p className="text-sm text-muted-foreground">{alerta.mensagem}</p>
                            {alerta.dataVencimento && (
                              <p className="text-xs text-muted-foreground mt-1">
                                {format(new Date(alerta.dataVencimento), 'dd/MM/yyyy')}
                              </p>
                            )}
                          </div>
                        </div>
                        <Button variant="ghost" size="icon" onClick={() => dismissAlerta(alerta.id)}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}

          {/* Alertas do Sistema */}
          {alertasSistema.length > 0 && (
            <Card className="border-green-200 dark:border-green-800">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2 text-green-600">
                  <Database className="h-5 w-5" />
                  Notificações do Sistema ({alertasSistema.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {alertasSistema.map(alerta => {
                  const style = getAlertaStyle(alerta.tipo);
                  return (
                    <div key={alerta.id} className={`p-4 rounded-lg border ${style.bg}`}>
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3">
                          {style.icon}
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-medium">{alerta.titulo}</span>
                              {style.badge}
                            </div>
                            <p className="text-sm text-muted-foreground">{alerta.mensagem}</p>
                            {alerta.dataVencimento && (
                              <p className="text-xs text-muted-foreground mt-1">
                                {format(new Date(alerta.dataVencimento), 'dd/MM/yyyy')}
                              </p>
                            )}
                          </div>
                        </div>
                        <Button variant="ghost" size="icon" onClick={() => dismissAlerta(alerta.id)}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}

          {/* Próximos Vencimentos */}
          {alertasProximos.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Próximos Vencimentos ({alertasProximos.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {alertasProximos.map(alerta => {
                  const style = getAlertaStyle(alerta.tipo);
                  return (
                    <div key={alerta.id} className={`p-4 rounded-lg border ${style.bg}`}>
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3">
                          {style.icon}
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-medium">{alerta.mensagem}</span>
                              {style.badge}
                            </div>
                            <p className="text-sm font-medium">{formatCurrency(alerta.valor)}</p>
                            {alerta.dataVencimento && (
                              <p className="text-xs text-muted-foreground mt-1">
                                Vence em {format(new Date(alerta.dataVencimento), 'dd/MM/yyyy')}
                              </p>
                            )}
                          </div>
                        </div>
                        <Button variant="ghost" size="icon" onClick={() => dismissAlerta(alerta.id)}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
