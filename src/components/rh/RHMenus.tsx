import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import {
  BarChart3,
  ChevronDown,
  ChevronRight,
  Users,
  Wallet,
  FolderOpen,
  UserCheck,
  Banknote,
  FileText,
  Briefcase,
  CreditCard,
  TrendingUp
} from 'lucide-react';

interface MenuItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  items?: { id: string; label: string }[];
}

interface RHMenusProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const menuItems: MenuItem[] = [
  {
    id: 'visao-geral',
    label: 'Visão Geral',
    icon: BarChart3,
    items: [
      { id: 'dashboard', label: 'Dashboard RH' },
      { id: 'colaborador-dashboard', label: 'Dashboard Colaborador' },
    ]
  },
  {
    id: 'folha-pagamento',
    label: 'Folha de Pagamento',
    icon: Wallet,
    items: [
      { id: 'pagamentos', label: 'Pagamentos' },
      { id: 'adiantamentos', label: 'Adiantamentos' },
    ]
  },
  {
    id: 'gestao-pessoas',
    label: 'Gestão de Pessoas',
    icon: TrendingUp,
    items: [
      { id: 'promocoes', label: 'Promoções' },
      { id: 'folgas', label: 'Folgas' },
    ]
  },
  {
    id: 'cadastros',
    label: 'Cadastros',
    icon: FolderOpen,
    items: [
      { id: 'colaboradores', label: 'Colaboradores' },
      { id: 'cargos', label: 'Cargos e Salários' },
    ]
  },
];

export function RHMenus({ activeTab, onTabChange }: RHMenusProps) {
  const [openMenus, setOpenMenus] = useState<Set<string>>(new Set(['visao-geral', 'folha-pagamento']));

  const toggleMenu = (id: string) => {
    const newOpen = new Set(openMenus);
    if (newOpen.has(id)) {
      newOpen.delete(id);
    } else {
      newOpen.add(id);
    }
    setOpenMenus(newOpen);
  };

  const isActive = (id: string) => activeTab === id;
  const hasActiveChild = (menu: MenuItem) => 
    menu.items?.some(item => isActive(item.id)) || false;

  return (
    <div className="w-64 border-r bg-muted/30 p-4 space-y-1 min-h-[600px]">
      <h3 className="text-sm font-semibold text-muted-foreground mb-4 px-2">MENU RH</h3>
      
      {menuItems.map((menu) => (
        <div key={menu.id}>
          {menu.items ? (
            <Collapsible 
              open={openMenus.has(menu.id)} 
              onOpenChange={() => toggleMenu(menu.id)}
            >
              <CollapsibleTrigger asChild>
                <Button
                  variant="ghost"
                  className={cn(
                    "w-full justify-between",
                    hasActiveChild(menu) && "bg-accent"
                  )}
                >
                  <span className="flex items-center gap-2">
                    <menu.icon className="h-4 w-4" />
                    {menu.label}
                  </span>
                  {openMenus.has(menu.id) ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="pl-6 space-y-1 mt-1">
                {menu.items.map((item) => (
                  <Button
                    key={item.id}
                    variant={isActive(item.id) ? "secondary" : "ghost"}
                    className={cn(
                      "w-full justify-start text-sm",
                      isActive(item.id) && "bg-primary text-primary-foreground"
                    )}
                    onClick={() => onTabChange(item.id)}
                  >
                    {item.label}
                  </Button>
                ))}
              </CollapsibleContent>
            </Collapsible>
          ) : (
            <Button
              variant={isActive(menu.id) ? "secondary" : "ghost"}
              className={cn(
                "w-full justify-start",
                isActive(menu.id) && "bg-primary text-primary-foreground"
              )}
              onClick={() => onTabChange(menu.id)}
            >
              <menu.icon className="h-4 w-4 mr-2" />
              {menu.label}
            </Button>
          )}
        </div>
      ))}
    </div>
  );
}
