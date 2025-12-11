import { Layout } from "@/components/Layout";
import { CRMDashboard } from "@/components/crm";
import { useAdminPermissions } from "@/hooks/useAdminPermissions";
import { Users } from "lucide-react";

const CRM = () => {
  const { hasPermission, loading } = useAdminPermissions();

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </Layout>
    );
  }

  const canAccess = hasPermission('lead_tracking', 'view');

  if (!canAccess) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center h-64 space-y-4">
          <Users className="h-16 w-16 text-muted-foreground" />
          <h2 className="text-xl font-semibold">Acesso Restrito</h2>
          <p className="text-muted-foreground">Você não tem permissão para acessar o CRM.</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <CRMDashboard />
    </Layout>
  );
};

export default CRM;
