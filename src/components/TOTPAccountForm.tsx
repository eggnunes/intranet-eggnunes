import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { validateSecretKey, generateTOTP } from '@/lib/totp';
import { toast } from 'sonner';
import { Loader2, Eye, EyeOff } from 'lucide-react';

interface TOTPAccount {
  id: string;
  name: string;
  description: string | null;
  secret_key?: string; // Only available to admins
}

interface TOTPAccountFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: { name: string; description: string; secret_key: string }) => Promise<void>;
  editingAccount?: TOTPAccount | null;
}

export function TOTPAccountForm({ open, onOpenChange, onSubmit, editingAccount }: TOTPAccountFormProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [secretKey, setSecretKey] = useState('');
  const [showSecret, setShowSecret] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [testCode, setTestCode] = useState<string | null>(null);

  useEffect(() => {
    if (editingAccount) {
      setName(editingAccount.name);
      setDescription(editingAccount.description || '');
      setSecretKey(editingAccount.secret_key || '');
    } else {
      setName('');
      setDescription('');
      setSecretKey('');
    }
    setTestCode(null);
  }, [editingAccount, open]);

  const handleTestCode = async () => {
    const sanitized = secretKey.replace(/\s/g, '').toUpperCase();
    if (!validateSecretKey(sanitized)) {
      toast.error('Chave secreta inválida');
      return;
    }
    
    const code = await generateTOTP(sanitized);
    setTestCode(code);
    toast.success(`Código gerado: ${code}`);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) {
      toast.error('Nome é obrigatório');
      return;
    }

    const sanitized = secretKey.replace(/\s/g, '').toUpperCase();
    if (!validateSecretKey(sanitized)) {
      toast.error('Chave secreta inválida. Deve conter pelo menos 16 caracteres base32 (A-Z, 2-7)');
      return;
    }

    setIsLoading(true);
    try {
      await onSubmit({
        name: name.trim(),
        description: description.trim(),
        secret_key: sanitized,
      });
      onOpenChange(false);
    } catch (error) {
      console.error('Error saving TOTP account:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>
              {editingAccount ? 'Editar Conta TOTP' : 'Adicionar Conta TOTP'}
            </DialogTitle>
            <DialogDescription>
              {editingAccount
                ? 'Edite as informações da conta de autenticação.'
                : 'Adicione uma nova conta de autenticação de dois fatores.'}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Nome da conta *</Label>
              <Input
                id="name"
                placeholder="Ex: TRT15 - Tribunal"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="description">Descrição (opcional)</Label>
              <Textarea
                id="description"
                placeholder="Ex: Acesso ao sistema PJe do TRT15"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="secret">Chave secreta (Base32) *</Label>
              <div className="relative">
                <Input
                  id="secret"
                  type={showSecret ? 'text' : 'password'}
                  placeholder="JBSWY3DPEHPK3PXP"
                  value={secretKey}
                  onChange={(e) => {
                    setSecretKey(e.target.value);
                    setTestCode(null);
                  }}
                  className="pr-10 font-mono"
                  required
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full"
                  onClick={() => setShowSecret(!showSecret)}
                >
                  {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Cole a chave secreta exatamente como foi fornecida pelo Google Authenticator ou sistema.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" onClick={handleTestCode}>
                Testar código
              </Button>
              {testCode && (
                <span className="font-mono text-lg font-bold text-primary">
                  {testCode}
                </span>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingAccount ? 'Salvar' : 'Adicionar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
