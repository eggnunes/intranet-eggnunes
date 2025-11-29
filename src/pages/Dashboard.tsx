import { useNavigate } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { useUserRole } from '@/hooks/useUserRole';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileText, MessageSquare, History, FolderOpen, TrendingUp, User, Mail, Book, Phone, Users, Instagram, Music, Video, Scale, Building2, Home, Briefcase, Award, ExternalLink, Shield, Gavel, FileCheck, Banknote, Clock, AlertCircle } from 'lucide-react';
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
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary via-purple-600 to-pink-600 p-12 text-white shadow-2xl">
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAxMCAwIEwgMCAwIDAgMTAiIGZpbGw9Im5vbmUiIHN0cm9rZT0id2hpdGUiIHN0cm9rZS13aWR0aD0iMC41IiBvcGFjaXR5PSIwLjEiLz48L3BhdHRlcm4+PC9kZWZzPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9InVybCgjZ3JpZCkiLz48L3N2Zz4=')] opacity-20"></div>
          <div className="relative z-10 flex items-center justify-between">
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <Avatar className="h-20 w-20 border-4 border-white/20 shadow-xl">
                  <AvatarImage src={profile?.avatar_url} />
                  <AvatarFallback className="bg-white/20 text-white text-2xl">
                    <User className="h-10 w-10" />
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h1 className="text-5xl font-black tracking-tight">
                    Olá, {profile?.full_name?.split(' ')[0]}!
                  </h1>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge className="bg-white/20 text-white border-white/30 text-sm">
                      {profile?.position === 'socio' && '👔 Sócio'}
                      {profile?.position === 'advogado' && '⚖️ Advogado'}
                      {profile?.position === 'estagiario' && '📚 Estagiário'}
                      {profile?.position === 'comercial' && '💼 Comercial'}
                      {profile?.position === 'administrativo' && '🏢 Administrativo'}
                    </Badge>
                  </div>
                </div>
              </div>
              <p className="text-xl text-white/90 max-w-2xl">
                Bem-vindo à Intranet Egg Nunes! Seu hub de ferramentas e recursos.
              </p>
            </div>
            <Scale className="h-32 w-32 text-white/10" />
          </div>
        </div>

        {/* Ferramentas */}
        <section>
          <h2 className="text-3xl font-bold mb-6 flex items-center gap-3">
            <Briefcase className="h-8 w-8 text-primary" />
            Ferramentas da Intranet
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {tools.map((tool) => (
              <Card
                key={tool.path}
                className="group hover:shadow-2xl transition-all duration-300 cursor-pointer border-2 hover:scale-105 overflow-hidden"
                onClick={() => navigate(tool.path)}
              >
                <div className={`h-2 bg-gradient-to-r ${tool.gradient}`}></div>
                <CardHeader>
                  <div className="flex items-center gap-4">
                    <div className={`p-4 rounded-xl bg-gradient-to-br ${tool.gradient} text-white shadow-lg group-hover:scale-110 transition-transform`}>
                      <tool.icon className="h-8 w-8" />
                    </div>
                    <div className="flex-1">
                      <CardTitle className="text-xl group-hover:text-primary transition-colors">
                        {tool.title}
                      </CardTitle>
                      <CardDescription className="text-sm mt-1">
                        {tool.description}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
              </Card>
            ))}
          </div>
        </section>

        <Separator className="my-8" />

        {/* Direito para Servidores Públicos - Área Principal */}
        <section>
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-4xl font-black bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent flex items-center gap-3">
                <Shield className="h-10 w-10 text-primary" />
                Direito para Servidores Públicos
              </h2>
              <p className="text-muted-foreground text-lg mt-2">Nossa principal área de atuação</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {servidorPublicoAreas.map((area) => (
              <a
                key={area.title}
                href={area.link}
                target="_blank"
                rel="noopener noreferrer"
                className="group"
              >
                <Card className={`h-full ${area.color} text-white border-none hover:shadow-2xl transition-all duration-300 hover:scale-105`}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-2xl font-bold text-white flex items-center gap-2">
                          <area.icon className="h-6 w-6" />
                          {area.title}
                        </CardTitle>
                        <CardDescription className="text-white/90 mt-2 text-sm">
                          {area.description}
                        </CardDescription>
                      </div>
                      <ExternalLink className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </CardHeader>
                </Card>
              </a>
            ))}
          </div>
        </section>

        <Separator className="my-8" />

        {/* Direito Imobiliário */}
        <section>
          <h2 className="text-3xl font-bold mb-6 flex items-center gap-3">
            <Home className="h-8 w-8 text-primary" />
            Direito Imobiliário
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {imobiliarioProducts.map((product) => (
              <a
                key={product.title}
                href={product.link}
                target="_blank"
                rel="noopener noreferrer"
                className="group"
              >
                <Card className="hover:shadow-xl transition-all duration-300 hover:scale-105 border-2 border-primary/20 hover:border-primary">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-xl group-hover:text-primary transition-colors">
                          {product.title}
                        </CardTitle>
                        <CardDescription className="mt-1">
                          {product.description}
                        </CardDescription>
                      </div>
                      <ExternalLink className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                    </div>
                  </CardHeader>
                </Card>
              </a>
            ))}
          </div>
        </section>

        <Separator className="my-8" />

        {/* Links Úteis */}
        <section>
          <h2 className="text-3xl font-bold mb-6 flex items-center gap-3">
            <Users className="h-8 w-8 text-primary" />
            Links Úteis do Escritório
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="hover:shadow-xl transition-all duration-300">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Users className="h-5 w-5 text-primary" />
                  Nossa Equipe
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Button
                  className="w-full"
                  variant="outline"
                  onClick={() => window.open('https://www.eggnunes.com.br/#equipe', '_blank')}
                >
                  Conhecer a Equipe
                  <ExternalLink className="h-4 w-4 ml-2" />
                </Button>
              </CardContent>
            </Card>

            <Card className="hover:shadow-xl transition-all duration-300">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Book className="h-5 w-5 text-primary" />
                  Blog
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Button
                  className="w-full"
                  variant="outline"
                  onClick={() => window.open('https://www.eggnunes.com.br/blog/', '_blank')}
                >
                  Acessar Blog
                  <ExternalLink className="h-4 w-4 ml-2" />
                </Button>
              </CardContent>
            </Card>

            <Card className="hover:shadow-xl transition-all duration-300">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Phone className="h-5 w-5 text-primary" />
                  WhatsApp
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Button
                  className="w-full"
                  variant="outline"
                  onClick={() => window.open('https://api.whatsapp.com/send/?phone=553132268742', '_blank')}
                >
                  Enviar Mensagem
                  <ExternalLink className="h-4 w-4 ml-2" />
                </Button>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Redes Sociais */}
        <section>
          <h2 className="text-3xl font-bold mb-6">Nossas Redes Sociais</h2>
          <div className="flex flex-wrap gap-4">
            {socialLinks.map((social) => (
              <Button
                key={social.url}
                variant="outline"
                size="lg"
                className="hover:scale-105 transition-transform"
                onClick={() => window.open(social.url, '_blank')}
              >
                <social.icon className="h-5 w-5 mr-2" />
                {social.label}
              </Button>
            ))}
          </div>
        </section>
      </div>
    </Layout>
  );
}
