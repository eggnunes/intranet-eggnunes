import { useState, useRef, useCallback, useEffect, useLayoutEffect, useMemo } from 'react';
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
  useSidebar,
} from '@/components/ui/sidebar';
import {
  Home,
  Briefcase,
  Scale,
  DollarSign,
  Users,
  User,
  Search as SearchIcon,
  MessageSquare,
  Sparkles,
  Settings,
  ChevronDown,
  BarChart3,
  TrendingUp,
  Tv,
  Target,
  FileSignature,
  Megaphone,
  FileText,
  CheckSquare,
  AlertCircle,
  Gavel,
  BookOpen,
  Award,
  Bell,
  ClipboardList,
  Wallet,
  CreditCard,
  Cake,
  SmilePlus,
  CalendarDays,
  UserPlus,
  UserCircle,
  FolderOpen,
  MessageCircle,
  Lightbulb,
  HeartHandshake,
  Building2,
  History,
  Camera,
  Phone,
  Shield,
  KeyRound,
  HardDrive,
  Handshake,
  Coffee,
  DoorOpen,
  Bot,
  SpellCheck,
  Link2,
  LinkIcon,
} from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

// Types
interface MenuItemDef {
  icon: React.ComponentType<{ className?: string }>;
  path: string;
  label: string;
  badgeCount?: number;
  condition?: boolean;
}

interface MenuGroupDef {
  id: string;
  label: string;
  emoji: string;
  icon: React.ComponentType<{ className?: string }>;
  items: MenuItemDef[];
}

// localStorage key
const STORAGE_KEY = 'sidebar-open-groups';

// Module-level persistent scroll storage
const sidebarScrollPositions = new Map<string, number>();

function loadOpenGroups(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return new Set(JSON.parse(raw));
  } catch {}
  return new Set<string>();
}

