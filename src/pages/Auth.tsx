import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Camera } from 'lucide-react';
import logoEggNunes from '@/assets/logo-eggnunes.png';

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [position, setPosition] = useState('');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAvatarFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

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
        // Upload de avatar primeiro
        let avatarUrl = '';
        if (avatarFile) {
          const fileExt = avatarFile.name.split('.').pop();
          const fileName = `${Math.random()}.${fileExt}`;
          const { error: uploadError } = await supabase.storage
            .from('avatars')
            .upload(fileName, avatarFile);

          if (!uploadError) {
            const { data } = supabase.storage.from('avatars').getPublicUrl(fileName);
            avatarUrl = data.publicUrl;
          }
        }

        const { error, data } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/`,
            data: {
              full_name: fullName,
              position: position,
              avatar_url: avatarUrl,
            },
          },
        });

        if (error) throw error;

        // Atualizar profile com cargo e avatar
        if (data.user) {
          await supabase
            .from('profiles')
            .update({
              position: position as any,
              avatar_url: avatarUrl,
            })
            .eq('id', data.user.id);
        }

        toast({
          title: 'Cadastro realizado',
          description: 'Aguarde a aprovação do administrador para acessar o sistema.',
        });
        setIsLogin(true);
        setAvatarFile(null);
        setAvatarPreview('');
        setPosition('');
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
              <>
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
                <div className="space-y-2">
                  <Label htmlFor="position">Cargo no escritório</Label>
                  <Select value={position} onValueChange={setPosition} disabled={loading} required>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione seu cargo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="socio">Sócio</SelectItem>
                      <SelectItem value="advogado">Advogado</SelectItem>
                      <SelectItem value="estagiario">Estagiário</SelectItem>
                      <SelectItem value="comercial">Comercial</SelectItem>
                      <SelectItem value="administrativo">Administrativo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Foto de perfil</Label>
                  <div className="flex items-center gap-4">
                    {avatarPreview ? (
                      <img 
                        src={avatarPreview} 
                        alt="Preview" 
                        className="w-20 h-20 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center">
                        <Camera className="w-8 h-8 text-muted-foreground" />
                      </div>
                    )}
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={loading}
                    >
                      Escolher foto
                    </Button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleAvatarChange}
                    />
                  </div>
                </div>
              </>
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
