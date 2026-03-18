import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PauseCircle, UserX, LogOut } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface ProtectedRouteProps {
  children: ReactNode;
}

export const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const { user, loading: authLoading } = useAuth();
  const { profile, loading: roleLoading, isSuspended, isInactive } = useUserRole();

  if (authLoading || roleLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-muted-foreground">Carregando...</div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // Block inactive (terminated) users
  if (isInactive) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <UserX className="w-12 h-12 mx-auto text-destructive mb-2" />
            <CardTitle className="text-destructive">Acesso Desativado</CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-muted-foreground">
              Seu acesso à intranet foi desativado. Entre em contato com a administração para mais informações.
            </p>
            <Button
              variant="outline"
              onClick={() => supabase.auth.signOut()}
              className="gap-2"
            >
              <LogOut className="w-4 h-4" />
              Sair
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Block suspended users
  if (isSuspended) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <PauseCircle className="w-12 h-12 mx-auto text-orange-500 mb-2" />
            <CardTitle className="text-orange-600 dark:text-orange-400">Acesso Suspenso Temporariamente</CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-muted-foreground">
              Seu acesso à intranet está temporariamente suspenso.
            </p>
            {profile?.suspended_reason && (
              <p className="text-sm bg-muted p-3 rounded-md">
                <strong>Motivo:</strong> {profile.suspended_reason}
              </p>
            )}
            <p className="text-sm text-muted-foreground">
              Entre em contato com a administração caso tenha dúvidas.
            </p>
            <Button
              variant="outline"
              onClick={() => supabase.auth.signOut()}
              className="gap-2"
            >
              <LogOut className="w-4 h-4" />
              Sair
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
};
