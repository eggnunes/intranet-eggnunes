import { ReactNode, useEffect, useState, useLayoutEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { Button } from '@/components/ui/button';
import { LogOut, Home as HomeIcon, Shield, History, Lightbulb, BarChart3, MessageSquare, FileStack, Menu, X, Cake, Users, UserCircle, BookOpen, Megaphone, Camera, Briefcase, DollarSign, Bell, CheckSquare, ArrowLeft, ChevronDown, TrendingUp, ClipboardList, CalendarDays, ClipboardList as ClipboardIcon, MessageCircle, Coffee, Home, UserPlus, DoorOpen, FileSignature, Link2, Target, Bot, Brain, Search as SearchIcon, Sparkles, Settings, FileText, KeyRound, HardDrive, Award } from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';
import { UpdatesNotification } from '@/components/UpdatesNotification';
import { NotificationsPanel } from '@/components/NotificationsPanel';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Drawer, DrawerContent, DrawerTrigger } from '@/components/ui/drawer';
import { Badge } from '@/components/ui/badge';
import { Command, CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
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
  const [unreadAnnouncementsCount, setUnreadAnnouncementsCount] = useState(0);
  const [criticalTasksCount, setCriticalTasksCount] = useState(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const showBackButton = location.pathname !== '/dashboard' && location.pathname !== '/';
  
  // Fix mobile scroll on route change and drawer close
  useLayoutEffect(() => {
    const enableScroll = () => {
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';
      document.body.style.touchAction = '';
      document.documentElement.style.overflow = '';
      // Force scroll to be enabled
      document.body.style.overflowY = 'scroll';
    };
    
    enableScroll();
    
    // Run again after a short delay to counter any drawer effects
    const timeout = setTimeout(enableScroll, 100);
    
    return () => clearTimeout(timeout);
  }, [location.pathname, mobileMenuOpen]);
  
  const handleBack = () => {
    navigate(-1);
  };

  // Keyboard shortcut for search
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setSearchOpen((open) => !open);
      }
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

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

  // Menu items organized by category
  const advboxMenuItems = [
    { icon: Briefcase, path: '/processos', label: 'Processos', description: 'Dashboard de processos' },
    { icon: Cake, path: '/aniversarios-clientes', label: 'Aniversários Clientes', description: 'Clientes aniversariantes' },
    { icon: MessageCircle, path: '/historico-mensagens-aniversario', label: 'Histórico Mensagens', description: 'Mensagens de aniversário enviadas' },
    { icon: Bell, path: '/publicacoes', label: 'Publicações', description: 'Feed de publicações' },
    { icon: CheckSquare, path: '/tarefas-advbox', label: 'Tarefas', description: 'Gestão de tarefas', badgeCount: criticalTasksCount },
    { icon: ClipboardList, path: '/relatorios-produtividade-tarefas', label: 'Produtividade', description: 'Relatórios de produtividade' },
    { icon: DollarSign, path: '/relatorios-financeiros', label: 'Financeiro', description: 'Relatórios financeiros' },
    { icon: TrendingUp, path: '/advbox-analytics', label: 'Analytics', description: 'Gráficos e métricas' },
  ];

  const rhMenuItems = [
    { icon: Cake, path: '/aniversarios', label: 'Aniversários', description: 'Aniversários da equipe' },
    { icon: Users, path: '/equipe', label: 'Equipe', description: 'Membros da equipe' },
    { icon: CalendarDays, path: '/ferias', label: 'Férias', description: 'Gestão de férias' },
    { icon: Home, path: '/home-office', label: 'Home Office', description: 'Escala de home office' },
    { icon: UserPlus, path: '/contratacao', label: 'Contratação', description: 'Gestão de currículos' },
    { icon: BookOpen, path: '/onboarding', label: 'Onboarding', description: 'Materiais de integração' },
  ];

  const iaMenuItems = [
    { icon: Bot, path: '/assistente-ia', label: 'Assistente IA', description: 'Chat com inteligência artificial' },
    { icon: Sparkles, path: '/agentes-ia', label: 'Agentes de IA', description: 'Agentes especializados' },
    { icon: SearchIcon, path: '/pesquisa-jurisprudencia', label: 'Pesquisa Jurisprudência', description: 'Busca em jurisprudência' },
    { icon: FileText, path: '/tools/rotadoc', label: 'RotaDoc', description: 'Organização de documentos' },
  ];

  const comunicacaoMenuItems = [
    { icon: MessageCircle, path: '/mensagens', label: 'Mensagens', description: 'Chat com a equipe' },
    { icon: Megaphone, path: '/mural-avisos', label: 'Mural de Avisos', description: 'Comunicados e eventos' },
    { icon: Bell, path: '/notificacoes', label: 'Notificações', description: 'Suas notificações' },
    { icon: MessageSquare, path: '/forum', label: 'Fórum', description: 'Discussões da equipe' },
    { icon: Lightbulb, path: '/sugestoes', label: 'Sugestões', description: 'Envie suas ideias' },
  ];

  const escritorioMenuItems = [
    { icon: Award, path: '/decisoes-favoraveis', label: 'Decisões Favoráveis', description: 'Decisões favoráveis do escritório' },
    { icon: Coffee, path: '/copa-cozinha', label: 'Copa/Cozinha', description: 'Sugestões de alimentos' },
    { icon: DoorOpen, path: '/sala-reuniao', label: 'Sala de Reunião', description: 'Reservar sala' },
    { icon: KeyRound, path: '/codigos-autenticacao', label: 'Códigos TOTP', description: 'Autenticação de tribunais' },
    { icon: HardDrive, path: '/arquivos-teams', label: 'Arquivos Teams', description: 'Arquivos do Microsoft Teams' },
    { icon: FileStack, path: '/documentos-uteis', label: 'Documentos', description: 'Documentos úteis' },
    { icon: ClipboardIcon, path: '/solicitacoes-administrativas', label: 'Solicitações', description: 'Pedidos administrativos' },
    { icon: Camera, path: '/galeria-eventos', label: 'Galeria de Eventos', description: 'Fotos dos eventos' },
  ];

  const minhaContaMenuItems = [
    { icon: UserCircle, path: '/profile', label: 'Perfil', description: 'Editar perfil' },
    { icon: History, path: '/historico', label: 'Histórico', description: 'Histórico de uso' },
  ];

  const configuracoesMenuItems = [
    ...(isAdmin ? [{ icon: Shield, path: '/admin', label: 'Admin', description: 'Painel administrativo', badgeCount: pendingUsersCount }] : []),
    ...(isAdmin ? [{ icon: Target, path: '/lead-tracking', label: 'Tracking de Leads', description: 'UTMs e formulários' }] : []),
    ...(isAdmin ? [{ icon: Link2, path: '/integracoes', label: 'Integrações', description: 'Webhooks e integrações' }] : []),
    ...(isAdmin ? [{ icon: BarChart3, path: '/dashboard-sugestoes', label: 'Estatísticas', description: 'Dashboard de sugestões' }] : []),
  ];

  // All searchable items for global search
  const allSearchableItems = [
    { icon: HomeIcon, path: '/dashboard', label: 'Dashboard', description: 'Página inicial', category: 'Geral' },
    { icon: FileSignature, path: '/setor-comercial', label: 'Setor Comercial', description: 'Geração de contratos', category: 'Geral' },
    { icon: Users, path: '/crm', label: 'CRM', description: 'Gestão de leads e oportunidades', category: 'Geral' },
    ...advboxMenuItems.map(item => ({ ...item, category: 'Advbox' })),
    ...rhMenuItems.map(item => ({ ...item, category: 'RH' })),
    ...iaMenuItems.map(item => ({ ...item, category: 'Inteligência Artificial' })),
    ...comunicacaoMenuItems.map(item => ({ ...item, category: 'Comunicação' })),
    ...escritorioMenuItems.map(item => ({ ...item, category: 'Escritório' })),
    ...minhaContaMenuItems.map(item => ({ ...item, category: 'Minha Conta' })),
    ...configuracoesMenuItems.map(item => ({ ...item, category: 'Configurações' })),
  ];

  const handleSearchSelect = (path: string) => {
    setSearchOpen(false);
    navigate(path);
  };

  const NavItems = () => (
    <>
      <Button 
        variant="ghost" 
        onClick={() => { navigate('/dashboard'); setMobileMenuOpen(false); }}
        className="gap-2 justify-start"
      >
        <HomeIcon className="w-4 h-4" />
        Dashboard
      </Button>
      <div className="px-2 py-2">
        <p className="text-xs font-semibold text-muted-foreground mb-2">COMERCIAL</p>
        <Button 
          variant="ghost" 
          onClick={() => { navigate('/setor-comercial'); setMobileMenuOpen(false); }}
          className="gap-2 justify-start w-full mb-1"
        >
          <FileSignature className="w-4 h-4" />
          Contratos
        </Button>
        <Button 
          variant="ghost" 
          onClick={() => { navigate('/crm'); setMobileMenuOpen(false); }}
          className="gap-2 justify-start w-full mb-1"
        >
          <Users className="w-4 h-4" />
          CRM
        </Button>
      </div>
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
      <div className="px-2 py-2">
        <p className="text-xs font-semibold text-muted-foreground mb-2">RH</p>
        {rhMenuItems.map((item) => (
          <Button 
            key={item.path}
            variant="ghost" 
            onClick={() => { navigate(item.path); setMobileMenuOpen(false); }}
            className="gap-2 justify-start w-full mb-1"
          >
            <item.icon className="w-4 h-4" />
            {item.label}
          </Button>
        ))}
      </div>
      <div className="px-2 py-2">
        <p className="text-xs font-semibold text-muted-foreground mb-2">INTELIGÊNCIA ARTIFICIAL</p>
        {iaMenuItems.map((item) => (
          <Button 
            key={item.path}
            variant="ghost" 
            onClick={() => { navigate(item.path); setMobileMenuOpen(false); }}
            className="gap-2 justify-start w-full mb-1"
          >
            <item.icon className="w-4 h-4" />
            {item.label}
          </Button>
        ))}
      </div>
      <div className="px-2 py-2">
        <p className="text-xs font-semibold text-muted-foreground mb-2">COMUNICAÇÃO</p>
        {comunicacaoMenuItems.map((item) => (
          <Button 
            key={item.path}
            variant="ghost" 
            onClick={() => { navigate(item.path); setMobileMenuOpen(false); }}
            className="gap-2 justify-start w-full mb-1"
          >
            <item.icon className="w-4 h-4" />
            {item.label}
          </Button>
        ))}
      </div>
      <div className="px-2 py-2">
        <p className="text-xs font-semibold text-muted-foreground mb-2">ESCRITÓRIO</p>
        {escritorioMenuItems.map((item) => (
          <Button 
            key={item.path}
            variant="ghost" 
            onClick={() => { navigate(item.path); setMobileMenuOpen(false); }}
            className="gap-2 justify-start w-full mb-1"
          >
            <item.icon className="w-4 h-4" />
            {item.label}
          </Button>
        ))}
      </div>
      <div className="px-2 py-2">
        <p className="text-xs font-semibold text-muted-foreground mb-2">MINHA CONTA</p>
        {minhaContaMenuItems.map((item) => (
          <Button 
            key={item.path}
            variant="ghost" 
            onClick={() => { navigate(item.path); setMobileMenuOpen(false); }}
            className="gap-2 justify-start w-full mb-1"
          >
            <item.icon className="w-4 h-4" />
            {item.label}
          </Button>
        ))}
      </div>
      {configuracoesMenuItems.length > 0 && (
        <div className="px-2 py-2">
          <p className="text-xs font-semibold text-muted-foreground mb-2">CONFIGURAÇÕES</p>
          {configuracoesMenuItems.map((item) => (
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
      )}
    </>
  );

  return (
    <div className="min-h-[100dvh] bg-background">
      {/* Global Search Dialog */}
      <CommandDialog open={searchOpen} onOpenChange={setSearchOpen}>
        <CommandInput placeholder="Buscar na intranet... (Ctrl+K)" />
        <CommandList>
          <CommandEmpty>Nenhum resultado encontrado.</CommandEmpty>
          {['Geral', 'Advbox', 'RH', 'Inteligência Artificial', 'Comunicação', 'Escritório', 'Minha Conta', 'Configurações'].map((category) => {
            const items = allSearchableItems.filter(item => item.category === category);
            if (items.length === 0) return null;
            return (
              <CommandGroup key={category} heading={category}>
                {items.map((item) => (
                  <CommandItem
                    key={item.path}
                    onSelect={() => handleSearchSelect(item.path)}
                    className="gap-2 cursor-pointer"
                  >
                    <item.icon className="w-4 h-4" />
                    <span>{item.label}</span>
                    <span className="text-xs text-muted-foreground ml-auto">{item.description}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            );
          })}
        </CommandList>
      </CommandDialog>

      <header className="border-b border-border bg-card sticky top-0 z-50 backdrop-blur-sm bg-card/95">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-20">
            <div className="flex items-center gap-4">
              <img 
                src={logoEggNunes} 
                alt="Egg Nunes Advogados" 
                className="h-12 cursor-pointer"
                onClick={() => navigate('/dashboard')}
              />
              <nav className="hidden lg:flex items-center gap-1">
                <Button 
                  variant="ghost" 
                  onClick={() => navigate('/dashboard')}
                  className="gap-1.5"
                  size="sm"
                >
                  <HomeIcon className="w-4 h-4" />
                  Dashboard
                </Button>
                
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="gap-1" size="sm">
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

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="gap-1" size="sm">
                      <FileSignature className="w-4 h-4" />
                      Comercial
                      <ChevronDown className="w-3 h-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-56 bg-card border-border z-50">
                    <DropdownMenuLabel>Setor Comercial</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem 
                      onClick={() => navigate('/setor-comercial')}
                      className="gap-2 cursor-pointer"
                    >
                      <FileSignature className="w-4 h-4" />
                      <div className="flex flex-col">
                        <span className="font-medium">Contratos</span>
                        <span className="text-xs text-muted-foreground">Geração de contratos</span>
                      </div>
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={() => navigate('/crm')}
                      className="gap-2 cursor-pointer"
                    >
                      <Users className="w-4 h-4" />
                      <div className="flex flex-col">
                        <span className="font-medium">CRM</span>
                        <span className="text-xs text-muted-foreground">Leads e oportunidades</span>
                      </div>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="gap-1" size="sm">
                      <Users className="w-4 h-4" />
                      RH
                      <ChevronDown className="w-3 h-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-56 bg-card border-border z-50">
                    <DropdownMenuLabel>Recursos Humanos</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {rhMenuItems.map((item) => (
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
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* Menu "Mais" com IA, Comunicação, Escritório, Conta, Configurações */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="gap-1 relative" size="sm">
                      <ChevronDown className="w-4 h-4" />
                      Mais
                      {pendingUsersCount > 0 && (
                        <Badge variant="destructive" className="absolute -top-1 -right-1 h-4 w-4 p-0 flex items-center justify-center text-[10px]">{pendingUsersCount}</Badge>
                      )}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-64 bg-card border-border z-50 max-h-[calc(100vh-100px)] overflow-y-auto">
                    {/* IA */}
                    <DropdownMenuLabel className="flex items-center gap-2">
                      <Brain className="w-4 h-4" />
                      Inteligência Artificial
                    </DropdownMenuLabel>
                    {iaMenuItems.map((item) => (
                      <DropdownMenuItem 
                        key={item.path}
                        onClick={() => navigate(item.path)}
                        className="gap-2 cursor-pointer pl-6"
                      >
                        <item.icon className="w-4 h-4" />
                        <span>{item.label}</span>
                      </DropdownMenuItem>
                    ))}
                    
                    <DropdownMenuSeparator />
                    
                    {/* Comunicação */}
                    <DropdownMenuLabel className="flex items-center gap-2">
                      <Megaphone className="w-4 h-4" />
                      Comunicação
                    </DropdownMenuLabel>
                    {comunicacaoMenuItems.map((item) => (
                      <DropdownMenuItem 
                        key={item.path}
                        onClick={() => navigate(item.path)}
                        className="gap-2 cursor-pointer pl-6"
                      >
                        <item.icon className="w-4 h-4" />
                        <span>{item.label}</span>
                      </DropdownMenuItem>
                    ))}
                    
                    <DropdownMenuSeparator />
                    
                    {/* Escritório */}
                    <DropdownMenuLabel className="flex items-center gap-2">
                      <DoorOpen className="w-4 h-4" />
                      Escritório
                    </DropdownMenuLabel>
                    {escritorioMenuItems.map((item) => (
                      <DropdownMenuItem 
                        key={item.path}
                        onClick={() => navigate(item.path)}
                        className="gap-2 cursor-pointer pl-6"
                      >
                        <item.icon className="w-4 h-4" />
                        <span>{item.label}</span>
                      </DropdownMenuItem>
                    ))}
                    
                    <DropdownMenuSeparator />
                    
                    {/* Minha Conta */}
                    <DropdownMenuLabel className="flex items-center gap-2">
                      <UserCircle className="w-4 h-4" />
                      Minha Conta
                    </DropdownMenuLabel>
                    {minhaContaMenuItems.map((item) => (
                      <DropdownMenuItem 
                        key={item.path}
                        onClick={() => navigate(item.path)}
                        className="gap-2 cursor-pointer pl-6"
                      >
                        <item.icon className="w-4 h-4" />
                        <span>{item.label}</span>
                      </DropdownMenuItem>
                    ))}
                    
                    {/* Configurações (só admin) */}
                    {configuracoesMenuItems.length > 0 && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuLabel className="flex items-center gap-2">
                          <Settings className="w-4 h-4" />
                          Configurações
                        </DropdownMenuLabel>
                        {configuracoesMenuItems.map((item) => (
                          <DropdownMenuItem 
                            key={item.path}
                            onClick={() => navigate(item.path)}
                            className="gap-2 cursor-pointer pl-6"
                          >
                            <item.icon className="w-4 h-4" />
                            <span>{item.label}</span>
                            {item.badgeCount !== undefined && item.badgeCount > 0 && (
                              <Badge variant="destructive" className="ml-auto h-5 w-5 p-0 flex items-center justify-center text-xs">{item.badgeCount}</Badge>
                            )}
                          </DropdownMenuItem>
                        ))}
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </nav>
            </div>
            <div className="flex items-center gap-1 md:gap-2">
              {/* Global Search Button */}
              <Button 
                variant="ghost" 
                size="icon"
                onClick={() => setSearchOpen(true)}
                title="Buscar (Ctrl+K)"
              >
                <SearchIcon className="w-4 h-4" />
              </Button>
              <NotificationsPanel />
              <UpdatesNotification />
              <ThemeToggle />
              {profile?.avatar_url && (
                <img 
                  src={profile.avatar_url} 
                  alt={profile.full_name}
                  className="w-8 h-8 rounded-full object-cover hidden md:block cursor-pointer"
                  onClick={() => navigate('/profile')}
                />
              )}
              <Button variant="ghost" size="icon" onClick={signOut} className="hidden md:flex" title="Sair">
                <LogOut className="w-4 h-4" />
              </Button>
              
              {/* Mobile Menu */}
              <Drawer open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
                <DrawerTrigger asChild className="lg:hidden">
                  <Button variant="ghost" size="icon">
                    {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                  </Button>
                </DrawerTrigger>
                <DrawerContent className="h-[85vh] max-h-[85vh] flex flex-col px-4">
                  <div className="flex items-center gap-3 py-4 border-b flex-shrink-0">
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
                  <div className="flex-1 overflow-y-auto overscroll-contain touch-pan-y pb-safe">
                    <div className="flex flex-col gap-4 mt-4 pb-8">
                      <NavItems />
                      <Button variant="outline" onClick={signOut} className="gap-2 mt-4 mb-4">
                        <LogOut className="w-4 h-4" />
                        Sair
                      </Button>
                    </div>
                  </div>
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
