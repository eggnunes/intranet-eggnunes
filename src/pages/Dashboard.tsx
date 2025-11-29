import { Layout } from '@/components/Layout';
import { useUserRole } from '@/hooks/useUserRole';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { FileText, Clock, AlertCircle, MessageSquare, FileStack, Instagram, Music, Video, ExternalLink, Scale, Home as HomeIcon, Gavel } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

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
        {/* Hero Section with Profile */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/20 via-primary/10 to-transparent p-8 border border-primary/20">
          <div className="flex items-center gap-6">
            <Avatar className="w-20 h-20 border-4 border-primary/30">
              <AvatarImage src={profile?.avatar_url || ''} />
              <AvatarFallback className="text-2xl font-bold bg-primary/20">
                {profile?.full_name?.charAt(0) || 'U'}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <h1 className="text-4xl font-bold text-foreground mb-2">
                Olá, {profile?.full_name?.split(' ')[0]}! 👋
              </h1>
              <p className="text-muted-foreground text-lg">
                {profile?.position === 'socio' && 'Sócio'}
                {profile?.position === 'advogado' && 'Advogado'}
                {profile?.position === 'estagiario' && 'Estagiário'}
                {profile?.position === 'comercial' && 'Comercial'}
                {profile?.position === 'administrativo' && 'Administrativo'}
                {' '}- Egg Nunes Advogados
              </p>
            </div>
          </div>
        </div>

        {/* About Section */}
        <Card className="border-l-4 border-l-primary">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Scale className="w-5 h-5 text-primary" />
              Sobre o Escritório
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-foreground leading-relaxed">
              <strong>Egg Nunes Advogados Associados</strong> é um escritório de advocacia referência 
              desde 1994, com atuação em todo o Brasil. Especializado em diversas áreas do direito, 
              o escritório conta com uma equipe qualificada para atender as demandas de seus clientes 
              com excelência e dedicação.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button variant="outline" size="sm" asChild>
                <a href="https://www.eggnunes.com.br/nossa-equipe" target="_blank" rel="noopener noreferrer" className="gap-2">
                  <ExternalLink className="w-4 h-4" />
                  Nossa Equipe
                </a>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <a href="https://www.eggnunes.com.br/blog" target="_blank" rel="noopener noreferrer" className="gap-2">
                  <ExternalLink className="w-4 h-4" />
                  Blog
                </a>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <a href="https://wa.me/5547988887771" target="_blank" rel="noopener noreferrer" className="gap-2">
                  <ExternalLink className="w-4 h-4" />
                  WhatsApp
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Tools Section */}
        <div>
          <h2 className="text-2xl font-bold text-foreground mb-4 flex items-center gap-2">
            <FileText className="w-6 h-6 text-primary" />
            Ferramentas Disponíveis
          </h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Card className="hover:shadow-xl transition-all hover:scale-105 cursor-pointer border-2 hover:border-primary" onClick={() => navigate('/tools/rotadoc')}>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-gradient-to-br from-primary to-primary/60 rounded-xl flex items-center justify-center shadow-lg">
                    <FileText className="w-6 h-6 text-primary-foreground" />
                  </div>
                  <div>
                    <CardTitle>RotaDoc</CardTitle>
                    <CardDescription>IA para Documentos</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  Rotação automática e organização inteligente de documentos com IA
                </p>
                <Button className="w-full" variant="default">Acessar</Button>
              </CardContent>
            </Card>

            <Card className="hover:shadow-xl transition-all hover:scale-105 cursor-pointer border-2 hover:border-primary" onClick={() => navigate('/forum')}>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg">
                    <MessageSquare className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <CardTitle>Fórum</CardTitle>
                    <CardDescription>Discussões da Equipe</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  Participe de discussões e compartilhe ideias com a equipe
                </p>
                <Button className="w-full" variant="default">Acessar</Button>
              </CardContent>
            </Card>

            <Card className="hover:shadow-xl transition-all hover:scale-105 cursor-pointer border-2 hover:border-primary" onClick={() => navigate('/documentos-uteis')}>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-green-600 rounded-xl flex items-center justify-center shadow-lg">
                    <FileStack className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <CardTitle>Documentos</CardTitle>
                    <CardDescription>Arquivos Importantes</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  Acesse manuais, escalas e documentos do escritório
                </p>
                <Button className="w-full" variant="default">Acessar</Button>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Practice Areas */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Gavel className="w-5 h-5 text-primary" />
              Áreas de Atuação
            </CardTitle>
            <CardDescription>Especialidades do escritório</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="p-4 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                <h3 className="font-semibold text-foreground mb-2 flex items-center gap-2">
                  <HomeIcon className="w-4 h-4 text-primary" />
                  Direito Imobiliário
                </h3>
                <p className="text-sm text-muted-foreground mb-3">
                  Especializado em multipropriedade, rescisões com multa abusiva e atraso na entrega de obras.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button variant="link" size="sm" className="h-auto p-0" asChild>
                    <a href="https://meudireitoimobiliario.com.br/" target="_blank" rel="noopener noreferrer">
                      Site Principal
                    </a>
                  </Button>
                  <span className="text-muted-foreground">•</span>
                  <Button variant="link" size="sm" className="h-auto p-0" asChild>
                    <a href="https://meudireitoimobiliario.com.br/atraso-de-obra" target="_blank" rel="noopener noreferrer">
                      Atraso de Obra
                    </a>
                  </Button>
                  <span className="text-muted-foreground">•</span>
                  <Button variant="link" size="sm" className="h-auto p-0" asChild>
                    <a href="https://meudireitoimobiliario.com.br/cancelamento-cota-resort/" target="_blank" rel="noopener noreferrer">
                      Multipropriedade
                    </a>
                  </Button>
                </div>
              </div>
              <div className="p-4 rounded-lg bg-muted/50">
                <h3 className="font-semibold text-foreground mb-2">Outras Áreas</h3>
                <p className="text-sm text-muted-foreground">
                  Atuação em diversas outras áreas do direito. Visite nosso site para conhecer todas as especialidades.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Social Media Links */}
        <Card>
          <CardHeader>
            <CardTitle>Redes Sociais do Escritório</CardTitle>
            <CardDescription>Acompanhe nossos conteúdos</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              <Button variant="outline" size="sm" asChild className="gap-2">
                <a href="https://www.instagram.com/eggnunesadvogados/" target="_blank" rel="noopener noreferrer">
                  <Instagram className="w-4 h-4" />
                  @eggnunesadvogados
                </a>
              </Button>
              <Button variant="outline" size="sm" asChild className="gap-2">
                <a href="https://www.instagram.com/eggnunesimobiliario/" target="_blank" rel="noopener noreferrer">
                  <Instagram className="w-4 h-4" />
                  @eggnunesimobiliario
                </a>
              </Button>
              <Button variant="outline" size="sm" asChild className="gap-2">
                <a href="https://www.tiktok.com/@eggnunesadvogados" target="_blank" rel="noopener noreferrer">
                  <Video className="w-4 h-4" />
                  TikTok
                </a>
              </Button>
              <Button variant="outline" size="sm" asChild className="gap-2">
                <a href="https://www.youtube.com/@eggnunesadvogados" target="_blank" rel="noopener noreferrer">
                  <Video className="w-4 h-4" />
                  YouTube
                </a>
              </Button>
              <Button variant="outline" size="sm" asChild className="gap-2">
                <a href="https://open.spotify.com/playlist/3ls9lyJm5P29xSn2b4utdn" target="_blank" rel="noopener noreferrer">
                  <Music className="w-4 h-4" />
                  Spotify
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
