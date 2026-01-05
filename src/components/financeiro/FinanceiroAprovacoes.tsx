import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { CheckCircle, XCircle, Clock, AlertTriangle, User, Calendar, DollarSign, MessageSquare } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export function FinanceiroAprovacoes() {
  const [selectedAprovacao, setSelectedAprovacao] = useState<any>(null);
  const [resposta, setResposta] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: user } = useQuery({
    queryKey: ['current-user'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      return user;
    },
  });

  const { data: aprovacoes, isLoading } = useQuery({
    queryKey: ['fin-aprovacoes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fin_aprovacoes')
        .select(`
          *,
          lancamento:fin_lancamentos(
            id, descricao, valor, tipo, data_vencimento,
            categoria:fin_categorias(nome, cor)
          )
        `)
        .order('solicitado_em', { ascending: false });
      
      if (error) throw error;
      return data;
    },
  });

  const { data: profiles } = useQuery({
    queryKey: ['profiles-basic'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email');
      
      if (error) throw error;
      return data;
    },
  });

  const respondeMutation = useMutation({
    mutationFn: async ({ id, status, resposta }: { id: string; status: 'aprovado' | 'rejeitado'; resposta: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Não autenticado');

      // Atualizar aprovação
      const { error: aprovacaoError } = await supabase
        .from('fin_aprovacoes')
        .update({
          status,
          resposta_aprovador: resposta,
          aprovador_id: user.id,
          respondido_em: new Date().toISOString(),
        })
        .eq('id', id);

      if (aprovacaoError) throw aprovacaoError;

      // Atualizar status do lançamento
      const aprovacao = aprovacoes?.find(a => a.id === id);
      if (aprovacao?.lancamento_id) {
        const { error: lancamentoError } = await supabase
          .from('fin_lancamentos')
          .update({ status_aprovacao: status })
          .eq('id', aprovacao.lancamento_id);

        if (lancamentoError) throw lancamentoError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fin-aprovacoes'] });
      queryClient.invalidateQueries({ queryKey: ['fin-lancamentos'] });
      toast.success('Resposta registrada com sucesso!');
      setDialogOpen(false);
      setResposta('');
      setSelectedAprovacao(null);
    },
    onError: () => {
      toast.error('Erro ao responder aprovação');
    },
  });

  const getProfileName = (userId: string) => {
    return profiles?.find(p => p.id === userId)?.full_name || 'Usuário';
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pendente':
        return <Badge variant="outline" className="bg-yellow-500/10 text-yellow-600"><Clock className="h-3 w-3 mr-1" />Pendente</Badge>;
      case 'aprovado':
        return <Badge variant="outline" className="bg-green-500/10 text-green-600"><CheckCircle className="h-3 w-3 mr-1" />Aprovado</Badge>;
      case 'rejeitado':
        return <Badge variant="outline" className="bg-red-500/10 text-red-600"><XCircle className="h-3 w-3 mr-1" />Rejeitado</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const pendentes = aprovacoes?.filter(a => a.status === 'pendente') || [];
  const respondidas = aprovacoes?.filter(a => a.status !== 'pendente') || [];
  const minhasSolicitacoes = aprovacoes?.filter(a => a.solicitante_id === user?.id) || [];

  const handleResponder = (aprovacao: any, status: 'aprovado' | 'rejeitado') => {
    respondeMutation.mutate({
      id: aprovacao.id,
      status,
      resposta,
    });
  };

  if (isLoading) {
    return <div className="flex items-center justify-center py-8">Carregando...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pendentes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{pendentes.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Aprovadas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {aprovacoes?.filter(a => a.status === 'aprovado').length || 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Rejeitadas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {aprovacoes?.filter(a => a.status === 'rejeitado').length || 0}
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="pendentes" className="space-y-4">
        <TabsList>
          <TabsTrigger value="pendentes">
            Pendentes ({pendentes.length})
          </TabsTrigger>
          <TabsTrigger value="minhas">
            Minhas Solicitações ({minhasSolicitacoes.length})
          </TabsTrigger>
          <TabsTrigger value="historico">
            Histórico ({respondidas.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pendentes" className="space-y-4">
          {pendentes.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-500" />
                <p>Nenhuma aprovação pendente</p>
              </CardContent>
            </Card>
          ) : (
            pendentes.map((aprovacao) => (
              <Card key={aprovacao.id} className="border-l-4 border-l-yellow-500">
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between">
                    <div className="space-y-2 flex-1">
                      <div className="flex items-center gap-2">
                        {getStatusBadge(aprovacao.status)}
                        <Badge variant="outline" className="bg-red-500/10 text-red-600">
                          <DollarSign className="h-3 w-3 mr-1" />
                          {formatCurrency(aprovacao.lancamento?.valor || 0)}
                        </Badge>
                      </div>
                      <h4 className="font-medium">{aprovacao.lancamento?.descricao || 'Sem descrição'}</h4>
                      <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <User className="h-4 w-4" />
                          {getProfileName(aprovacao.solicitante_id)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="h-4 w-4" />
                          {format(new Date(aprovacao.solicitado_em), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                        </span>
                      </div>
                      {aprovacao.justificativa && (
                        <div className="mt-2 p-2 bg-muted rounded text-sm">
                          <strong>Justificativa:</strong> {aprovacao.justificativa}
                        </div>
                      )}
                    </div>
                    <Dialog open={dialogOpen && selectedAprovacao?.id === aprovacao.id} onOpenChange={(open) => {
                      setDialogOpen(open);
                      if (!open) {
                        setSelectedAprovacao(null);
                        setResposta('');
                      }
                    }}>
                      <div className="flex gap-2">
                        <DialogTrigger asChild>
                          <Button 
                            size="sm" 
                            variant="outline"
                            className="border-green-500 text-green-600 hover:bg-green-50"
                            onClick={() => setSelectedAprovacao(aprovacao)}
                          >
                            <CheckCircle className="h-4 w-4 mr-1" />
                            Aprovar
                          </Button>
                        </DialogTrigger>
                        <DialogTrigger asChild>
                          <Button 
                            size="sm" 
                            variant="outline"
                            className="border-red-500 text-red-600 hover:bg-red-50"
                            onClick={() => setSelectedAprovacao(aprovacao)}
                          >
                            <XCircle className="h-4 w-4 mr-1" />
                            Rejeitar
                          </Button>
                        </DialogTrigger>
                      </div>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Responder Solicitação</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div className="p-4 bg-muted rounded-lg">
                            <p className="font-medium">{selectedAprovacao?.lancamento?.descricao}</p>
                            <p className="text-lg font-bold text-primary mt-1">
                              {formatCurrency(selectedAprovacao?.lancamento?.valor || 0)}
                            </p>
                          </div>
                          <div className="space-y-2">
                            <label className="text-sm font-medium">Comentário (opcional)</label>
                            <Textarea
                              placeholder="Adicione um comentário..."
                              value={resposta}
                              onChange={(e) => setResposta(e.target.value)}
                            />
                          </div>
                        </div>
                        <DialogFooter>
                          <Button
                            variant="outline"
                            className="border-red-500 text-red-600"
                            onClick={() => handleResponder(selectedAprovacao, 'rejeitado')}
                            disabled={respondeMutation.isPending}
                          >
                            <XCircle className="h-4 w-4 mr-1" />
                            Rejeitar
                          </Button>
                          <Button
                            className="bg-green-600 hover:bg-green-700"
                            onClick={() => handleResponder(selectedAprovacao, 'aprovado')}
                            disabled={respondeMutation.isPending}
                          >
                            <CheckCircle className="h-4 w-4 mr-1" />
                            Aprovar
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="minhas" className="space-y-4">
          {minhasSolicitacoes.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                <MessageSquare className="h-12 w-12 mx-auto mb-4" />
                <p>Você não tem solicitações</p>
              </CardContent>
            </Card>
          ) : (
            minhasSolicitacoes.map((aprovacao) => (
              <Card key={aprovacao.id}>
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        {getStatusBadge(aprovacao.status)}
                        <Badge variant="outline">
                          {formatCurrency(aprovacao.lancamento?.valor || 0)}
                        </Badge>
                      </div>
                      <h4 className="font-medium">{aprovacao.lancamento?.descricao}</h4>
                      <p className="text-sm text-muted-foreground">
                        Solicitado em {format(new Date(aprovacao.solicitado_em), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                      </p>
                      {aprovacao.resposta_aprovador && (
                        <div className="mt-2 p-2 bg-muted rounded text-sm">
                          <strong>Resposta:</strong> {aprovacao.resposta_aprovador}
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="historico" className="space-y-4">
          {respondidas.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                <p>Nenhum histórico ainda</p>
              </CardContent>
            </Card>
          ) : (
            respondidas.map((aprovacao) => (
              <Card key={aprovacao.id}>
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        {getStatusBadge(aprovacao.status)}
                        <Badge variant="outline">
                          {formatCurrency(aprovacao.lancamento?.valor || 0)}
                        </Badge>
                      </div>
                      <h4 className="font-medium">{aprovacao.lancamento?.descricao}</h4>
                      <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                        <span>Solicitante: {getProfileName(aprovacao.solicitante_id)}</span>
                        {aprovacao.aprovador_id && (
                          <span>Aprovador: {getProfileName(aprovacao.aprovador_id)}</span>
                        )}
                      </div>
                      {aprovacao.resposta_aprovador && (
                        <div className="mt-2 p-2 bg-muted rounded text-sm">
                          <strong>Resposta:</strong> {aprovacao.resposta_aprovador}
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
