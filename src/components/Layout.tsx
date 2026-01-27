import { ReactNode, useEffect, useState, useLayoutEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { Button } from '@/components/ui/button';
import { LogOut, Search as SearchIcon, ArrowLeft, Menu, MessageCircle, Bell } from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';
import { UpdatesNotification } from '@/components/UpdatesNotification';
import { NotificationsPanel } from '@/components/NotificationsPanel';
import { Command, CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { SidebarProvider, SidebarTrigger, SidebarInset } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/AppSidebar';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useAccessTracking } from '@/hooks/useAccessTracking';

import logoEggNunes from '@/assets/logo-eggnunes.png';

interface LayoutProps {
  children: ReactNode;
}

export const Layout = ({ children }: LayoutProps) => {
  const { signOut, user } = useAuth();
  const { isAdmin, profile } = useUserRole();
  const [unreadAnnouncementsCount, setUnreadAnnouncementsCount] = useState(0);
  const [unreadMessagesCount, setUnreadMessagesCount] = useState(0);
  const [searchOpen, setSearchOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const showBackButton = location.pathname !== '/dashboard' && location.pathname !== '/';
  
  // Rastrear acessos às páginas
  useAccessTracking();
  
  // Fix mobile scroll on route change
  useLayoutEffect(() => {
    const enableScroll = () => {
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';
      document.body.style.touchAction = '';
      document.documentElement.style.overflow = '';
      document.body.style.overflowY = 'scroll';
    };
    
    enableScroll();
    const timeout = setTimeout(enableScroll, 100);
    
    return () => clearTimeout(timeout);
  }, [location.pathname]);
  
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
      fetchUnreadMessagesCount();

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

      return () => {
        supabase.removeChannel(announcementsChannel);
      };
    }
  }, [user]);

  const fetchUnreadAnnouncementsCount = async () => {
    if (!user) return;

    const { data: announcements } = await supabase
      .from('announcements')
      .select('id');

    if (!announcements) return;

    const { data: readAnnouncements } = await supabase
      .from('announcement_reads')
      .select('announcement_id')
      .eq('user_id', user.id);

    const readIds = new Set(readAnnouncements?.map(r => r.announcement_id) || []);
    const unreadCount = announcements.filter(a => !readIds.has(a.id)).length;

    setUnreadAnnouncementsCount(unreadCount);
  };

  const fetchUnreadMessagesCount = async () => {
    // This can be implemented based on your messaging system
    // For now, we'll just set it to 0
    setUnreadMessagesCount(0);
  };

  // All searchable items for global search
  const allSearchableItems = [
    { path: '/dashboard', label: 'Dashboard', description: 'Página inicial', category: 'Início' },
    { path: '/mural-avisos', label: 'Mural de Avisos', description: 'Comunicados e eventos', category: 'Início' },
    { path: '/assistente-ia', label: 'Assistente de IA', description: 'Chat com IA', category: 'Inteligência Artificial' },
    { path: '/agentes-ia', label: 'Agentes de IA', description: 'Agentes especializados', category: 'Inteligência Artificial' },
    { path: '/pesquisa-jurisprudencia', label: 'Pesquisa Jurisprudência', description: 'Busca em jurisprudência', category: 'Inteligência Artificial' },
    { path: '/tools/rotadoc', label: 'RotaDoc', description: 'Organização de documentos', category: 'Inteligência Artificial' },
    { path: '/processos', label: 'Processos', description: 'Dashboard de processos', category: 'Advbox' },
    { path: '/publicacoes', label: 'Publicações', description: 'Feed de publicações', category: 'Advbox' },
    { path: '/tarefas-advbox', label: 'Tarefas', description: 'Gestão de tarefas', category: 'Advbox' },
    { path: '/relatorios-produtividade-tarefas', label: 'Produtividade', description: 'Relatórios de produtividade', category: 'Advbox' },
    { path: '/relatorios-financeiros', label: 'Financeiro', description: 'Relatórios financeiros', category: 'Advbox' },
    { path: '/advbox-analytics', label: 'Analytics', description: 'Gráficos e métricas', category: 'Advbox' },
    { path: '/aniversarios-clientes', label: 'Aniversários Clientes', description: 'Clientes aniversariantes', category: 'Advbox' },
    { path: '/historico-mensagens-aniversario', label: 'Histórico Mensagens', description: 'Mensagens de aniversário', category: 'Advbox' },
    { path: '/decisoes-favoraveis', label: 'Decisões Favoráveis', description: 'Registro de vitórias', category: 'Gestão Processual' },
    { path: '/codigos-autenticacao', label: 'Códigos TOTP', description: 'Autenticação de tribunais', category: 'Gestão Processual' },
    { path: '/setor-comercial', label: 'Painel Comercial', description: 'Gerador de documentos', category: 'Comercial' },
    { path: '/crm', label: 'CRM', description: 'Gestão de leads', category: 'Comercial' },
    { path: '/lead-tracking', label: 'Tracking de Leads', description: 'UTMs e formulários', category: 'Comercial' },
    { path: '/equipe', label: 'Equipe', description: 'Membros da equipe', category: 'Equipe e RH' },
    { path: '/aniversarios', label: 'Aniversários', description: 'Aniversários da equipe', category: 'Equipe e RH' },
    { path: '/ferias', label: 'Férias', description: 'Gestão de férias', category: 'Equipe e RH' },
    { path: '/home-office', label: 'Home Office', description: 'Escala de home office', category: 'Equipe e RH' },
    { path: '/contratacao', label: 'Recrutamento', description: 'Gestão de currículos', category: 'Equipe e RH' },
    { path: '/onboarding', label: 'Onboarding', description: 'Materiais de integração', category: 'Equipe e RH' },
    { path: '/mensagens', label: 'Mensagens', description: 'Chat com a equipe', category: 'Comunicação' },
    { path: '/forum', label: 'Fórum', description: 'Discussões da equipe', category: 'Comunicação' },
    { path: '/sugestoes', label: 'Sugestões', description: 'Envie suas ideias', category: 'Comunicação' },
    { path: '/caixinha-desabafo', label: 'Caixinha de Desabafo', description: 'Canal anônimo', category: 'Comunicação' },
    { path: '/arquivos-teams', label: 'Arquivos Teams', description: 'Microsoft Teams', category: 'Microsoft Teams' },
    { path: '/documentos-uteis', label: 'Documentos Úteis', description: 'Documentos internos', category: 'Documentos' },
    { path: '/solicitacoes-administrativas', label: 'Solicitações', description: 'Pedidos administrativos', category: 'Administrativo' },
    { path: '/copa-cozinha', label: 'Copa e Cozinha', description: 'Sugestões de alimentos', category: 'Administrativo' },
    { path: '/sala-reuniao', label: 'Sala de Reunião', description: 'Reservar sala', category: 'Administrativo' },
    { path: '/galeria-eventos', label: 'Galeria de Eventos', description: 'Fotos dos eventos', category: 'Administrativo' },
    { path: '/documentos-uteis', label: 'Documentos Úteis', description: 'Documentos internos', category: 'Administrativo' },
    { path: '/sobre-escritorio', label: 'Sobre o Escritório', description: 'História e áreas de atuação', category: 'Sobre o Escritório' },
    { path: '/profile', label: 'Perfil', description: 'Editar perfil', category: 'Minha Conta' },
    { path: '/historico', label: 'Histórico', description: 'Histórico de uso', category: 'Minha Conta' },
    ...(isAdmin ? [
      { path: '/admin', label: 'Painel Admin', description: 'Configurações do sistema', category: 'Administração' },
      { path: '/integracoes', label: 'Integrações', description: 'Webhooks e APIs', category: 'Administração' },
      { path: '/dashboard-sugestoes', label: 'Estatísticas', description: 'Dashboard de métricas', category: 'Administração' },
    ] : []),
  ];

  const handleSearchSelect = (path: string) => {
    setSearchOpen(false);
    navigate(path);
  };

  const searchCategories = [...new Set(allSearchableItems.map(item => item.category))];

  return (
    <SidebarProvider defaultOpen={true}>
      <div className="min-h-[100dvh] flex w-full">
        <AppSidebar />
        
        <SidebarInset className="flex-1 flex flex-col">
          {/* Global Search Dialog */}
          <CommandDialog open={searchOpen} onOpenChange={setSearchOpen}>
            <CommandInput placeholder="Buscar na intranet... (Ctrl+K)" />
            <CommandList>
              <CommandEmpty>Nenhum resultado encontrado.</CommandEmpty>
              {searchCategories.map((category) => {
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
                        <span>{item.label}</span>
                        <span className="text-xs text-muted-foreground ml-auto">{item.description}</span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                );
              })}
            </CommandList>
          </CommandDialog>

          {/* Top Bar */}
          <header className="border-b border-border bg-card sticky top-0 z-50 backdrop-blur-sm bg-card/95">
            <div className="flex items-center justify-between h-14 px-4">
              <div className="flex items-center gap-3">
                <SidebarTrigger className="-ml-1" />
                
                {/* Logo with Intranet text - always visible */}
                <div 
                  className="flex items-center gap-2 cursor-pointer" 
                  onClick={() => navigate('/dashboard')}
                >
                  <img 
                    src={logoEggNunes} 
                    alt="Egg Nunes" 
                    className="h-8 object-contain"
                  />
                  <span className="font-semibold text-sm text-foreground hidden sm:inline">Intranet</span>
                </div>
              </div>

              <div className="flex items-center gap-1 md:gap-2">
                {/* Global Search Button */}
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setSearchOpen(true)}
                  className="hidden md:flex gap-2 text-muted-foreground"
                >
                  <SearchIcon className="w-4 h-4" />
                  <span className="text-sm">Buscar...</span>
                  <kbd className="pointer-events-none hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 sm:flex">
                    <span className="text-xs">⌘</span>K
                  </kbd>
                </Button>
                
                <Button 
                  variant="ghost" 
                  size="icon"
                  onClick={() => setSearchOpen(true)}
                  className="md:hidden"
                  title="Buscar"
                >
                  <SearchIcon className="w-4 h-4" />
                </Button>

                {/* Messages shortcut */}
                <Button 
                  variant="ghost" 
                  size="icon"
                  onClick={() => navigate('/mensagens')}
                  title="Mensagens"
                  className="relative"
                >
                  <MessageCircle className="w-4 h-4" />
                  {unreadMessagesCount > 0 && (
                    <Badge variant="destructive" className="absolute -top-1 -right-1 h-4 w-4 p-0 flex items-center justify-center text-[10px]">
                      {unreadMessagesCount}
                    </Badge>
                  )}
                </Button>

                <NotificationsPanel />
                <UpdatesNotification />
                <ThemeToggle />
                
                {/* User Menu */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="relative">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={profile?.avatar_url} />
                        <AvatarFallback className="text-xs">
                          {profile?.full_name?.charAt(0) || 'U'}
                        </AvatarFallback>
                      </Avatar>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56 bg-card border-border z-50">
                    <DropdownMenuLabel>
                      <div className="flex flex-col">
                        <span className="font-medium">{profile?.full_name}</span>
                        <span className="text-xs text-muted-foreground">{user?.email}</span>
                      </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => navigate('/profile')} className="cursor-pointer">
                      Meu Perfil
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate('/historico')} className="cursor-pointer">
                      Histórico
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={signOut} className="cursor-pointer text-destructive">
                      <LogOut className="w-4 h-4 mr-2" />
                      Sair
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </header>

          {/* Main Content */}
          <main className="flex-1 p-4 md:p-6 lg:p-8 overflow-x-hidden overflow-y-auto min-w-0">
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
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
};