function saveOpenGroups(groups: Set<string>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...groups]));
  } catch {}
}

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
    if (isAdmin) fetchPendingCount();
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
      let tasksData: any[] = [];
      if (data?.data && Array.isArray(data.data)) tasksData = data.data;
      else if (Array.isArray(data)) tasksData = data;
      else if (data && typeof data === 'object') tasksData = data.tasks || data.items || [];

      const currentName = profile.full_name.toLowerCase();
      const userTasks = tasksData.filter((task: any) => {
        const isPending = task.status?.toLowerCase() === 'pending' || task.status?.toLowerCase() === 'pendente';
        const isInProgress = task.status?.toLowerCase() === 'in_progress' || task.status?.toLowerCase() === 'em andamento';
        const isUserTask = task.assigned_to?.toLowerCase().includes(currentName);
        return (isPending || isInProgress) && isUserTask && task.due_date;
      });

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const count = userTasks.filter((task: any) => {
        try {
          const d = new Date(task.due_date);
          d.setHours(0, 0, 0, 0);
          return d <= today;
        } catch { return false; }
      }).length;
      setCriticalTasksCount(count);
    } catch {}
  };

  const isSocio = profile?.position === 'socio';

  // ─── 11 Menu Groups ───────────────────────────────────────
  const menuGroups: MenuGroupDef[] = useMemo(() => [
    {
      id: 'dashboard',
      label: 'Dashboard & Visão Geral',
      emoji: '📊',
      icon: Home,
      items: [
        { icon: BarChart3, path: '/dashboard', label: 'Dashboard Principal' },
        { icon: History, path: '/historico', label: 'Histórico' },
      ],
    },
    {
      id: 'ferramentas',
      label: 'Ferramentas & IA',
      emoji: '🤖',
      icon: Sparkles,
      items: [
        { icon: Bot, path: '/assistente-ia', label: 'Assistente de IA' },
        { icon: Sparkles, path: '/agentes-ia', label: 'Agentes de IA' },
        { icon: FileText, path: '/tools/rotadoc', label: 'RotaDoc' },
        { icon: LinkIcon, path: '/integracoes', label: 'Integrações' },
        { icon: SpellCheck, path: '/corretor-portugues', label: 'Corretor de Português' },
        { icon: Link2, path: '/gerador-qrcode', label: 'Gerador de QR Code' },
      ],
    },
    {
      id: 'negocios',
      label: 'Negócios & CRM',
      emoji: '💼',
      icon: Briefcase,
      items: [
        { icon: Users, path: '/crm', label: 'CRM Principal' },
        { icon: Tv, path: '/negocios/tv', label: 'TV Mode' },
        { icon: Briefcase, path: '/setor-comercial', label: 'Setor Comercial' },
        { icon: Target, path: '/lead-tracking', label: 'Lead Tracking', condition: isSocio || isAdmin },
        { icon: TrendingUp, path: '/negocios/marketing', label: 'Marketing Hub' },
        { icon: FileSignature, path: '/setor-comercial/contratos', label: 'Contratos' },
        { icon: Handshake, path: '/parceiros', label: 'Parceiros' },
      ],
    },
    {
      id: 'producao-juridica',
      label: 'Produção Jurídica',
      emoji: '⚖️',
      icon: Scale,
      items: [
        { icon: Briefcase, path: '/processos', label: 'Processos Dashboard' },
        { icon: CheckSquare, path: '/tarefas-advbox', label: 'Tarefas Advbox', badgeCount: criticalTasksCount },
        { icon: Users, path: '/distribuicao-tarefas', label: 'Distribuição de Tarefas', condition: isSocio || isAdmin },
        { icon: ClipboardList, path: '/controle-prazos', label: 'Controle de Prazos', condition: isSocio || isAdmin },
        { icon: Briefcase, path: '/processos-ativos', label: 'Processos Ativos' },
        { icon: AlertCircle, path: '/movimentacoes-advbox', label: 'Movimentações Advbox' },
        { icon: Bell, path: '/publicacoes', label: 'Publicações ADVBox' },
        { icon: Cake, path: '/aniversarios-clientes', label: 'Aniversários Clientes' },
        { icon: SearchIcon, path: '/pesquisa-jurisprudencia', label: 'Pesquisa Jurisprudência' },
        { icon: FileText, path: '/publicacoes-dje', label: 'Publicações DJE' },
        { icon: Gavel, path: '/portais-tribunais', label: 'Portais de Tribunais' },
        { icon: Award, path: '/decisoes-favoraveis', label: 'Jurisprudência Interna' },
        { icon: KeyRound, path: '/codigos-autenticacao', label: 'Códigos TOTP' },
      ],
    },
    {
      id: 'financeiro',
      label: 'Financeiro',
      emoji: '💰',
      icon: DollarSign,
      items: [
        { icon: Wallet, path: '/financeiro', label: 'Dashboard Financeiro' },
        { icon: CreditCard, path: '/asaas', label: 'Asaas' },
        { icon: BarChart3, path: '/relatorios-financeiros', label: 'Relatórios Financeiros' },
        { icon: DollarSign, path: '/gestao-cobrancas', label: 'Gestão de Cobranças' },
        { icon: Settings, path: '/financeiro/admin', label: 'Financeiro Admin', condition: isSocio || isAdmin },
      ],
    },
    {
      id: 'rh',
      label: 'RH & Administrativo',
      emoji: '👥',
      icon: Users,
      items: [
        { icon: BarChart3, path: '/rh', label: 'Dashboard RH', condition: isSocio || isAdmin },
        { icon: Users, path: '/equipe', label: 'Equipe' },
        { icon: Cake, path: '/aniversarios', label: 'Aniversários' },
        { icon: SmilePlus, path: '/pesquisa-humor', label: 'Pesquisa de Humor' },
        { icon: Megaphone, path: '/mural-avisos', label: 'Mural de Avisos' },
        { icon: CalendarDays, path: '/ferias', label: 'Férias' },
        { icon: CalendarDays, path: '/gestao-folgas', label: 'Gestão de Folgas' },
        { icon: UserPlus, path: '/contratacao', label: 'Contratação' },
        { icon: Home, path: '/home-office', label: 'Home Office' },
        { icon: BookOpen, path: '/onboarding', label: 'Onboarding' },
        { icon: Camera, path: '/galeria-eventos', label: 'Galeria de Eventos' },
        { icon: Coffee, path: '/copa-cozinha', label: 'Copa/Cozinha' },
      ],
    },
    {
      id: 'meu-painel',
      label: 'Meu Painel',
      emoji: '👤',
      icon: User,
      items: [
        { icon: UserCircle, path: '/profile', label: 'Meu Perfil' },
        { icon: ClipboardList, path: '/solicitacoes-administrativas', label: 'Solicitações' },
        { icon: Building2, path: '/sobre-escritorio', label: 'Sobre o Escritório' },
        { icon: DoorOpen, path: '/sala-reuniao', label: 'Sala de Reunião' },
      ],
    },
    {
      id: 'arquivos',
      label: 'Arquivos do Escritório',
      emoji: '📁',
      icon: FolderOpen,
      items: [
        { icon: HardDrive, path: '/arquivos-teams', label: 'Arquivos Teams' },
        { icon: UserPlus, path: '/criar-pasta-cliente', label: 'Criar Pasta de Cliente' },
      ],
    },
    {
      id: 'viabilidade',
      label: 'Viabilidade Jurídica',
      emoji: '🔍',
      icon: SearchIcon,
      items: [
        { icon: SearchIcon, path: '/viabilidade', label: 'Dashboard Viabilidade' },
        { icon: UserPlus, path: '/viabilidade/novo', label: 'Novo Cliente' },
      ],
    },
    {
      id: 'comunicacao',
      label: 'Comunicação e Avisos',
      emoji: '📢',
      icon: MessageSquare,
      items: [
        { icon: FolderOpen, path: '/documentos-uteis', label: 'Documentos Úteis' },
        { icon: Bell, path: '/notificacoes', label: 'Notificações' },
        { icon: MessageSquare, path: '/forum', label: 'Fórum' },
        { icon: MessageCircle, path: '/mensagens', label: 'Mensagens' },
        { icon: Lightbulb, path: '/sugestoes', label: 'Sugestões' },
        { icon: BarChart3, path: '/dashboard-sugestoes', label: 'Dashboard Sugestões' },
        { icon: HeartHandshake, path: '/caixinha-desabafo', label: 'Caixinha de Desabafo' },
        { icon: MessageCircle, path: '/mensagens-encaminhadas', label: 'Mensagens Encaminhadas' },
        { icon: Phone, path: '/whatsapp-avisos', label: 'WhatsApp Avisos' },
      ],
    },
    {
      id: 'administrativo',
      label: 'Administrativo & Config.',
      emoji: '⚙️',
      icon: Settings,
      items: [
        { icon: Shield, path: '/admin', label: 'Admin', badgeCount: pendingUsersCount, condition: isAdmin },
        { icon: Phone, path: '/cadastros-uteis', label: 'Cadastros Úteis' },
      ],
    },
  ], [isAdmin, isSocio, criticalTasksCount, pendingUsersCount]);

  // Filter out items whose condition is false
  const filteredGroups = useMemo(() =>
    menuGroups.map(g => ({
      ...g,
      items: g.items.filter(i => i.condition === undefined || i.condition),
    })).filter(g => g.items.length > 0),
    [menuGroups]
  );

  // ─── Determine which group contains the active route ──────
  const activeGroupId = useMemo(() => {
    for (const g of filteredGroups) {
      if (g.items.some(i => location.pathname === i.path)) return g.id;
    }
    return null;
  }, [location.pathname, filteredGroups]);

  // ─── Open groups state with localStorage persistence ──────
  const [openGroups, setOpenGroups] = useState<Set<string>>(() => {
    const saved = loadOpenGroups();
    // On first load if nothing saved, open the active group
    if (saved.size === 0 && activeGroupId) saved.add(activeGroupId);
    return saved;
  });

  // Auto-open the group containing the active route
  useEffect(() => {
    if (activeGroupId && !openGroups.has(activeGroupId)) {
      setOpenGroups(prev => {
        const next = new Set(prev);
        next.add(activeGroupId);
        saveOpenGroups(next);
        return next;
      });
    }
  }, [activeGroupId]);

  const toggleGroup = useCallback((id: string) => {
    setOpenGroups(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      saveOpenGroups(next);
      return next;
    });
  }, []);

  const isActive = (path: string) => location.pathname === path;

  // ─── Scroll preservation ──────────────────────────────────
  const handleSidebarScroll = useCallback(() => {
    if (!isRestoringScroll.current && sidebarContentRef.current) {
      const pos = sidebarContentRef.current.scrollTop;
      scrollPositionRef.current = pos;
      sidebarScrollPositions.set('sidebar', pos);
    }
  }, []);

  const handleNavigate = useCallback((path: string) => {
    if (sidebarContentRef.current) {
      const pos = sidebarContentRef.current.scrollTop;
      scrollPositionRef.current = pos;
      sidebarScrollPositions.set('sidebar', pos);
    }
    navigate(path);
  }, [navigate]);

  useLayoutEffect(() => {
    const savedPos = scrollPositionRef.current || sidebarScrollPositions.get('sidebar') || 0;
    if (savedPos > 0) {
      isRestoringScroll.current = true;
      const restoreScroll = () => {
        if (sidebarContentRef.current) sidebarContentRef.current.scrollTop = savedPos;
      };
      restoreScroll();
      requestAnimationFrame(restoreScroll);
      const t1 = setTimeout(restoreScroll, 100);
      const t2 = setTimeout(restoreScroll, 250);
      const t3 = setTimeout(() => { restoreScroll(); isRestoringScroll.current = false; }, 500);
      return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
    }
  }, [location.pathname]);

  // ─── Render ───────────────────────────────────────────────
  return (
    <Sidebar collapsible="icon" className="border-r border-border bg-card">
      <SidebarHeader className="p-4 border-b border-border">
        {!collapsed && <span className="font-semibold text-sm text-muted-foreground">Menu</span>}
      </SidebarHeader>

      <SidebarContent ref={sidebarContentRef} onScroll={handleSidebarScroll} className="overflow-y-auto">
        {filteredGroups.map((group) => (
          <Collapsible
            key={group.id}
            open={openGroups.has(group.id)}
            onOpenChange={() => toggleGroup(group.id)}
          >
            <SidebarGroup>
              <CollapsibleTrigger asChild>
                <SidebarGroupLabel className="cursor-pointer hover:bg-accent/50 rounded-md px-2 py-1.5 flex items-center justify-between text-xs font-semibold text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    {collapsed ? (
                      <group.icon className="h-4 w-4" />
                    ) : (
                      <>
                        <span>{group.emoji}</span>
                        <span>{group.label}</span>
                      </>
                    )}
                  </span>
                  {!collapsed && (
                    <ChevronDown className={`h-3 w-3 transition-transform duration-200 ${openGroups.has(group.id) ? 'rotate-180' : ''}`} />
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
      </SidebarContent>
    </Sidebar>
  );
}
