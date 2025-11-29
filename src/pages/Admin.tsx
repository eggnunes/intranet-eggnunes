import { useEffect, useState } from 'react';
import { Layout } from '@/components/Layout';
import { useUserRole } from '@/hooks/useUserRole';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Check, X, Shield, UserPlus, History } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface PendingUser {
  id: string;
  email: string;
  full_name: string;
  created_at: string;
}

interface AdminUser {
  id: string;
  email: string;
  full_name: string;
}

interface UsageHistoryItem {
  id: string;
  user_id: string;
  tool_name: string;
  action: string;
  metadata: any;
  created_at: string;
  profiles: {
    email: string;
    full_name: string;
  };
}

export default function Admin() {
  const { isAdmin, loading } = useUserRole();
  const [pendingUsers, setPendingUsers] = useState<PendingUser[]>([]);
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
  const [usageHistory, setUsageHistory] = useState<UsageHistoryItem[]>([]);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !isAdmin) {
      navigate('/dashboard');
    }
  }, [isAdmin, loading, navigate]);

  useEffect(() => {
    if (isAdmin) {
      fetchPendingUsers();
      fetchAdminUsers();
      fetchUsageHistory();
    }
  }, [isAdmin]);

  const fetchPendingUsers = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('approval_status', 'pending')
      .order('created_at', { ascending: false });
    setPendingUsers(data || []);
  };

  const fetchAdminUsers = async () => {
    const { data } = await supabase
      .from('user_roles')
      .select(`
        user_id,
        profiles (
          id,
          email,
          full_name
        )
      `)
      .eq('role', 'admin');

    const admins = data?.map((item: any) => ({
      id: item.profiles.id,
      email: item.profiles.email,
      full_name: item.profiles.full_name,
    })) || [];
    
    setAdminUsers(admins);
  };

  const fetchUsageHistory = async () => {
    const { data: historyData } = await supabase
      .from('usage_history')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);

    if (!historyData) {
      setUsageHistory([]);
      return;
    }

    // Buscar perfis dos usuários
    const userIds = [...new Set(historyData.map(item => item.user_id))];
    const { data: profilesData } = await supabase
      .from('profiles')
      .select('id, email, full_name')
      .in('id', userIds);

    const profilesMap = new Map(profilesData?.map(p => [p.id, p]) || []);

    const enrichedHistory = historyData.map(item => ({
      ...item,
      profiles: profilesMap.get(item.user_id) || { email: 'Desconhecido', full_name: 'Desconhecido' }
    }));
    
    setUsageHistory(enrichedHistory);
  };

  const handleApprove = async (userId: string) => {
    const { error } = await supabase
      .from('profiles')
      .update({
        approval_status: 'approved',
        approved_at: new Date().toISOString(),
      })
      .eq('id', userId);

    if (error) {
      toast({
        title: 'Erro',
        description: 'Erro ao aprovar usuário',
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Usuário aprovado',
        description: 'O usuário já pode acessar o sistema',
      });
      fetchPendingUsers();
    }
  };

  const handleReject = async (userId: string) => {
    const { error } = await supabase
      .from('profiles')
      .update({
        approval_status: 'rejected',
      })
      .eq('id', userId);

    if (error) {
      toast({
        title: 'Erro',
        description: 'Erro ao rejeitar usuário',
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Usuário rejeitado',
        description: 'O acesso foi negado',
      });
      fetchPendingUsers();
    }
  };

  const handleMakeAdmin = async (userId: string) => {
    const { error } = await supabase
      .from('user_roles')
      .insert({
        user_id: userId,
        role: 'admin',
      });

    if (error) {
      toast({
        title: 'Erro',
        description: 'Erro ao promover usuário a admin',
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Admin adicionado',
        description: 'Usuário agora tem privilégios de administrador',
      });
      fetchAdminUsers();
    }
  };

  const handleRemoveAdmin = async (userId: string) => {
    const { error } = await supabase
      .from('user_roles')
      .delete()
      .eq('user_id', userId)
      .eq('role', 'admin');

    if (error) {
      toast({
        title: 'Erro',
        description: 'Erro ao remover admin',
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Admin removido',
        description: 'Privilégios de administrador removidos',
      });
      fetchAdminUsers();
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-muted-foreground">Carregando...</div>
        </div>
      </Layout>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <Layout>
      <div className="space-y-8">
        <div>
          <h1 className="text-4xl font-bold text-foreground mb-2">Painel Administrativo</h1>
          <p className="text-muted-foreground text-lg">
            Gerenciamento de usuários e histórico de uso
          </p>
        </div>

        <Tabs defaultValue="pending" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="pending" className="gap-2">
              <UserPlus className="w-4 h-4" />
              Aprovações
              {pendingUsers.length > 0 && (
                <Badge variant="destructive" className="ml-2">{pendingUsers.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="admins" className="gap-2">
              <Shield className="w-4 h-4" />
              Administradores
            </TabsTrigger>
            <TabsTrigger value="history" className="gap-2">
              <History className="w-4 h-4" />
              Histórico Geral
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pending">
            <Card>
              <CardHeader>
                <CardTitle>Usuários Pendentes de Aprovação</CardTitle>
                <CardDescription>
                  Revise e aprove ou rejeite novos cadastros
                </CardDescription>
              </CardHeader>
              <CardContent>
                {pendingUsers.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">
                    Nenhum usuário pendente de aprovação
                  </p>
                ) : (
                  <div className="space-y-4">
                    {pendingUsers.map((user) => (
                      <div
                        key={user.id}
                        className="flex items-center justify-between p-4 border border-border rounded-lg"
                      >
                        <div>
                          <p className="font-medium">{user.full_name}</p>
                          <p className="text-sm text-muted-foreground">{user.email}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Solicitado em {new Date(user.created_at).toLocaleDateString('pt-BR')}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="default"
                            onClick={() => handleApprove(user.id)}
                            className="gap-2"
                          >
                            <Check className="w-4 h-4" />
                            Aprovar
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleReject(user.id)}
                            className="gap-2"
                          >
                            <X className="w-4 h-4" />
                            Rejeitar
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="admins">
            <Card>
              <CardHeader>
                <CardTitle>Administradores do Sistema</CardTitle>
                <CardDescription>
                  Gerencie os usuários com privilégios administrativos
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {adminUsers.map((admin) => (
                    <div
                      key={admin.id}
                      className="flex items-center justify-between p-4 border border-border rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <Shield className="w-5 h-5 text-primary" />
                        <div>
                          <p className="font-medium">{admin.full_name}</p>
                          <p className="text-sm text-muted-foreground">{admin.email}</p>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleRemoveAdmin(admin.id)}
                      >
                        Remover Admin
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="history">
            <Card>
              <CardHeader>
                <CardTitle>Histórico de Uso Geral</CardTitle>
                <CardDescription>
                  Acompanhe o uso das ferramentas por todos os usuários
                </CardDescription>
              </CardHeader>
              <CardContent>
                {usageHistory.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">
                    Nenhum histórico de uso registrado
                  </p>
                ) : (
                  <div className="space-y-3">
                    {usageHistory.map((item) => (
                      <div
                        key={item.id}
                        className="p-4 border border-border rounded-lg"
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="font-medium">{item.profiles.full_name}</p>
                            <p className="text-sm text-muted-foreground">{item.profiles.email}</p>
                          </div>
                          <Badge variant="outline">{item.tool_name}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mt-2">
                          {item.action}
                        </p>
                        {item.metadata && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {item.metadata.fileCount && `${item.metadata.fileCount} arquivos`}
                            {item.metadata.documentCount && ` → ${item.metadata.documentCount} documentos`}
                            {item.metadata.processingTime && ` (${item.metadata.processingTime}s)`}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground mt-2">
                          {new Date(item.created_at).toLocaleString('pt-BR')}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
