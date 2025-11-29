import { useNavigate } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { useUserRole } from '@/hooks/useUserRole';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileText, MessageSquare, History, FolderOpen, TrendingUp, User, Mail, Book, Phone, Users, Instagram, Music, Video, Building2, Home, Briefcase, Award, ExternalLink, Shield, Gavel, FileCheck, Banknote, Clock, AlertCircle } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function Dashboard() {
  const navigate = useNavigate();
  const { profile, loading, isApproved } = useUserRole();

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

  const tools = [
    {
      title: 'RotaDoc',
      description: 'Rotação e Organização Inteligente de Documentos',
      icon: FileText,
      path: '/tools/rotadoc',
      gradient: 'from-violet-500 to-purple-600',
    },
    {
      title: 'Sugestões',
      description: 'Envie melhorias para a intranet e escritório',
      icon: TrendingUp,
      path: '/sugestoes',
      gradient: 'from-blue-500 to-cyan-500',
    },
    {
      title: 'Fórum',
      description: 'Discussões e conversas da equipe',
      icon: MessageSquare,
      path: '/forum',
      gradient: 'from-emerald-500 to-teal-500',
    },
    {
      title: 'Histórico',
      description: 'Acompanhe suas atividades',
      icon: History,
      path: '/historico',
      gradient: 'from-orange-500 to-red-500',
    },
    {
      title: 'Documentos Úteis',
      description: 'Acesse documentos importantes',
      icon: FolderOpen,
      path: '/documentos-uteis',
      gradient: 'from-pink-500 to-rose-500',
    },
  ];

  const servidorPublicoAreas = [
    {
      title: 'Isenção de Imposto de Renda',
      description: 'Para aposentados e pensionistas com doenças graves',
      icon: Banknote,
      link: 'https://isencaoimpostoderenda.com',
      color: 'bg-gradient-to-br from-green-500 to-emerald-600',
    },
    {
      title: 'Férias/Licença Prêmio',
      description: 'Conversão em dinheiro para servidores públicos',
      icon: Award,
      link: 'https://feriaspremio.com.br',
      color: 'bg-gradient-to-br from-blue-500 to-indigo-600',
    },
    {
      title: 'Direito Previdenciário Militar',
      description: 'Pensão previdenciária e benefícios militares',
      icon: Shield,
      link: 'https://www.eggnunes.com.br/areas-de-atuacao/direito-previdenciario-para-o-servidor-publico-militar/',
      color: 'bg-gradient-to-br from-red-500 to-orange-600',
    },
    {
      title: 'Servidor Público Civil',
      description: 'Transferência, remoção e direitos funcionais',
      icon: Building2,
      link: 'https://www.eggnunes.com.br/areas-de-atuacao/direito-do-servidor-publico-civil/',
      color: 'bg-gradient-to-br from-purple-500 to-pink-600',
    },
    {
      title: 'Servidor Público Militar',
      description: 'Concursos internos e recursos administrativos',
      icon: Gavel,
      link: 'https://www.eggnunes.com.br/areas-de-atuacao/direito-do-servidor-publico-militar/',
      color: 'bg-gradient-to-br from-cyan-500 to-blue-600',
    },
    {
      title: 'Concurso Público',
      description: 'Recursos administrativos e judiciais',
      icon: FileCheck,
      link: 'https://www.eggnunes.com.br/areas-de-atuacao/concurso-publico/',
      color: 'bg-gradient-to-br from-teal-500 to-green-600',
    },
  ];

  const imobiliarioProducts = [
    {
      title: 'Direito Imobiliário',
      description: 'Soluções completas em contratos imobiliários',
      link: 'https://meudireitoimobiliario.com.br/',
    },
    {
      title: 'Atraso de Obra',
      description: 'Indenização por atraso na entrega',
      link: 'https://meudireitoimobiliario.com.br/atraso-de-obra',
    },
    {
      title: 'Cancelamento Cota Resort',
      description: 'Rescisão de multipropriedade',
      link: 'https://meudireitoimobiliario.com.br/cancelamento-cota-resort/',
    },
    {
      title: 'Distrato Imobiliário',
      description: 'Rescisão sem multa abusiva',
      link: 'https://meudireitoimobiliario.com.br/distrato-imobiliario/',
    },
  ];

  const socialLinks = [
    { icon: Instagram, url: 'https://www.instagram.com/eggnunesadvogados/', label: '@eggnunesadvogados' },
    { icon: Instagram, url: 'https://www.instagram.com/eggnunesimobiliario/', label: '@eggnunesimobiliario' },
    { icon: Video, url: 'https://www.tiktok.com/@eggnunesadvogados', label: 'TikTok' },
    { icon: Video, url: 'https://www.youtube.com/@eggnunesadvogados', label: 'YouTube' },
    { icon: Music, url: 'https://open.spotify.com/playlist/3ls9lyJm5P29xSn2b4utdn?si=9Q05p_LDQ7m_7MFykTWjHA&pi=u-UA0rmOZ-RBiM', label: 'Spotify' },
  ];

  return (
    <Layout>
      <div className="space-y-12">
        {/* Hero Section */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/15 via-accent/10 to-primary/5 p-8 border border-primary/20 shadow-md">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,hsl(221_83%_53%/0.1),transparent_50%)]"></div>
          <div className="relative flex items-center gap-6">
            <Avatar className="h-20 w-20 border-4 border-primary/30 shadow-lg">
              <AvatarImage src={profile?.avatar_url} />
              <AvatarFallback className="bg-gradient-to-br from-primary/20 to-accent/20 text-primary text-2xl">
                <User className="h-10 w-10" />
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent mb-2">
                Olá, {profile?.full_name?.split(' ')[0]}!
              </h1>
              <div className="flex items-center gap-2">
                <Badge className="bg-primary/10 text-primary border-primary/20 text-sm">
                  {profile?.position === 'socio' && 'Sócio'}
                  {profile?.position === 'advogado' && 'Advogado'}
                  {profile?.position === 'estagiario' && 'Estagiário'}
                  {profile?.position === 'comercial' && 'Comercial'}
                  {profile?.position === 'administrativo' && 'Administrativo'}
                </Badge>
              </div>
            </div>
          </div>
        </div>

        {/* Ferramentas */}
        <section>
          <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gradient-to-br from-primary/20 to-accent/20">
              <Briefcase className="h-5 w-5 text-primary" />
            </div>
            Ferramentas da Intranet
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {tools.map((tool, idx) => {
              const colors = [
                'from-blue-500/10 to-blue-600/5 hover:border-blue-500/40',
                'from-purple-500/10 to-purple-600/5 hover:border-purple-500/40',
                'from-emerald-500/10 to-emerald-600/5 hover:border-emerald-500/40',
                'from-orange-500/10 to-orange-600/5 hover:border-orange-500/40',
                'from-pink-500/10 to-pink-600/5 hover:border-pink-500/40',
              ];
              const iconColors = [
                'text-blue-600',
                'text-purple-600',
                'text-emerald-600',
                'text-orange-600',
                'text-pink-600',
              ];
              return (
                <Card
                  key={tool.path}
                  className={`bg-gradient-to-br ${colors[idx]} hover:shadow-lg transition-all duration-300 cursor-pointer border`}
                  onClick={() => navigate(tool.path)}
                >
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      <div className={`p-3 rounded-lg bg-white/80 shadow-sm`}>
                        <tool.icon className={`h-5 w-5 ${iconColors[idx]}`} />
                      </div>
                      <div className="flex-1">
                        <CardTitle className="text-lg">
                          {tool.title}
                        </CardTitle>
                        <CardDescription className="text-xs mt-1">
                          {tool.description}
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                </Card>
              );
            })}
          </div>
        </section>

        <Separator className="my-8" />

        {/* Direito para Servidores Públicos - Área Principal */}
        <section>
          <div className="mb-6">
            <h2 className="text-2xl font-bold flex items-center gap-3">
              <div className="p-2 rounded-lg bg-gradient-to-br from-primary/20 to-accent/20">
                <Shield className="h-5 w-5 text-primary" />
              </div>
              Direito para Servidores Públicos
            </h2>
            <p className="text-muted-foreground text-sm mt-1">Nossa principal área de atuação</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {servidorPublicoAreas.map((area, idx) => {
              const bgColors = [
                'from-emerald-500/10 to-emerald-600/5 hover:border-emerald-500/40',
                'from-blue-500/10 to-blue-600/5 hover:border-blue-500/40',
                'from-red-500/10 to-red-600/5 hover:border-red-500/40',
                'from-purple-500/10 to-purple-600/5 hover:border-purple-500/40',
                'from-cyan-500/10 to-cyan-600/5 hover:border-cyan-500/40',
                'from-teal-500/10 to-teal-600/5 hover:border-teal-500/40',
              ];
              const iconBgColors = [
                'bg-emerald-100 text-emerald-700',
                'bg-blue-100 text-blue-700',
                'bg-red-100 text-red-700',
                'bg-purple-100 text-purple-700',
                'bg-cyan-100 text-cyan-700',
                'bg-teal-100 text-teal-700',
              ];
              return (
                <a
                  key={area.title}
                  href={area.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group"
                >
                  <Card className={`h-full bg-gradient-to-br ${bgColors[idx]} hover:shadow-lg transition-all duration-300 border`}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <CardTitle className="text-lg flex items-center gap-2">
                            <div className={`p-2 rounded-lg ${iconBgColors[idx]}`}>
                              <area.icon className="h-4 w-4" />
                            </div>
                            {area.title}
                          </CardTitle>
                          <CardDescription className="mt-2 text-xs">
                            {area.description}
                          </CardDescription>
                        </div>
                        <ExternalLink className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0" />
                      </div>
                    </CardHeader>
                  </Card>
                </a>
              );
            })}
          </div>
        </section>

        <Separator className="my-8" />

        {/* Direito Imobiliário */}
        <section>
          <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gradient-to-br from-amber-500/20 to-orange-500/20">
              <Home className="h-5 w-5 text-amber-700" />
            </div>
            Direito Imobiliário
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {imobiliarioProducts.map((product, idx) => {
              const bgColors = [
                'from-amber-500/10 to-amber-600/5 hover:border-amber-500/40',
                'from-orange-500/10 to-orange-600/5 hover:border-orange-500/40',
                'from-rose-500/10 to-rose-600/5 hover:border-rose-500/40',
                'from-red-500/10 to-red-600/5 hover:border-red-500/40',
              ];
              return (
                <a
                  key={product.title}
                  href={product.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group"
                >
                  <Card className={`h-full bg-gradient-to-br ${bgColors[idx]} hover:shadow-lg transition-all duration-300 border`}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <CardTitle className="text-lg">
                            {product.title}
                          </CardTitle>
                          <CardDescription className="mt-1 text-xs">
                            {product.description}
                          </CardDescription>
                        </div>
                        <ExternalLink className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                      </div>
                    </CardHeader>
                  </Card>
                </a>
              );
            })}
          </div>
        </section>

        <Separator className="my-8" />

        {/* Links Úteis */}
        <section>
          <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
            <Users className="h-6 w-6 text-primary" />
            Links Úteis do Escritório
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="hover:shadow-lg transition-all duration-300">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Users className="h-4 w-4 text-primary" />
                  Nossa Equipe
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Button
                  className="w-full"
                  size="sm"
                  variant="outline"
                  onClick={() => window.open('https://www.eggnunes.com.br/#equipe', '_blank')}
                >
                  Conhecer a Equipe
                  <ExternalLink className="h-3 w-3 ml-2" />
                </Button>
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-all duration-300">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Book className="h-4 w-4 text-primary" />
                  Blog
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Button
                  className="w-full"
                  size="sm"
                  variant="outline"
                  onClick={() => window.open('https://www.eggnunes.com.br/blog/', '_blank')}
                >
                  Acessar Blog
                  <ExternalLink className="h-3 w-3 ml-2" />
                </Button>
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-all duration-300">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Phone className="h-4 w-4 text-primary" />
                  WhatsApp
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Button
                  className="w-full"
                  size="sm"
                  variant="outline"
                  onClick={() => window.open('https://api.whatsapp.com/send/?phone=553132268742', '_blank')}
                >
                  Enviar Mensagem
                  <ExternalLink className="h-3 w-3 ml-2" />
                </Button>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Redes Sociais */}
        <section>
          <h2 className="text-2xl font-bold mb-6">Nossas Redes Sociais</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {socialLinks.map((social) => (
              <Button
                key={social.url}
                variant="outline"
                className="h-auto py-3 flex-col gap-2 hover:border-primary"
                onClick={() => window.open(social.url, '_blank')}
              >
                <social.icon className="h-5 w-5" />
                <span className="text-xs">{social.label}</span>
              </Button>
            ))}
          </div>
        </section>
      </div>
    </Layout>
  );
}
