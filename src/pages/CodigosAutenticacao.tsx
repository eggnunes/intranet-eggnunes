import { useState, useEffect } from 'react';
import { Layout } from '@/components/Layout';
import { TOTPCodeDisplay } from '@/components/TOTPCodeDisplay';
import { TOTPAccountForm } from '@/components/TOTPAccountForm';
import { QRCodeImporter } from '@/components/QRCodeImporter';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Shield, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useUserRole } from '@/hooks/useUserRole';
import { Skeleton } from '@/components/ui/skeleton';

interface TOTPAccount {
  id: string;
  name: string;
  description: string | null;
  secret_key?: string; // Only available to admins
}

export default function CodigosAutenticacao() {
  const [accounts, setAccounts] = useState<TOTPAccount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<TOTPAccount | null>(null);
  const { isAdmin } = useUserRole();

  const fetchAccounts = async () => {
    try {
      const { data, error } = await supabase
        .from('totp_accounts')
        .select('*')
        .order('name');

      if (error) throw error;
      setAccounts(data || []);
    } catch (error) {
      console.error('Error fetching TOTP accounts:', error);
      toast.error('Erro ao carregar contas');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAccounts();
  }, []);

  const handleSubmit = async (data: { name: string; description: string; secret_key: string }) => {
    try {
      if (editingAccount) {
        const { error } = await supabase
          .from('totp_accounts')
          .update({
            name: data.name,
            description: data.description || null,
            secret_key: data.secret_key,
          })
          .eq('id', editingAccount.id);

        if (error) throw error;
        toast.success('Conta atualizada com sucesso');
      } else {
        const { data: { user } } = await supabase.auth.getUser();
        
        const { error } = await supabase
          .from('totp_accounts')
          .insert({
            name: data.name,
            description: data.description || null,
            secret_key: data.secret_key,
            created_by: user?.id,
          });

        if (error) throw error;
        toast.success('Conta adicionada com sucesso');
      }

      setEditingAccount(null);
      fetchAccounts();
    } catch (error: any) {
      console.error('Error saving TOTP account:', error);
      toast.error(error.message || 'Erro ao salvar conta');
      throw error;
    }
  };

  const handleBatchImport = async (accountsToImport: { name: string; description: string; secret_key: string }[]) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const insertData = accountsToImport.map(acc => ({
        name: acc.name,
        description: acc.description || null,
        secret_key: acc.secret_key,
        created_by: user?.id,
      }));

      const { error } = await supabase
        .from('totp_accounts')
        .insert(insertData);

      if (error) throw error;
      
      toast.success(`${accountsToImport.length} conta(s) importada(s) com sucesso!`);
      fetchAccounts();
    } catch (error: any) {
      console.error('Error importing accounts:', error);
      toast.error(error.message || 'Erro ao importar contas');
      throw error;
    }
  };

  const handleEdit = (account: TOTPAccount) => {
    setEditingAccount(account);
    setFormOpen(true);
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from('totp_accounts')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('Conta excluída com sucesso');
      fetchAccounts();
    } catch (error: any) {
      console.error('Error deleting TOTP account:', error);
      toast.error(error.message || 'Erro ao excluir conta');
    }
  };

  const handleOpenForm = () => {
    setEditingAccount(null);
    setFormOpen(true);
  };

  return (
    <Layout>
      <div className="space-y-6 max-w-6xl mx-auto">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <Shield className="h-8 w-8 text-primary" />
              Códigos de Autenticação
            </h1>
            <p className="text-muted-foreground mt-2">
              Códigos TOTP para acesso a sistemas externos (tribunais, etc.)
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={fetchAccounts} disabled={isLoading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
            {isAdmin && (
              <Button onClick={handleOpenForm}>
                <Plus className="h-4 w-4 mr-2" />
                Adicionar Conta
              </Button>
            )}
          </div>
        </div>

        {isAdmin && (
          <QRCodeImporter 
            onImport={handleBatchImport}
            existingSecrets={accounts.map(a => a.secret_key)}
          />
        )}

        <Card>
          <CardHeader>
            <CardTitle>Como usar</CardTitle>
            <CardDescription>
              Os códigos são gerados automaticamente a cada 30 segundos. Clique no botão de copiar para usar o código no login.
            </CardDescription>
          </CardHeader>
        </Card>

        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Card key={i}>
                <CardHeader>
                  <Skeleton className="h-6 w-32" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-10 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <TOTPCodeDisplay
            accounts={accounts}
            onEdit={handleEdit}
            onDelete={handleDelete}
          />
        )}

        <TOTPAccountForm
          open={formOpen}
          onOpenChange={setFormOpen}
          onSubmit={handleSubmit}
          editingAccount={editingAccount}
        />
      </div>
    </Layout>
  );
}
