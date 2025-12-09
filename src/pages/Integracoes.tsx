import { Layout } from '@/components/Layout';
import { Link2 } from 'lucide-react';
import { RDStationWebhookManager } from '@/components/RDStationWebhookManager';
import { useUserRole } from '@/hooks/useUserRole';

export default function Integracoes() {
  const { isAdmin } = useUserRole();

  if (!isAdmin) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center space-y-2">
            <h2 className="text-xl font-semibold">Acesso Restrito</h2>
            <p className="text-muted-foreground">
              Apenas administradores podem acessar as configurações de integrações.
            </p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6 max-w-3xl">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Link2 className="h-8 w-8 text-primary" />
            Integrações
          </h1>
          <p className="text-muted-foreground mt-2">
            Gerencie as integrações da intranet com sistemas externos
          </p>
        </div>

        <RDStationWebhookManager />
      </div>
    </Layout>
  );
}
