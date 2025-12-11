import { useState, useEffect, useCallback } from 'react';
import { generateTOTP, getTimeRemaining } from '@/lib/totp';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Copy, Check, Eye, EyeOff, Trash2, Edit, Shield } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useUserRole } from '@/hooks/useUserRole';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface TOTPAccount {
  id: string;
  name: string;
  description: string | null;
  secret_key: string;
}

interface TOTPCodeDisplayProps {
  accounts: TOTPAccount[];
  onEdit: (account: TOTPAccount) => void;
  onDelete: (id: string) => void;
}

export function TOTPCodeDisplay({ accounts, onEdit, onDelete }: TOTPCodeDisplayProps) {
  const [codes, setCodes] = useState<Record<string, string>>({});
  const [timeRemaining, setTimeRemaining] = useState(30);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [visibleSecrets, setVisibleSecrets] = useState<Set<string>>(new Set());
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [accountToDelete, setAccountToDelete] = useState<string | null>(null);
  const { isAdmin } = useUserRole();

  const generateAllCodes = useCallback(async () => {
    const newCodes: Record<string, string> = {};
    for (const account of accounts) {
      newCodes[account.id] = await generateTOTP(account.secret_key);
    }
    setCodes(newCodes);
  }, [accounts]);

  useEffect(() => {
    generateAllCodes();

    const interval = setInterval(() => {
      const remaining = getTimeRemaining();
      setTimeRemaining(remaining);
      
      // Regenerate codes when timer resets
      if (remaining === 30) {
        generateAllCodes();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [generateAllCodes]);

  const copyToClipboard = async (code: string, id: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedId(id);
      toast.success('Código copiado!');
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      toast.error('Erro ao copiar código');
    }
  };

  const toggleSecretVisibility = (id: string) => {
    setVisibleSecrets(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const handleDeleteClick = (id: string) => {
    setAccountToDelete(id);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (accountToDelete) {
      onDelete(accountToDelete);
      setDeleteDialogOpen(false);
      setAccountToDelete(null);
    }
  };

  const progressValue = (timeRemaining / 30) * 100;

  if (accounts.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Shield className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground text-center">
            Nenhuma conta TOTP cadastrada.
            {isAdmin && ' Clique em "Adicionar Conta" para começar.'}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div className="mb-4">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-sm text-muted-foreground">
            Novo código em: {timeRemaining}s
          </span>
        </div>
        <Progress value={progressValue} className="h-2" />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {accounts.map((account) => (
          <Card key={account.id} className="relative overflow-hidden">
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between">
                <CardTitle className="text-lg">{account.name}</CardTitle>
                {isAdmin && (
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => onEdit(account)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive"
                      onClick={() => handleDeleteClick(account.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
              {account.description && (
                <p className="text-sm text-muted-foreground">{account.description}</p>
              )}
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="font-mono text-3xl font-bold tracking-widest text-primary">
                  {codes[account.id] || '------'}
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => copyToClipboard(codes[account.id] || '', account.id)}
                >
                  {copiedId === account.id ? (
                    <Check className="h-4 w-4 text-green-500" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>

              {isAdmin && (
                <div className="mt-4 pt-4 border-t">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Chave secreta:</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleSecretVisibility(account.id)}
                    >
                      {visibleSecrets.has(account.id) ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  <p className="font-mono text-xs break-all">
                    {visibleSecrets.has(account.id)
                      ? account.secret_key
                      : '•'.repeat(16)}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir esta conta TOTP? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
