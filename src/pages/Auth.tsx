import { useState, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Camera, Check, X } from 'lucide-react';
import logoEggNunes from '@/assets/logo-eggnunes.png';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

// Password validation requirements
const validatePassword = (password: string) => ({
  minLength: password.length >= 8,
  hasUppercase: /[A-Z]/.test(password),
  hasLowercase: /[a-z]/.test(password),
  hasNumber: /[0-9]/.test(password),
});

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [position, setPosition] = useState('');
  const [birthDate, setBirthDate] = useState<Date>();
  const [joinDate, setJoinDate] = useState<Date>();
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const passwordValidation = useMemo(() => validatePassword(password), [password]);
  const isPasswordValid = useMemo(() => 
    Object.values(passwordValidation).every(Boolean), 
    [passwordValidation]
  );

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
        // Validate password before signup
        if (!isPasswordValid) {
          toast({
            title: 'Senha inválida',
            description: 'A senha deve ter no mínimo 8 caracteres, incluindo maiúscula, minúscula e número.',
            variant: 'destructive',
          });
          setLoading(false);
          return;
        }
        
        let avatarUrl = '';

        const { error, data } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/`,
            data: {
              full_name: fullName,
              position: position,
              birth_date: birthDate ? format(birthDate, 'yyyy-MM-dd') : null,
            },
          },
        });

        if (error) throw error;

        // Após criar o usuário, fazer upload do avatar usando o id do usuário
        if (data.user && avatarFile) {
          const fileExt = avatarFile.name.split('.').pop();
          const fileName = `${data.user.id}/${Date.now()}.${fileExt}`;
          const { error: uploadError } = await supabase.storage
            .from('avatars')
            .upload(fileName, avatarFile, { upsert: true });

          if (!uploadError) {
            const { data: publicData } = supabase.storage.from('avatars').getPublicUrl(fileName);
            avatarUrl = publicData.publicUrl;
          }
        }

        // Atualizar profile com cargo, avatar, data de nascimento e data de ingresso
        if (data.user) {
          await supabase
            .from('profiles')
            .update({
              position: position as any,
              avatar_url: avatarUrl || null,
              birth_date: birthDate ? format(birthDate, 'yyyy-MM-dd') : null,
              join_date: joinDate ? format(joinDate, 'yyyy-MM-dd') : null,
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
    <div className="min-h-[100dvh] flex items-center justify-center bg-gradient-to-br from-background via-background to-muted/20 p-4 overflow-y-auto">
      <Card className="w-full max-w-md my-4">
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
                  <Label htmlFor="birthDate">Data de Nascimento</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !birthDate && "text-muted-foreground"
                        )}
                        disabled={loading}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {birthDate ? format(birthDate, "dd/MM/yyyy", { locale: ptBR }) : "Selecione sua data de nascimento"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={birthDate}
                        onSelect={setBirthDate}
                        initialFocus
                        disabled={(date) =>
                          date > new Date() || date < new Date("1900-01-01")
                        }
                        className="pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="joinDate">Data de Ingresso no Escritório</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !joinDate && "text-muted-foreground"
                        )}
                        disabled={loading}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {joinDate ? format(joinDate, "dd/MM/yyyy", { locale: ptBR }) : "Selecione a data de ingresso"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={joinDate}
                        onSelect={setJoinDate}
                        initialFocus
                        disabled={(date) =>
                          date > new Date() || date < new Date("1900-01-01")
                        }
                        className="pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
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
                minLength={8}
              />
              {!isLogin && password.length > 0 && (
                <div className="text-xs space-y-1 mt-2 p-2 rounded-md bg-muted/50">
                  <p className="font-medium text-muted-foreground mb-1">Requisitos da senha:</p>
                  <div className="flex items-center gap-1.5">
                    {passwordValidation.minLength ? (
                      <Check className="h-3 w-3 text-green-500" />
                    ) : (
                      <X className="h-3 w-3 text-destructive" />
                    )}
                    <span className={passwordValidation.minLength ? 'text-green-600' : 'text-muted-foreground'}>
                      Mínimo 8 caracteres
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {passwordValidation.hasUppercase ? (
                      <Check className="h-3 w-3 text-green-500" />
                    ) : (
                      <X className="h-3 w-3 text-destructive" />
                    )}
                    <span className={passwordValidation.hasUppercase ? 'text-green-600' : 'text-muted-foreground'}>
                      Uma letra maiúscula
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {passwordValidation.hasLowercase ? (
                      <Check className="h-3 w-3 text-green-500" />
                    ) : (
                      <X className="h-3 w-3 text-destructive" />
                    )}
                    <span className={passwordValidation.hasLowercase ? 'text-green-600' : 'text-muted-foreground'}>
                      Uma letra minúscula
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {passwordValidation.hasNumber ? (
                      <Check className="h-3 w-3 text-green-500" />
                    ) : (
                      <X className="h-3 w-3 text-destructive" />
                    )}
                    <span className={passwordValidation.hasNumber ? 'text-green-600' : 'text-muted-foreground'}>
                      Um número
                    </span>
                  </div>
                </div>
              )}
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Processando...' : isLogin ? 'Entrar' : 'Cadastrar'}
            </Button>
          </form>
          <div className="mt-4 text-center space-y-1">
            {isLogin && (
              <Button
                variant="link"
                onClick={async () => {
                  if (!email) {
                    toast({ title: 'Informe o e-mail', description: 'Digite seu e-mail no campo acima para receber o link de redefinição.', variant: 'destructive' });
                    return;
                  }
                  try {
                    const { error } = await supabase.auth.resetPasswordForEmail(email, {
                      redirectTo: `${window.location.origin}/reset-password`,
                    });
                    if (error) throw error;
                    toast({ title: 'E-mail enviado!', description: 'Verifique sua caixa de entrada para redefinir sua senha.' });
                  } catch (error: any) {
                    toast({ title: 'Erro', description: error.message, variant: 'destructive' });
                  }
                }}
                disabled={loading}
                className="text-muted-foreground"
              >
                Esqueceu a senha?
              </Button>
            )}
            <div>
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
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
