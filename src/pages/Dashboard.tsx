import { Layout } from '@/components/Layout';
import { useUserRole } from '@/hooks/useUserRole';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { FileText, Clock, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function Dashboard() {
  const { profile, loading, isApproved } = useUserRole();
  const navigate = useNavigate();

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-muted-foreground">Carregando...</div>
        </div>
      </Layout>
    );
  }

  if (!isApproved) {
    return (
      <Layout>
        <div className="max-w-2xl mx-auto mt-12">
          <Alert>
            <Clock className="h-4 w-4" />
            <AlertDescription>
              {profile?.approval_status === 'pending' && (
                'Seu cadastro está aguardando aprovação de um administrador. Você receberá acesso em breve.'
              )}
              {profile?.approval_status === 'rejected' && (
                'Seu cadastro foi rejeitado. Entre em contato com o administrador para mais informações.'
              )}
            </AlertDescription>
          </Alert>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-8">
        <div>
          <h1 className="text-4xl font-bold text-foreground mb-2">
            Bem-vindo, {profile?.full_name}
          </h1>
          <p className="text-muted-foreground text-lg">
            Sistema interno de ferramentas - Egg Nunes Advogados
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigate('/tools/rotadoc')}>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                  <FileText className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <CardTitle>RotaDoc</CardTitle>
                  <CardDescription>Rotação e Organização Inteligente</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Ferramenta de IA para processar documentos e imagens. Corrige automaticamente a orientação de 
                páginas, identifica tipos de documentos e organiza tudo em PDFs estruturados. Perfeito para 
                processar relatórios médicos, procurações e outros documentos do escritório.
              </p>
              <Button className="w-full">Acessar Ferramenta</Button>
            </CardContent>
          </Card>

          <Card className="opacity-50">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-muted rounded-lg flex items-center justify-center">
                  <AlertCircle className="w-6 h-6 text-muted-foreground" />
                </div>
                <div>
                  <CardTitle>Mais ferramentas em breve</CardTitle>
                  <CardDescription>Em desenvolvimento</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Novas ferramentas serão adicionadas em breve para facilitar o trabalho da equipe.
              </p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Sobre o escritório</CardTitle>
          </CardHeader>
          <CardContent className="prose prose-sm max-w-none">
            <p className="text-muted-foreground">
              <strong>Egg Nunes Advogados Associados</strong> é um escritório de advocacia referência 
              desde 1994, com atuação em todo o Brasil. Especializado em diversas áreas do direito, 
              o escritório conta com uma equipe qualificada para atender as demandas de seus clientes 
              com excelência e dedicação.
            </p>
            <p className="text-muted-foreground mt-4">
              Esta intranet foi desenvolvida para centralizar ferramentas e recursos que otimizam 
              o trabalho da equipe interna, promovendo maior eficiência e colaboração.
            </p>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
