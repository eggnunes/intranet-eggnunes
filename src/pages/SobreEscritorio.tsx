import { Layout } from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Building2, 
  Users, 
  Book, 
  Phone, 
  Mail, 
  Shield, 
  Gavel, 
  FileCheck, 
  Banknote, 
  Award, 
  Home, 
  ExternalLink,
  Instagram,
  Music,
  Video,
  Trophy,
  MapPin,
  Sparkles,
  Scale,
  Calendar,
  Target
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

export default function SobreEscritorio() {
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

  const Facebook = () => (
    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
    </svg>
  );

  const socialLinks = [
    { icon: Instagram, url: 'https://www.instagram.com/eggnunesadvogados/', label: '@eggnunesadvogados' },
    { icon: Instagram, url: 'https://www.instagram.com/eggnunesimobiliario/', label: '@eggnunesimobiliario' },
    { icon: Facebook, url: 'https://www.facebook.com/eggnunesadvogados', label: 'Facebook' },
    { icon: Video, url: 'https://www.tiktok.com/@eggnunesadvogados', label: 'TikTok' },
    { icon: Video, url: 'https://www.youtube.com/@eggnunesadvogados', label: 'YouTube' },
    { icon: Music, url: 'https://open.spotify.com/playlist/3ls9lyJm5P29xSn2b4utdn?si=9Q05p_LDQ7m_7MFykTWjHA&pi=u-UA0rmOZ-RBiM', label: 'Spotify' },
  ];

  return (
    <Layout>
      <div className="space-y-12">
        {/* Header */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/15 via-accent/10 to-primary/5 p-8 border border-primary/20 shadow-md">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,hsl(221_83%_53%/0.1),transparent_50%)]"></div>
          <div className="relative">
            <div className="flex items-center gap-4 mb-4">
              <div className="p-3 rounded-xl bg-primary/10">
                <Building2 className="h-8 w-8 text-primary" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-foreground">Sobre o Escritório</h1>
                <p className="text-muted-foreground">Egg Nunes Advogados Associados</p>
              </div>
            </div>
          </div>
        </div>

        {/* Sobre Nós */}
        <Card className="border-l-4 border-l-primary">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-primary" />
              Quem Somos
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-foreground/80 leading-relaxed">
              <strong>Egg Nunes Advogados Associados</strong> é um escritório de advocacia referência 
              desde 1994, com atuação em todo o Brasil. Especializado em diversas áreas do direito, 
              o escritório conta com uma equipe qualificada para atender as demandas de seus clientes 
              com excelência e dedicação.
            </p>
            <p className="text-foreground/80 leading-relaxed">
              Com mais de <strong>30 anos de história</strong>, o escritório se destaca pela combinação de experiência 
              jurídica sólida com a adoção de tecnologias inovadoras, incluindo Inteligência Artificial, 
              para proporcionar um atendimento ainda mais eficiente aos seus clientes.
            </p>
            
            {/* Diferenciais */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4">
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <Calendar className="h-5 w-5 text-primary" />
                <div>
                  <p className="font-semibold text-sm">+30 anos</p>
                  <p className="text-xs text-muted-foreground">de experiência</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <Scale className="h-5 w-5 text-primary" />
                <div>
                  <p className="font-semibold text-sm">Atuação Nacional</p>
                  <p className="text-xs text-muted-foreground">em todo o Brasil</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <Target className="h-5 w-5 text-primary" />
                <div>
                  <p className="font-semibold text-sm">Especialistas</p>
                  <p className="text-xs text-muted-foreground">em Direito Público</p>
                </div>
              </div>
            </div>

            {/* Missão e Valores */}
            <div className="pt-4 space-y-3">
              <h4 className="font-semibold text-foreground flex items-center gap-2">
                <Shield className="h-4 w-4 text-primary" />
                Nossa Missão
              </h4>
              <p className="text-foreground/70 text-sm leading-relaxed">
                Defender com excelência os direitos de nossos clientes, especialmente servidores públicos 
                civis e militares, oferecendo assessoria jurídica de alta qualidade, com ética, transparência 
                e compromisso com resultados.
              </p>
            </div>

            <div className="flex flex-wrap gap-2 pt-4">
              <Button variant="outline" size="sm" asChild>
                <a href="https://www.eggnunes.com.br" target="_blank" rel="noopener noreferrer" className="gap-2">
                  <ExternalLink className="w-4 h-4" />
                  Site Oficial
                </a>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <a href="https://www.eggnunes.com.br/#equipe" target="_blank" rel="noopener noreferrer" className="gap-2">
                  <Users className="w-4 h-4" />
                  Nossa Equipe
                </a>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <a href="https://www.eggnunes.com.br/blog" target="_blank" rel="noopener noreferrer" className="gap-2">
                  <Book className="w-4 h-4" />
                  Blog
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Prêmios e Reconhecimentos */}
        <Card className="border-l-4 border-l-amber-500">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="w-5 h-5 text-amber-600" />
              Prêmios e Reconhecimentos
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Prêmio Law Summit 2024 */}
            <div className="flex items-start gap-4 p-4 rounded-lg bg-gradient-to-br from-amber-500/10 to-orange-500/5 border border-amber-200/50">
              <div className="p-3 rounded-lg bg-amber-500/20">
                <Trophy className="h-6 w-6 text-amber-600" />
              </div>
              <div>
                <h3 className="font-semibold text-lg text-foreground">Melhor Escritório em Direito Administrativo e Militar do Brasil</h3>
                <p className="text-muted-foreground text-sm">Law Summit 2024 - Safe Experience</p>
                <p className="text-foreground/70 mt-2 text-sm">
                  Reconhecimento como o melhor escritório de advocacia do Brasil nas áreas de Direito Administrativo 
                  e Direito Militar, concedido pela Law Summit, o maior evento sobre tecnologia e gestão jurídica 
                  da América Latina.
                </p>
              </div>
            </div>

            {/* Prêmio IA 2025 */}
            <div className="flex items-start gap-4 p-4 rounded-lg bg-gradient-to-br from-primary/10 to-accent/5 border border-primary/20">
              <div className="p-3 rounded-lg bg-primary/20">
                <Sparkles className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-lg text-foreground">Prêmio Inovação em Inteligência Artificial</h3>
                <p className="text-muted-foreground text-sm">Law Summit 2025</p>
                <p className="text-foreground/70 mt-2 text-sm">
                  Reconhecimento pela implementação pioneira de Inteligência Artificial na advocacia, 
                  desenvolvendo soluções próprias para automatização e otimização de processos jurídicos.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Separator />

        {/* Áreas de Atuação - Servidor Público */}
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
                'from-emerald-500/10 to-emerald-600/5 hover:from-emerald-500/20 hover:to-emerald-600/10 hover:border-emerald-500/40 hover:shadow-emerald-500/20',
                'from-blue-500/10 to-blue-600/5 hover:from-blue-500/20 hover:to-blue-600/10 hover:border-blue-500/40 hover:shadow-blue-500/20',
                'from-red-500/10 to-red-600/5 hover:from-red-500/20 hover:to-red-600/10 hover:border-red-500/40 hover:shadow-red-500/20',
                'from-purple-500/10 to-purple-600/5 hover:from-purple-500/20 hover:to-purple-600/10 hover:border-purple-500/40 hover:shadow-purple-500/20',
                'from-cyan-500/10 to-cyan-600/5 hover:from-cyan-500/20 hover:to-cyan-600/10 hover:border-cyan-500/40 hover:shadow-cyan-500/20',
                'from-teal-500/10 to-teal-600/5 hover:from-teal-500/20 hover:to-teal-600/10 hover:border-teal-500/40 hover:shadow-teal-500/20',
              ];
              const iconBgColors = [
                'bg-emerald-100 text-emerald-700 group-hover:bg-emerald-200',
                'bg-blue-100 text-blue-700 group-hover:bg-blue-200',
                'bg-red-100 text-red-700 group-hover:bg-red-200',
                'bg-purple-100 text-purple-700 group-hover:bg-purple-200',
                'bg-cyan-100 text-cyan-700 group-hover:bg-cyan-200',
                'bg-teal-100 text-teal-700 group-hover:bg-teal-200',
              ];
              return (
                <a
                  key={area.title}
                  href={area.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group"
                >
                  <Card className={`h-full bg-gradient-to-br ${bgColors[idx]} hover:shadow-xl hover:-translate-y-1 transition-all duration-300 border`}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <CardTitle className="text-lg flex items-center gap-2">
                            <div className={`p-2 rounded-lg transition-all duration-300 ${iconBgColors[idx]}`}>
                              <area.icon className="h-4 w-4 group-hover:scale-110 transition-transform" />
                            </div>
                            <span className="group-hover:text-primary transition-colors">{area.title}</span>
                          </CardTitle>
                          <CardDescription className="mt-2 text-xs">
                            {area.description}
                          </CardDescription>
                        </div>
                        <ExternalLink className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:scale-110 transition-all flex-shrink-0" />
                      </div>
                    </CardHeader>
                  </Card>
                </a>
              );
            })}
          </div>
        </section>

        <Separator />

        {/* Direito Imobiliário */}
        <section>
          <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gradient-to-br from-amber-500/20 to-orange-500/20">
              <Home className="h-5 w-5 text-amber-700" />
            </div>
            Direito Imobiliário
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {imobiliarioProducts.map((product, idx) => {
              const bgColors = [
                'from-amber-500/10 to-amber-600/5 hover:from-amber-500/20 hover:to-amber-600/10 hover:border-amber-500/40 hover:shadow-amber-500/20',
                'from-orange-500/10 to-orange-600/5 hover:from-orange-500/20 hover:to-orange-600/10 hover:border-orange-500/40 hover:shadow-orange-500/20',
                'from-rose-500/10 to-rose-600/5 hover:from-rose-500/20 hover:to-rose-600/10 hover:border-rose-500/40 hover:shadow-rose-500/20',
                'from-red-500/10 to-red-600/5 hover:from-red-500/20 hover:to-red-600/10 hover:border-red-500/40 hover:shadow-red-500/20',
              ];
              const iconBgColors = [
                'bg-amber-100 text-amber-700 group-hover:bg-amber-200',
                'bg-orange-100 text-orange-700 group-hover:bg-orange-200',
                'bg-rose-100 text-rose-700 group-hover:bg-rose-200',
                'bg-red-100 text-red-700 group-hover:bg-red-200',
              ];
              const icons = [Home, Building2, Award, FileCheck];
              const Icon = icons[idx];
              return (
                <a
                  key={product.title}
                  href={product.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group"
                >
                  <Card className={`h-full bg-gradient-to-br ${bgColors[idx]} hover:shadow-xl hover:-translate-y-1 transition-all duration-300 border`}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <CardTitle className="text-base flex items-center gap-2">
                            <div className={`p-2 rounded-lg transition-all duration-300 ${iconBgColors[idx]}`}>
                              <Icon className="h-4 w-4 group-hover:scale-110 transition-transform" />
                            </div>
                            <span className="group-hover:text-primary transition-colors">{product.title}</span>
                          </CardTitle>
                          <CardDescription className="mt-2 text-xs">
                            {product.description}
                          </CardDescription>
                        </div>
                        <ExternalLink className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:scale-110 transition-all flex-shrink-0" />
                      </div>
                    </CardHeader>
                  </Card>
                </a>
              );
            })}
          </div>
        </section>

        <Separator />

        {/* Contatos */}
        <Card className="border-l-4 border-l-green-500">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Phone className="w-5 h-5 text-green-600" />
              Contatos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Button variant="outline" size="lg" className="h-auto py-4 flex-col gap-2" asChild>
                <a href="https://api.whatsapp.com/send/?phone=553132268742" target="_blank" rel="noopener noreferrer">
                  <Phone className="w-5 h-5 text-green-600" />
                  <span className="text-sm font-medium">(31) 3226-8742</span>
                  <span className="text-xs text-muted-foreground">WhatsApp</span>
                </a>
              </Button>
              <Button variant="outline" size="lg" className="h-auto py-4 flex-col gap-2" asChild>
                <a href="mailto:escritorio@eggnunes.com.br">
                  <Mail className="w-5 h-5 text-primary" />
                  <span className="text-sm font-medium">E-mail</span>
                  <span className="text-xs text-muted-foreground">escritorio@eggnunes.com.br</span>
                </a>
              </Button>
              <Button variant="outline" size="lg" className="h-auto py-4 flex-col gap-2" asChild>
                <a href="https://www.eggnunes.com.br" target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="w-5 h-5 text-primary" />
                  <span className="text-sm font-medium">Site</span>
                  <span className="text-xs text-muted-foreground">eggnunes.com.br</span>
                </a>
              </Button>
              <Button variant="outline" size="lg" className="h-auto py-4 flex-col gap-2" asChild>
                <a href="https://maps.google.com/?q=Egg+Nunes+Advogados+Belo+Horizonte" target="_blank" rel="noopener noreferrer">
                  <MapPin className="w-5 h-5 text-red-500" />
                  <span className="text-sm font-medium">Endereço</span>
                  <span className="text-xs text-muted-foreground">Belo Horizonte - MG</span>
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>

        <Separator />

        {/* Redes Sociais */}
        <section>
          <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gradient-to-br from-pink-500/20 to-purple-500/20">
              <Instagram className="h-5 w-5 text-pink-600" />
            </div>
            Nossas Redes Sociais
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {socialLinks.map((social) => (
              <Button
                key={social.url}
                variant="outline"
                className="h-auto py-4 flex-col gap-2 hover:border-primary hover:shadow-md hover:-translate-y-0.5 hover:bg-primary/10 transition-all duration-300 group"
                onClick={() => window.open(social.url, '_blank')}
              >
                <social.icon className="h-6 w-6 text-foreground group-hover:text-primary group-hover:scale-110 transition-all" />
                <span className="text-xs text-foreground group-hover:text-primary transition-colors">{social.label}</span>
              </Button>
            ))}
          </div>
        </section>
      </div>
    </Layout>
  );
}
