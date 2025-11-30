import { ReactNode, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { Button } from '@/components/ui/button';
import { LogOut, Home, Shield, History, Lightbulb, BarChart3, MessageSquare, FileStack, Menu, X, Cake, Users, UserCircle, BookOpen, Megaphone, Camera, Briefcase, DollarSign, Bell, CheckSquare } from 'lucide-react';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import logoEggNunes from '@/assets/logo-eggnunes.png';

interface LayoutProps {
  children: ReactNode;
}

export const Layout = ({ children }: LayoutProps) => {
  const { signOut, user } = useAuth();
  const { isAdmin, profile } = useUserRole();
  const [pendingUsersCount, setPendingUsersCount] = useState(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (isAdmin) {
      fetchPendingCount();

      // Escutar mudanças em tempo real
      const channel = supabase
        .channel('profile-changes')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'profiles',
            filter: 'approval_status=eq.pending',
          },
          (payload) => {
            setPendingUsersCount((prev) => prev + 1);
            toast({
              title: 'Novo usuário cadastrado',
              description: `${payload.new.full_name} aguarda aprovação`,
            });
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'profiles',
          },
          () => {
            fetchPendingCount();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [isAdmin, toast]);

  const fetchPendingCount = async () => {
    const { count } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('approval_status', 'pending');
    
    setPendingUsersCount(count || 0);
  };

  const NavItems = () => (
    <>
      <Button 
        variant="ghost" 
        onClick={() => { navigate('/dashboard'); setMobileMenuOpen(false); }}
        className="gap-2 justify-start"
      >
        <Home className="w-4 h-4" />
        Dashboard
      </Button>
      {isAdmin && (
        <Button 
          variant="ghost" 
          onClick={() => { navigate('/admin'); setMobileMenuOpen(false); }}
          className="gap-2 justify-start relative"
        >
          <Shield className="w-4 h-4" />
          Admin
          {pendingUsersCount > 0 && (
            <Badge variant="destructive" className="ml-2">{pendingUsersCount}</Badge>
          )}
        </Button>
      )}
      <Button 
        variant="ghost" 
        onClick={() => { navigate('/historico'); setMobileMenuOpen(false); }}
        className="gap-2 justify-start"
      >
        <History className="w-4 h-4" />
        Histórico
      </Button>
      <Button 
        variant="ghost" 
        onClick={() => { navigate('/forum'); setMobileMenuOpen(false); }}
        className="gap-2 justify-start"
      >
        <MessageSquare className="w-4 h-4" />
        Fórum
      </Button>
      <Button 
        variant="ghost" 
        onClick={() => { navigate('/documentos-uteis'); setMobileMenuOpen(false); }}
        className="gap-2 justify-start"
      >
        <FileStack className="w-4 h-4" />
        Documentos
      </Button>
      <Button 
        variant="ghost" 
        onClick={() => { navigate('/sugestoes'); setMobileMenuOpen(false); }}
        className="gap-2 justify-start"
      >
        <Lightbulb className="w-4 h-4" />
        Sugestões
      </Button>
      <Button 
        variant="ghost" 
        onClick={() => { navigate('/aniversarios'); setMobileMenuOpen(false); }}
        className="gap-2 justify-start"
      >
        <Cake className="w-4 h-4" />
        Aniversários
      </Button>
      <Button 
        variant="ghost" 
        onClick={() => { navigate('/equipe'); setMobileMenuOpen(false); }}
        className="gap-2 justify-start"
      >
        <Users className="w-4 h-4" />
        Equipe
      </Button>
      <Button 
        variant="ghost" 
        onClick={() => { navigate('/onboarding'); setMobileMenuOpen(false); }}
        className="gap-2 justify-start"
      >
        <BookOpen className="w-4 h-4" />
        Onboarding
      </Button>
      <Button 
        variant="ghost" 
        onClick={() => { navigate('/mural-avisos'); setMobileMenuOpen(false); }}
        className="gap-2 justify-start"
      >
        <Megaphone className="w-4 h-4" />
        Mural de Avisos
      </Button>
      <Button 
        variant="ghost" 
        onClick={() => { navigate('/galeria-eventos'); setMobileMenuOpen(false); }}
        className="gap-2 justify-start"
      >
        <Camera className="w-4 h-4" />
        Galeria de Eventos
      </Button>
      <Button 
        variant="ghost" 
        onClick={() => { navigate('/profile'); setMobileMenuOpen(false); }}
        className="gap-2 justify-start"
      >
        <UserCircle className="w-4 h-4" />
        Perfil
      </Button>
      <Button 
        variant="ghost" 
        onClick={() => { navigate('/processos'); setMobileMenuOpen(false); }}
        className="gap-2 justify-start"
      >
        <Briefcase className="w-4 h-4" />
        Processos
      </Button>
      <Button 
        variant="ghost" 
        onClick={() => { navigate('/aniversarios-clientes'); setMobileMenuOpen(false); }}
        className="gap-2 justify-start"
      >
        <Cake className="w-4 h-4" />
        Aniversários Clientes
      </Button>
      <Button 
        variant="ghost" 
        onClick={() => { navigate('/publicacoes'); setMobileMenuOpen(false); }}
        className="gap-2 justify-start"
      >
        <Bell className="w-4 h-4" />
        Publicações
      </Button>
      <Button 
        variant="ghost" 
        onClick={() => { navigate('/tarefas-advbox'); setMobileMenuOpen(false); }}
        className="gap-2 justify-start"
      >
        <CheckSquare className="w-4 h-4" />
        Tarefas
      </Button>
      <Button 
        variant="ghost" 
        onClick={() => { navigate('/relatorios-financeiros'); setMobileMenuOpen(false); }}
        className="gap-2 justify-start"
      >
        <DollarSign className="w-4 h-4" />
        Relatórios
      </Button>
      {isAdmin && (
        <Button 
          variant="ghost" 
          onClick={() => { navigate('/dashboard-sugestoes'); setMobileMenuOpen(false); }}
          className="gap-2 justify-start"
        >
          <BarChart3 className="w-4 h-4" />
          Estatísticas
        </Button>
      )}
    </>
  );

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card sticky top-0 z-50 backdrop-blur-sm bg-card/95">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-20">
            <div className="flex items-center gap-8">
              <img 
                src={logoEggNunes} 
                alt="Egg Nunes Advogados" 
                className="h-12 cursor-pointer"
                onClick={() => navigate('/dashboard')}
              />
              <nav className="hidden lg:flex items-center gap-2">
                <NavItems />
              </nav>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-sm text-muted-foreground hidden md:flex items-center gap-2">
                {profile?.avatar_url && (
                  <img 
                    src={profile.avatar_url} 
                    alt={profile.full_name}
                    className="w-8 h-8 rounded-full object-cover"
                  />
                )}
                <span className="hidden xl:inline">{user?.email}</span>
              </div>
              <Button variant="outline" onClick={signOut} className="gap-2 hidden md:flex">
                <LogOut className="w-4 h-4" />
                Sair
              </Button>
              
              {/* Mobile Menu */}
              <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
                <SheetTrigger asChild className="lg:hidden">
                  <Button variant="ghost" size="icon">
                    {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-[300px]">
                  <div className="flex flex-col gap-4 mt-8">
                    <div className="flex items-center gap-3 pb-4 border-b">
                      {profile?.avatar_url && (
                        <img 
                          src={profile.avatar_url} 
                          alt={profile.full_name}
                          className="w-12 h-12 rounded-full object-cover"
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{profile?.full_name}</p>
                        <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
                      </div>
                    </div>
                    <NavItems />
                    <Button variant="outline" onClick={signOut} className="gap-2 mt-4">
                      <LogOut className="w-4 h-4" />
                      Sair
                    </Button>
                  </div>
                </SheetContent>
              </Sheet>
            </div>
          </div>
        </div>
      </header>
      <main className="container mx-auto px-4 py-8">
        {children}
      </main>
    </div>
  );
};
