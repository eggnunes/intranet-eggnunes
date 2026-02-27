import { useState, useRef, useCallback, useEffect, useLayoutEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useUserRole } from '@/hooks/useUserRole';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
} from '@/components/ui/sidebar';
import {
  Home as HomeIcon,
  Megaphone,
  Bot,
  Sparkles,
  Search as SearchIcon,
  FileText,
  SpellCheck,
  Briefcase,
  Cake,
  MessageCircle,
  Bell,
  CheckSquare,
  ClipboardList,
  DollarSign,
  TrendingUp,
  Award,
  KeyRound,
  FileSignature,
  Users,
  Target,
  UserPlus,
  CalendarDays,
  Home,
  BookOpen,
  MessageSquare,
  Lightbulb,
  HeartHandshake,
  HardDrive,
  FolderOpen,
  ClipboardList as ClipboardIcon,
  Coffee,
  DoorOpen,
  Camera,
  Building2,
  Info,
  Trophy,
  Link2,
  Phone,
  Shield,
  BarChart3,
  Settings,
  ChevronDown,
  LogOut,
  UserCircle,
  History,
  AlertCircle,
} from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';


// Module-level persistent scroll storage (survives re-renders)
const sidebarScrollPositions = new Map<string, number>();

export function AppSidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAdmin, profile } = useUserRole();
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';
  const sidebarContentRef = useRef<HTMLDivElement>(null);
  const scrollPositionRef = useRef(0);
  const isRestoringScroll = useRef(false);
  
  const [pendingUsersCount, setPendingUsersCount] = useState(0);
  const [criticalTasksCount, setCriticalTasksCount] = useState(0);

  useEffect(() => {
    if (isAdmin) {
      fetchPendingCount();
    }
    fetchCriticalTasksCount();
  }, [isAdmin, profile?.full_name]);

  const fetchPendingCount = async () => {
    const { count } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('approval_status', 'pending');
    
    setPendingUsersCount(count || 0);
  };

  const fetchCriticalTasksCount = async () => {
    if (!profile?.full_name) return;

    try {
      const { data, error } = await supabase.functions.invoke('advbox-integration/tasks', {
        body: { force_refresh: false },
      });

      if (error) return;

      let tasksData = [];
      if (data?.data && Array.isArray(data.data)) {
        tasksData = data.data;
      } else if (Array.isArray(data)) {
        tasksData = data;
      } else if (data && typeof data === 'object' && !Array.isArray(data)) {
        tasksData = data.tasks || data.items || [];
      }

      const currentName = profile.full_name.toLowerCase();
      const userTasks = tasksData.filter((task: any) => {
        const isPending = task.status?.toLowerCase() === 'pending' || task.status?.toLowerCase() === 'pendente';
        const isInProgress = task.status?.toLowerCase() === 'in_progress' || task.status?.toLowerCase() === 'em andamento';
        const isUserTask = task.assigned_to && task.assigned_to.toLowerCase().includes(currentName);
        return (isPending || isInProgress) && isUserTask && task.due_date;
      });

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

  const isActive = (path: string) => location.pathname === path;

  // Continuously track scroll position via onScroll
  const handleSidebarScroll = useCallback(() => {
    if (!isRestoringScroll.current && sidebarContentRef.current) {
      const pos = sidebarContentRef.current.scrollTop;
      scrollPositionRef.current = pos;
      // Also persist to module-level Map as backup
      sidebarScrollPositions.set('sidebar', pos);
    }
  }, []);

  // Save scroll position before navigation, restore after render
  const handleNavigate = useCallback((path: string) => {
    // Snapshot current scroll before navigating
    if (sidebarContentRef.current) {
      const pos = sidebarContentRef.current.scrollTop;
      scrollPositionRef.current = pos;
      sidebarScrollPositions.set('sidebar', pos);
    }
    navigate(path);
  }, [navigate]);

  // Restore sidebar scroll position after route change (useLayoutEffect = before paint)
  useLayoutEffect(() => {
    const savedPos = scrollPositionRef.current || sidebarScrollPositions.get('sidebar') || 0;
    if (savedPos > 0) {
      isRestoringScroll.current = true;
      
      const restoreScroll = () => {
        if (sidebarContentRef.current) {
          sidebarContentRef.current.scrollTop = savedPos;
        }
      };
      
      // Immediate restore (before paint)
      restoreScroll();
      // After first frame (Collapsible might not be open yet)
      requestAnimationFrame(restoreScroll);
      // After animations settle
      const t1 = setTimeout(restoreScroll, 100);
      const t2 = setTimeout(restoreScroll, 250);
      const t3 = setTimeout(() => {
        restoreScroll();
        isRestoringScroll.current = false;
      }, 500);
      
      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
        clearTimeout(t3);
      };
    }
  }, [location.pathname]);

  // Menu structure based on the document - REORGANIZED ORDER
  const menuGroups = [
    {
      label: '🏠 INÍCIO',
      items: [
        { icon: HomeIcon, path: '/dashboard', label: 'Dashboard' },
        { icon: Megaphone, path: '/mural-avisos', label: 'Mural de Avisos' },
      ],
    },
    {
      label: '🤖 INTELIGÊNCIA ARTIFICIAL',
      items: [
        { icon: Bot, path: '/assistente-ia', label: 'Assistente de IA' },
        { icon: Sparkles, path: '/agentes-ia', label: 'Agentes de IA' },
        { icon: SearchIcon, path: '/pesquisa-jurisprudencia', label: 'Pesquisa Jurisprudência' },
        { icon: FileText, path: '/tools/rotadoc', label: 'RotaDoc' },
        { icon: Link2, path: '/gerador-qrcode', label: 'Gerador de QR Code' },
        { icon: SpellCheck, path: '/corretor-portugues', label: 'Corretor de Português' },
      ],
    },
    {
      label: '💼 SETOR COMERCIAL',
      items: [
        { icon: Briefcase, path: '/setor-comercial', label: 'Dashboard Comercial' },
        { icon: FileSignature, path: '/setor-comercial/contratos', label: 'Contratos' },
        { icon: Users, path: '/crm', label: 'CRM' },
        { icon: Users, path: '/parceiros', label: 'Parceiros' },
        ...(profile?.position === 'socio' ? [{ icon: Target, path: '/lead-tracking', label: 'Tracking de Leads' }] : []),
      ],
    },
    {
      label: '⚖️ GESTÃO PROCESSUAL',
      items: [
        { icon: Award, path: '/decisoes-favoraveis', label: 'Jurisprudência Interna' },
        { icon: KeyRound, path: '/codigos-autenticacao', label: 'Códigos TOTP' },
        { icon: Briefcase, path: '/portais-tribunais', label: 'Portais de Tribunais' },
        { icon: FileText, path: '/publicacoes-dje', label: 'Publicações DJE' },
      ],
    },
    {
      label: '📦 ADVBOX',
      items: [
        { icon: Briefcase, path: '/processos', label: 'Dashboard' },
        { icon: Briefcase, path: '/processos-ativos', label: 'Processos' },
        { icon: AlertCircle, path: '/movimentacoes-advbox', label: 'Movimentações' },
        { icon: Bell, path: '/publicacoes', label: 'Publicações' },
        { icon: CheckSquare, path: '/tarefas-advbox', label: 'Tarefas', badgeCount: criticalTasksCount },
        { icon: DollarSign, path: '/relatorios-financeiros', label: 'Financeiro' },
        { icon: Cake, path: '/aniversarios-clientes', label: 'Aniversários Clientes' },
      ],
    },
    {
      label: '📁 MICROSOFT TEAMS',
      items: [
        { icon: HardDrive, path: '/arquivos-teams', label: 'Arquivos Teams' },
      ],
    },
    {
      label: '👥 EQUIPE E RH',
      items: [
        { icon: Users, path: '/equipe', label: 'Perfil da Equipe' },
        { icon: Cake, path: '/aniversarios', label: 'Aniversários da Equipe' },
        { icon: CalendarDays, path: '/ferias', label: 'Gestão de Férias' },
        { icon: CalendarDays, path: '/gestao-folgas', label: 'Gestão de Folgas' },
        { icon: Home, path: '/home-office', label: 'Home Office' },
        { icon: UserPlus, path: '/contratacao', label: 'Recrutamento' },
        { icon: BookOpen, path: '/onboarding', label: 'Onboarding' },
        ...(profile?.position === 'socio' || isAdmin ? [{ icon: DollarSign, path: '/rh', label: 'RH / Pagamentos' }] : []),
      ],
    },
    {
      label: '💬 COMUNICAÇÃO',
      items: [
        { icon: MessageCircle, path: '/mensagens', label: 'Mensagens' },
        { icon: Phone, path: '/whatsapp-avisos', label: 'WhatsApp Avisos' },
        { icon: MessageSquare, path: '/forum', label: 'Fórum' },
        { icon: Lightbulb, path: '/sugestoes', label: 'Sugestões' },
        { icon: HeartHandshake, path: '/caixinha-desabafo', label: 'Caixinha de Desabafo' },
      ],
    },
    {
      label: '🏢 ADMINISTRATIVO',
      items: [
        { icon: ClipboardIcon, path: '/solicitacoes-administrativas', label: 'Solicitações' },
        { icon: Coffee, path: '/copa-cozinha', label: 'Copa e Cozinha' },
        { icon: DoorOpen, path: '/sala-reuniao', label: 'Sala de Reunião' },
        { icon: Camera, path: '/galeria-eventos', label: 'Galeria de Eventos' },
        { icon: FolderOpen, path: '/documentos-uteis', label: 'Documentos Úteis' },
      ],
    },
    {
      label: '💰 FINANCEIRO',
      items: [
        { icon: DollarSign, path: '/financeiro', label: 'Sistema Financeiro' },
        { icon: DollarSign, path: '/asaas', label: 'Asaas' },
      ],
    },
    {
      label: '🏛️ SOBRE O ESCRITÓRIO',
      items: [
        { icon: Building2, path: '/sobre-escritorio', label: 'Sobre Nós' },
      ],
    },
    {
      label: '👤 MINHA CONTA',
      items: [
        { icon: UserCircle, path: '/profile', label: 'Perfil' },
        { icon: History, path: '/historico', label: 'Histórico' },
      ],
    },
  ];

  // Admin menu - only visible for admins
  const adminMenuGroup = {
    label: '⚙️ ADMINISTRAÇÃO',
    items: [
      { icon: Shield, path: '/admin', label: 'Painel Admin', badgeCount: pendingUsersCount },
      { icon: Target, path: '/lead-tracking', label: 'Gerador UTM/Formulários' },
      { icon: Link2, path: '/integracoes', label: 'Integrações' },
      { icon: BarChart3, path: '/dashboard-sugestoes', label: 'Estatísticas' },
    ],
  };

  return (
    <Sidebar collapsible="icon" className="border-r border-border bg-card">
      <SidebarHeader className="p-4 border-b border-border">
        {!collapsed ? (
          <span className="font-semibold text-sm text-muted-foreground">Menu</span>
        ) : null}
      </SidebarHeader>

      <SidebarContent ref={sidebarContentRef} onScroll={handleSidebarScroll} className="overflow-y-auto">
        {menuGroups.map((group) => (
          <Collapsible key={group.label} defaultOpen className="group/collapsible">
            <SidebarGroup>
              <CollapsibleTrigger asChild>
                <SidebarGroupLabel className="cursor-pointer hover:bg-accent/50 rounded-md px-2 py-1.5 flex items-center justify-between text-xs font-semibold text-muted-foreground">
                  <span>{collapsed ? group.label.split(' ')[0] : group.label}</span>
                  {!collapsed && (
                    <ChevronDown className="h-3 w-3 transition-transform group-data-[state=open]/collapsible:rotate-180" />
                  )}
                </SidebarGroupLabel>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {group.items.map((item) => (
                      <SidebarMenuItem key={item.path}>
                        <SidebarMenuButton
                          onClick={() => handleNavigate(item.path)}
                          isActive={isActive(item.path)}
                          tooltip={collapsed ? item.label : undefined}
                          className="gap-2"
                        >
                          <item.icon className="h-4 w-4 flex-shrink-0" />
                          {!collapsed && <span className="truncate">{item.label}</span>}
                          {!collapsed && item.badgeCount !== undefined && item.badgeCount > 0 && (
                            <Badge variant="destructive" className="ml-auto h-5 min-w-5 px-1 text-xs">
                              {item.badgeCount}
                            </Badge>
                          )}
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </CollapsibleContent>
            </SidebarGroup>
          </Collapsible>
        ))}

        {/* Admin section - only for admins */}
        {isAdmin && (
          <Collapsible defaultOpen className="group/collapsible">
            <SidebarGroup>
              <CollapsibleTrigger asChild>
                <SidebarGroupLabel className="cursor-pointer hover:bg-accent/50 rounded-md px-2 py-1.5 flex items-center justify-between text-xs font-semibold text-muted-foreground">
                  <span>{collapsed ? '⚙️' : adminMenuGroup.label}</span>
                  {!collapsed && (
                    <ChevronDown className="h-3 w-3 transition-transform group-data-[state=open]/collapsible:rotate-180" />
                  )}
                </SidebarGroupLabel>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {adminMenuGroup.items.map((item) => (
                      <SidebarMenuItem key={item.path}>
                        <SidebarMenuButton
                          onClick={() => handleNavigate(item.path)}
                          isActive={isActive(item.path)}
                          tooltip={collapsed ? item.label : undefined}
                          className="gap-2"
                        >
                          <item.icon className="h-4 w-4 flex-shrink-0" />
                          {!collapsed && <span className="truncate">{item.label}</span>}
                          {!collapsed && item.badgeCount !== undefined && item.badgeCount > 0 && (
                            <Badge variant="destructive" className="ml-auto h-5 min-w-5 px-1 text-xs">
                              {item.badgeCount}
                            </Badge>
                          )}
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </CollapsibleContent>
            </SidebarGroup>
          </Collapsible>
        )}
      </SidebarContent>
    </Sidebar>
  );
}
