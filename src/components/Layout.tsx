import { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { Button } from '@/components/ui/button';
import { LogOut, Home, Shield, History, Lightbulb, BarChart3 } from 'lucide-react';
import logoEggNunes from '@/assets/logo-eggnunes.png';

interface LayoutProps {
  children: ReactNode;
}

export const Layout = ({ children }: LayoutProps) => {
  const { signOut, user } = useAuth();
  const { isAdmin } = useUserRole();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-20">
            <div className="flex items-center gap-8">
              <img 
                src={logoEggNunes} 
                alt="Egg Nunes Advogados" 
                className="h-12 cursor-pointer"
                onClick={() => navigate('/')}
              />
              <nav className="hidden md:flex items-center gap-6">
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
                    className="gap-2"
                  >
                    <Shield className="w-4 h-4" />
                    Admin
                  </Button>
                )}
                <Button 
                  variant="ghost" 
                  onClick={() => navigate('/historico')}
                  className="gap-2"
                >
                  <History className="w-4 h-4" />
                  Histórico
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
                  onClick={() => navigate('/dashboard-sugestoes')}
                  className="gap-2"
                >
                  <BarChart3 className="w-4 h-4" />
                  Estatísticas
                </Button>
              </nav>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-sm text-muted-foreground hidden md:block">
                {user?.email}
              </div>
              <Button variant="outline" onClick={signOut} className="gap-2">
                <LogOut className="w-4 h-4" />
                Sair
              </Button>
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
