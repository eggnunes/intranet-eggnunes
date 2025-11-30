import { ReactNode, useEffect, useState, useLayoutEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { Button } from '@/components/ui/button';
import { LogOut, Home, Shield, History, Lightbulb, BarChart3, MessageSquare, FileStack, Menu, X, Cake, Users, UserCircle, BookOpen, Megaphone, Camera, Briefcase, DollarSign, Bell, CheckSquare, ArrowLeft, ChevronDown, TrendingUp, ClipboardList, CalendarDays, ClipboardList as ClipboardIcon } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Drawer, DrawerContent, DrawerTrigger } from '@/components/ui/drawer';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { ScrollArea } from '@/components/ui/scroll-area';
import logoEggNunes from '@/assets/logo-eggnunes.png';

interface LayoutProps {
  children: ReactNode;
}

export const Layout = ({ children }: LayoutProps) => {
  const { signOut, user } = useAuth();
  const { isAdmin, profile } = useUserRole();
  const [pendingUsersCount, setPendingUsersCount] = useState(0);
  const [unreadAnnouncementsCount, setUnreadAnnouncementsCount] = useState(0);
  const [criticalTasksCount, setCriticalTasksCount] = useState(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const showBackButton = location.pathname !== '/dashboard' && location.pathname !== '/';
  
  // Restaurar posição do scroll ao voltar
  useLayoutEffect(() => {
    const scrollPosition = location.state?.scrollPosition;
    if (scrollPosition) {
      window.scrollTo(0, scrollPosition);
    }
  }, [location]);
  
  const handleBack = () => {
    navigate(-1);
  };

  useEffect(() => {
    if (user) {
      fetchUnreadAnnouncementsCount();
      fetchCriticalTasksCount();

      // Recarregar alertas a cada 5 minutos
      const taskInterval = setInterval(() => {
        fetchCriticalTasksCount();
      }, 5 * 60 * 1000);

      // Escutar mudanças em tempo real nos avisos
      const announcementsChannel = supabase
        .channel('announcements-changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'announcements',
          },
          () => {
            fetchUnreadAnnouncementsCount();
          }
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'announcement_reads',
          },
          () => {
            fetchUnreadAnnouncementsCount();
          }
        )
        .subscribe();

      if (isAdmin) {
        fetchPendingCount();

        // Escutar mudanças em tempo real
        const profilesChannel = supabase
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
          clearInterval(taskInterval);
          supabase.removeChannel(announcementsChannel);
          supabase.removeChannel(profilesChannel);
        };
      }

      return () => {
        clearInterval(taskInterval);
        supabase.removeChannel(announcementsChannel);
      };
    }
  }, [isAdmin, toast, user, profile?.full_name]);

  const fetchPendingCount = async () => {
    const { count } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('approval_status', 'pending');
    
    setPendingUsersCount(count || 0);
  };

  const fetchCriticalTasksCount = async () => {
    if (!user || !profile?.full_name) return;

    try {
      const { data, error } = await supabase.functions.invoke('advbox-integration/tasks', {
        body: { force_refresh: false },
      });

      if (error) throw error;

      let tasksData = [];
      if (data?.data && Array.isArray(data.data)) {
        tasksData = data.data;
      } else if (Array.isArray(data)) {
        tasksData = data;
      } else if (data && typeof data === 'object' && !Array.isArray(data)) {
        tasksData = data.tasks || data.items || [];
      }

      // Filtrar tarefas do usuário
      const currentName = profile.full_name.toLowerCase();
      const userTasks = tasksData.filter((task: any) => {
        const isPending = task.status?.toLowerCase() === 'pending' || task.status?.toLowerCase() === 'pendente';
        const isInProgress = task.status?.toLowerCase() === 'in_progress' || task.status?.toLowerCase() === 'em andamento';
        const isUserTask = task.assigned_to && task.assigned_to.toLowerCase().includes(currentName);
        return (isPending || isInProgress) && isUserTask && task.due_date;
      });

      // Contar tarefas atrasadas ou que vencem hoje
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const criticalTasks = userTasks.filter((task: any) => {
        try {
          const dueDate = new Date(task.due_date);
          dueDate.setHours(0, 0, 0, 0);
          return dueDate <= today;
        } catch (e) {
          return false;
        }
      });

      setCriticalTasksCount(criticalTasks.length);
    } catch (error) {
      console.error('Error fetching critical tasks:', error);
    }
  };

  const fetchUnreadAnnouncementsCount = async () => {
    if (!user) return;

    // Buscar todos os avisos
    const { data: announcements } = await supabase
      .from('announcements')
      .select('id');

    if (!announcements) return;

    // Buscar avisos lidos pelo usuário
    const { data: readAnnouncements } = await supabase
      .from('announcement_reads')
      .select('announcement_id')
      .eq('user_id', user.id);

    const readIds = new Set(readAnnouncements?.map(r => r.announcement_id) || []);
    const unreadCount = announcements.filter(a => !readIds.has(a.id)).length;

    setUnreadAnnouncementsCount(unreadCount);
  };

  const advboxMenuItems = [
    { icon: Briefcase, path: '/processos', label: 'Processos', description: 'Dashboard de processos' },
    { icon: Cake, path: '/aniversarios-clientes', label: 'Aniversários Clientes', description: 'Clientes aniversariantes' },
    { icon: Bell, path: '/publicacoes', label: 'Publicações', description: 'Feed de publicações' },
    { icon: CheckSquare, path: '/tarefas-advbox', label: 'Tarefas', description: 'Gestão de tarefas', badgeCount: criticalTasksCount },
    { icon: ClipboardList, path: '/relatorios-produtividade-tarefas', label: 'Produtividade', description: 'Relatórios de produtividade' },
    { icon: DollarSign, path: '/relatorios-financeiros', label: 'Financeiro', description: 'Relatórios financeiros' },
    { icon: TrendingUp, path: '/advbox-analytics', label: 'Analytics', description: 'Gráficos e métricas' },
  ];

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
        className="gap-2 justify-start relative"
      >
        <Megaphone className="w-4 h-4" />
        Mural de Avisos
        {unreadAnnouncementsCount > 0 && (
          <Badge variant="destructive" className="ml-2">{unreadAnnouncementsCount}</Badge>
        )}
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
        onClick={() => { navigate('/ferias'); setMobileMenuOpen(false); }}
        className="gap-2 justify-start"
      >
        <CalendarDays className="w-4 h-4" />
        Férias
      </Button>
      <Button 
        variant="ghost" 
        onClick={() => { navigate('/solicitacoes-administrativas'); setMobileMenuOpen(false); }}
        className="gap-2 justify-start"
      >
        <ClipboardIcon className="w-4 h-4" />
        Solicitações
      </Button>
      <Button 
        variant="ghost" 
        onClick={() => { navigate('/profile'); setMobileMenuOpen(false); }}
        className="gap-2 justify-start"
      >
        <UserCircle className="w-4 h-4" />
        Perfil
      </Button>
      <div className="px-2 py-2">
        <p className="text-xs font-semibold text-muted-foreground mb-2">ADVBOX</p>
        {advboxMenuItems.map((item) => (
          <Button 
            key={item.path}
            variant="ghost" 
            onClick={() => { navigate(item.path); setMobileMenuOpen(false); }}
            className="gap-2 justify-start w-full mb-1 relative"
          >
            <item.icon className="w-4 h-4" />
            {item.label}
            {item.badgeCount !== undefined && item.badgeCount > 0 && (
              <Badge variant="destructive" className="ml-auto">{item.badgeCount}</Badge>
            )}
          </Button>
        ))}
      </div>
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
      <Button 
        variant="ghost" 
        onClick={() => { navigate('/historico'); setMobileMenuOpen(false); }}
        className="gap-2 justify-start"
      >
        <History className="w-4 h-4" />
        Histórico
      </Button>
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
                <Button 
                  variant="ghost" 
                  onClick={() => navigate('/dashboard')}
                  className="gap-2"
                >
                  <Home className="w-4 h-4" />
                  Dashboard
                </Button>
                {isAdmin && (
                  <Button 
                    variant="ghost" 
                    onClick={() => navigate('/admin')}
                    className="gap-2 relative"
                  >
                    <Shield className="w-4 h-4" />
                    Admin
                    {pendingUsersCount > 0 && (
                      <Badge variant="destructive" className="ml-2">{pendingUsersCount}</Badge>
                    )}
                  </Button>
                )}
                
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="gap-2">
                      <Briefcase className="w-4 h-4" />
                      Advbox
                      <ChevronDown className="w-3 h-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-56 bg-card border-border z-50">
                    <DropdownMenuLabel>Integrações Advbox</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {advboxMenuItems.map((item) => (
                      <DropdownMenuItem 
                        key={item.path}
                        onClick={() => navigate(item.path)}
                        className="gap-2 cursor-pointer"
                      >
                        <item.icon className="w-4 h-4" />
                        <div className="flex flex-col">
                          <span className="font-medium">{item.label}</span>
                          <span className="text-xs text-muted-foreground">{item.description}</span>
                        </div>
                        {item.badgeCount !== undefined && item.badgeCount > 0 && (
                          <Badge variant="destructive" className="ml-auto">{item.badgeCount}</Badge>
                        )}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>

                <Button 
                  variant="ghost" 
                  onClick={() => navigate('/forum')}
                  className="gap-2"
                >
                  <MessageSquare className="w-4 h-4" />
                  Fórum
                </Button>
                <Button 
                  variant="ghost" 
                  onClick={() => navigate('/sugestoes')}
                  className="gap-2"
                >
                  <Lightbulb className="w-4 h-4" />
                  Sugestões
                </Button>
                <Button 
                  variant="ghost" 
                  onClick={() => navigate('/mural-avisos')}
                  className="gap-2 relative"
                >
                  <Megaphone className="w-4 h-4" />
                  Avisos
                  {unreadAnnouncementsCount > 0 && (
                    <Badge variant="destructive" className="ml-2">{unreadAnnouncementsCount}</Badge>
                  )}
                </Button>
                
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="gap-2">
                      <ClipboardIcon className="w-4 h-4" />
                      RH
                      <ChevronDown className="w-3 h-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-56 bg-card border-border z-50">
                    <DropdownMenuLabel>Recursos Humanos</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem 
                      onClick={() => navigate('/ferias')}
                      className="gap-2 cursor-pointer"
                    >
                      <CalendarDays className="w-4 h-4" />
                      <div className="flex flex-col">
                        <span className="font-medium">Férias</span>
                        <span className="text-xs text-muted-foreground">Gestão de férias</span>
                      </div>
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={() => navigate('/solicitacoes-administrativas')}
                      className="gap-2 cursor-pointer"
                    >
                      <ClipboardIcon className="w-4 h-4" />
                      <div className="flex flex-col">
                        <span className="font-medium">Solicitações</span>
                        <span className="text-xs text-muted-foreground">Pedidos administrativos</span>
                      </div>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                
                <Button 
                  variant="ghost" 
                  onClick={() => navigate('/historico')}
                  className="gap-2"
                >
                  <History className="w-4 h-4" />
                  Histórico
                </Button>
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
              <Drawer open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
                <DrawerTrigger asChild className="lg:hidden">
                  <Button variant="ghost" size="icon">
                    {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                  </Button>
                </DrawerTrigger>
                <DrawerContent className="h-[90vh] flex flex-col px-4">
                  <div className="flex items-center gap-3 py-4 border-b">
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
                  <ScrollArea className="flex-1 overflow-y-auto">
                    <div className="flex flex-col gap-4 mt-4">
                      <NavItems />
                      <Button variant="outline" onClick={signOut} className="gap-2 mt-4">
                        <LogOut className="w-4 h-4" />
                        Sair
                      </Button>
                    </div>
                  </ScrollArea>
                </DrawerContent>
              </Drawer>
            </div>
          </div>
        </div>
      </header>
      <main className="container mx-auto px-4 py-8">
        {showBackButton && (
          <Button
            variant="ghost"
            onClick={handleBack}
            className="gap-2 mb-4 hover:bg-primary/10"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar
          </Button>
        )}
        {children}
      </main>
    </div>
  );
};
