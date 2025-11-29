import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import logoEggNunes from '@/assets/logo-eggnunes.png';

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
        const { error, data } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;

        // Verificar se o usuário está aprovado
        const { data: profile } = await supabase
          .from('profiles')
          .select('approval_status')
          .eq('id', data.user.id)
          .single();

        if (profile?.approval_status === 'pending') {
          await supabase.auth.signOut();
          toast({
            title: 'Aguardando aprovação',
            description: 'Seu cadastro está pendente de aprovação por um administrador.',
            variant: 'destructive',
          });
          setLoading(false);
          return;
        }

        if (profile?.approval_status === 'rejected') {
          await supabase.auth.signOut();
          toast({
            title: 'Acesso negado',
            description: 'Seu cadastro foi rejeitado. Entre em contato com o administrador.',
            variant: 'destructive',
          });
          setLoading(false);
          return;
        }

        toast({
          title: 'Login realizado',
          description: 'Bem-vindo de volta!',
        });
        navigate('/dashboard');
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/`,
            data: {
              full_name: fullName,
            },
          },
        });

        if (error) throw error;

        toast({
          title: 'Cadastro realizado',
          description: 'Aguarde a aprovação do administrador para acessar o sistema.',
        });
        setIsLogin(true);
      }
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted/20 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-4">
          <img 
            src={logoEggNunes} 
            alt="Egg Nunes Advogados" 
            className="h-16 mx-auto"
          />
          <div>
            <CardTitle className="text-2xl">Intranet Egg Nunes</CardTitle>
            <CardDescription>
              Sistema interno de ferramentas para a equipe
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAuth} className="space-y-4">
            {!isLogin && (
              <div className="space-y-2">
                <Label htmlFor="fullName">Nome completo</Label>
                <Input
                  id="fullName"
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
                minLength={6}
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Processando...' : isLogin ? 'Entrar' : 'Cadastrar'}
            </Button>
          </form>
          <div className="mt-4 text-center">
            <Button
              variant="link"
              onClick={() => setIsLogin(!isLogin)}
              disabled={loading}
            >
              {isLogin
                ? 'Não tem conta? Cadastre-se'
                : 'Já tem conta? Faça login'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
