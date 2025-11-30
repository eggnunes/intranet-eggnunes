import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { useUserRole } from '@/hooks/useUserRole';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileText, MessageSquare, History, FolderOpen, TrendingUp, User, Mail, Book, Phone, Users, Instagram, Music, Video, Building2, Home, Briefcase, Award, ExternalLink, Shield, Gavel, FileCheck, Banknote, Clock, AlertCircle, Cake, DollarSign, Bell, CheckSquare, Megaphone, Calendar, Trophy } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { format, getMonth, getDate } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface BirthdayProfile {
  id: string;
  full_name: string;
  avatar_url: string | null;
  birth_date: string;
  position: string | null;
}

interface Announcement {
  id: string;
  title: string;
  content: string;
  type: 'comunicado' | 'evento' | 'conquista';
  is_pinned: boolean;
  created_at: string;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { profile, loading, isApproved } = useUserRole();
  const [monthBirthdays, setMonthBirthdays] = useState<BirthdayProfile[]>([]);
  const [loadingBirthdays, setLoadingBirthdays] = useState(true);
  const [recentAnnouncements, setRecentAnnouncements] = useState<Announcement[]>([]);
  const [loadingAnnouncements, setLoadingAnnouncements] = useState(true);

  useEffect(() => {
    fetchMonthBirthdays();
    fetchRecentAnnouncements();
  }, []);

  const fetchMonthBirthdays = async () => {
    const currentMonth = getMonth(new Date());
    
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url, birth_date, position')
      .eq('approval_status', 'approved')
      .not('birth_date', 'is', null);

    if (!error && data) {
      const filtered = data.filter((p) => {
        if (p.birth_date) {
          return getMonth(new Date(p.birth_date)) === currentMonth;
        }
        return false;
      });

      // Ordenar por dia do mês
      filtered.sort((a, b) => {
        const dayA = getDate(new Date(a.birth_date!));
        const dayB = getDate(new Date(b.birth_date!));
        return dayA - dayB;
      });

      setMonthBirthdays(filtered as BirthdayProfile[]);
    }
    setLoadingBirthdays(false);
  };

  const fetchRecentAnnouncements = async () => {
    const { data, error } = await supabase
      .from('announcements')
      .select('id, title, content, type, is_pinned, created_at')
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(3);

    if (!error && data) {
      setRecentAnnouncements(data as Announcement[]);
    }
    setLoadingAnnouncements(false);
  };

  const getPositionLabel = (position: string | null) => {
    if (!position) return '';
    const positions: { [key: string]: string } = {
      socio: 'Sócio',
      advogado: 'Advogado',
      estagiario: 'Estagiário',
      comercial: 'Comercial',
      administrativo: 'Administrativo',
    };
    return positions[position] || position;
  };

  const getAnnouncementTypeInfo = (type: Announcement['type']) => {
    const types = {
      comunicado: { label: 'Comunicado', icon: Megaphone, color: 'bg-blue-500' },
      evento: { label: 'Evento', icon: Calendar, color: 'bg-green-500' },
      conquista: { label: 'Conquista', icon: Trophy, color: 'bg-amber-500' },
    };
    return types[type];
  };

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
      title: 'Agentes de IA',
      description: 'Assistentes inteligentes para seu trabalho',
      icon: TrendingUp,
      path: '/agentes-ia',
      gradient: 'from-purple-500 to-pink-500',
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

  const Facebook = () => (
    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
    </svg>
  );

  const toolLinks = [
    { icon: FileText, url: 'https://app.advbox.com.br/login', label: 'Advbox', description: 'Gestão Processual' },
    { icon: MessageSquare, url: 'https://s17.chatguru.app/', label: 'ChatGuru', description: 'Sistema de WhatsApp' },
    { icon: Users, url: 'https://accounts.rdstation.com/?locale=pt-BR&trial_origin=rds--header-login', label: 'RD Station CRM', description: 'CRM' },
    { icon: Mail, url: 'https://outlook.office.com/mail/', label: 'E-mail', description: 'Outlook' },
    { icon: Video, url: 'https://teams.microsoft.com/v2/', label: 'Microsoft Teams', description: 'Arquivos, Reuniões e Chat' },
    { icon: Building2, url: 'https://credlocaliza.com.br/', label: 'Credlocaliza', description: 'Consultas' },
  ];

  const advboxIntegrations = [
    { icon: Briefcase, path: '/processos', label: 'Processos', description: 'Dashboard de processos' },
    { icon: Cake, path: '/aniversarios-clientes', label: 'Aniversários', description: 'Clientes aniversariantes' },
    { icon: Bell, path: '/publicacoes', label: 'Publicações', description: 'Feed de publicações' },
    { icon: CheckSquare, path: '/tarefas-advbox', label: 'Tarefas', description: 'Gestão de tarefas' },
    { icon: DollarSign, path: '/relatorios-financeiros', label: 'Financeiro', description: 'Relatórios financeiros' },
  ];


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
        {/* Hero Section */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/15 via-accent/10 to-primary/5 p-8 border border-primary/20 shadow-md">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,hsl(221_83%_53%/0.1),transparent_50%)]"></div>
          <div className="relative flex items-center gap-6">
            <div className="flex flex-col items-center gap-2">
              <Avatar className="h-24 w-24 border-4 border-primary/30 shadow-lg">
                <AvatarImage src={profile?.avatar_url} />
                <AvatarFallback className="bg-gradient-to-br from-primary/20 to-accent/20 text-primary text-2xl">
                  <User className="h-12 w-12" />
                </AvatarFallback>
              </Avatar>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/profile')}
                className="text-xs text-primary hover:text-primary/80 hover:bg-primary/10"
              >
                Editar perfil
              </Button>
            </div>
            <div className="flex-1">
              <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent mb-2">
                Olá, {profile?.full_name?.split(' ')[0]}!
              </h1>
              <p className="text-foreground/80 text-lg mb-3">
                Seja bem-vindo à Intranet Egg Nunes! Acesse suas ferramentas e recursos.
              </p>
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

        {/* Mural de Avisos - Destaques */}
        {!loadingAnnouncements && recentAnnouncements.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold flex items-center gap-3">
                <div className="p-2 rounded-lg bg-gradient-to-br from-primary/20 to-accent/20">
                  <Megaphone className="h-5 w-5 text-primary" />
                </div>
                Avisos Recentes
              </h2>
              <Button variant="outline" size="sm" onClick={() => navigate('/mural-avisos')}>
                Ver todos
              </Button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {recentAnnouncements.map((announcement) => {
                const typeInfo = getAnnouncementTypeInfo(announcement.type);
                const TypeIcon = typeInfo.icon;
                return (
                  <Card 
                    key={announcement.id}
                    className="hover:shadow-lg hover:-translate-y-1 transition-all duration-300 cursor-pointer border-l-4"
                    style={{ borderLeftColor: `hsl(var(--primary))` }}
                    onClick={() => navigate('/mural-avisos')}
                  >
                    <CardHeader>
                      <div className="flex items-start gap-3">
                        <div className={`p-2 rounded-lg ${typeInfo.color} text-white`}>
                          <TypeIcon className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <Badge variant="secondary" className="mb-2">{typeInfo.label}</Badge>
                          <CardTitle className="text-lg line-clamp-2">{announcement.title}</CardTitle>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground line-clamp-3">{announcement.content}</p>
                      <p className="text-xs text-muted-foreground mt-3">
                        {format(new Date(announcement.created_at), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                      </p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </section>
        )}

        <Separator className="my-8" />

        {/* Sobre o Escritório */}
        <Card className="border-l-4 border-l-primary">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-primary" />
              Sobre o Escritório
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-foreground/80 leading-relaxed">
              <strong>Egg Nunes Advogados Associados</strong> é um escritório de advocacia referência 
              desde 1994, com atuação em todo o Brasil. Especializado em diversas áreas do direito, 
              o escritório conta com uma equipe qualificada para atender as demandas de seus clientes 
              com excelência e dedicação.
            </p>
            <div className="flex flex-wrap gap-2">
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
              <Button variant="outline" size="sm" asChild>
                <a href="https://api.whatsapp.com/send/?phone=553132268742" target="_blank" rel="noopener noreferrer" className="gap-2">
                  <Phone className="w-4 h-4" />
                  WhatsApp: (31) 3226-8742
                </a>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <a href="mailto:escritorio@eggnunes.com.br" className="gap-2">
                  <Mail className="w-4 h-4" />
                  E-mail
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>

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
                'from-violet-500/10 to-violet-600/5 hover:from-violet-500/20 hover:to-violet-600/10 hover:border-violet-500/40 hover:shadow-violet-500/20',
                'from-purple-500/10 to-pink-500/5 hover:from-purple-500/20 hover:to-pink-500/10 hover:border-purple-500/40 hover:shadow-purple-500/20',
                'from-blue-500/10 to-blue-600/5 hover:from-blue-500/20 hover:to-blue-600/10 hover:border-blue-500/40 hover:shadow-blue-500/20',
                'from-emerald-500/10 to-emerald-600/5 hover:from-emerald-500/20 hover:to-emerald-600/10 hover:border-emerald-500/40 hover:shadow-emerald-500/20',
                'from-pink-500/10 to-pink-600/5 hover:from-pink-500/20 hover:to-pink-600/10 hover:border-pink-500/40 hover:shadow-pink-500/20',
              ];
              const iconColors = [
                'text-violet-600',
                'text-purple-600',
                'text-blue-600',
                'text-emerald-600',
                'text-pink-600',
              ];
              return (
                <Card
                  key={tool.path}
                  className={`bg-gradient-to-br ${colors[idx]} hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer border group`}
                  onClick={() => navigate(tool.path)}
                >
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      <div className={`p-3 rounded-lg bg-white/80 shadow-sm group-hover:scale-110 transition-transform duration-300`}>
                        <tool.icon className={`h-5 w-5 ${iconColors[idx]}`} />
                      </div>
                      <div className="flex-1">
                        <CardTitle className="text-lg group-hover:text-primary transition-colors">
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

        {/* Ferramentas do Escritório */}
        <section>
          <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gradient-to-br from-primary/20 to-accent/20">
              <Building2 className="h-5 w-5 text-primary" />
            </div>
            Ferramentas do Escritório
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {toolLinks.map((tool) => (
              <Card key={tool.url} className="hover:shadow-lg hover:-translate-y-1 transition-all duration-300 cursor-pointer group">
                <a href={tool.url} target="_blank" rel="noopener noreferrer">
                  <CardContent className="p-6">
                    <div className="flex items-start gap-4">
                      <div className="p-3 rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors">
                        <tool.icon className="w-6 h-6 text-primary" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold text-lg mb-1 group-hover:text-primary transition-colors">{tool.label}</h3>
                        <p className="text-sm text-muted-foreground">{tool.description}</p>
                      </div>
                    </div>
                  </CardContent>
                </a>
              </Card>
            ))}
          </div>
        </section>

        <Separator className="my-8" />

        {/* Integrações Advbox */}
        <section>
          <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gradient-to-br from-primary/20 to-accent/20">
              <FileText className="h-5 w-5 text-primary" />
            </div>
            Integrações Advbox
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {advboxIntegrations.map((tool, idx) => {
              const colors = [
                'from-violet-500/10 to-violet-600/5 hover:from-violet-500/20 hover:to-violet-600/10 hover:border-violet-500/40 hover:shadow-violet-500/20',
                'from-pink-500/10 to-pink-600/5 hover:from-pink-500/20 hover:to-pink-600/10 hover:border-pink-500/40 hover:shadow-pink-500/20',
                'from-blue-500/10 to-blue-600/5 hover:from-blue-500/20 hover:to-blue-600/10 hover:border-blue-500/40 hover:shadow-blue-500/20',
                'from-emerald-500/10 to-emerald-600/5 hover:from-emerald-500/20 hover:to-emerald-600/10 hover:border-emerald-500/40 hover:shadow-emerald-500/20',
                'from-amber-500/10 to-amber-600/5 hover:from-amber-500/20 hover:to-amber-600/10 hover:border-amber-500/40 hover:shadow-amber-500/20',
              ];
              const iconColors = [
                'text-violet-600',
                'text-pink-600',
                'text-blue-600',
                'text-emerald-600',
                'text-amber-600',
              ];
              return (
                <Card
                  key={tool.path}
                  className={`bg-gradient-to-br ${colors[idx]} hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer border group`}
                  onClick={() => navigate(tool.path)}
                >
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      <div className={`p-3 rounded-lg bg-white/80 shadow-sm group-hover:scale-110 transition-transform duration-300`}>
                        <tool.icon className={`h-5 w-5 ${iconColors[idx]}`} />
                      </div>
                      <div className="flex-1">
                        <CardTitle className="text-lg group-hover:text-primary transition-colors">
                          {tool.label}
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

        {/* Aniversariantes do Mês */}
        <section>
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-gradient-to-br from-pink-500/20 to-rose-500/20">
                <Cake className="h-5 w-5 text-pink-600" />
              </div>
              <div>
                <h2 className="text-2xl font-bold">Aniversariantes do Mês</h2>
                <p className="text-sm text-muted-foreground">Celebre com a equipe</p>
              </div>
            </div>
            <Button variant="outline" onClick={() => navigate('/aniversarios')} className="gap-2">
              Ver todos
              <ExternalLink className="h-4 w-4" />
            </Button>
          </div>
          
          {loadingBirthdays ? (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                Carregando aniversariantes...
              </CardContent>
            </Card>
          ) : monthBirthdays.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                Nenhum aniversariante este mês.
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {monthBirthdays.map((person) => (
                <Card
                  key={person.id}
                  className="bg-gradient-to-br from-pink-500/10 to-rose-500/5 hover:from-pink-500/20 hover:to-rose-500/10 hover:shadow-lg hover:-translate-y-1 transition-all duration-300 border-pink-200/50"
                >
                  <CardContent className="p-6">
                    <div className="flex items-center gap-4">
                      <Avatar className="h-16 w-16 border-2 border-pink-400/50">
                        <AvatarImage src={person.avatar_url || undefined} />
                        <AvatarFallback className="bg-gradient-to-br from-pink-400/20 to-rose-400/20">
                          <User className="h-8 w-8 text-pink-600" />
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-lg truncate">{person.full_name}</p>
                        <p className="text-sm text-pink-700 font-medium">
                          {format(new Date(person.birth_date), "dd 'de' MMMM", { locale: ptBR })}
                        </p>
                        {person.position && (
                          <Badge variant="outline" className="mt-2 text-xs border-pink-400 text-pink-700">
                            {getPositionLabel(person.position)}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
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
              const icons = [Home, Building2, Briefcase, FileCheck];
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
                          <CardTitle className="text-lg flex items-center gap-2">
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


        <Separator className="my-8" />

        {/* Redes Sociais */}
        <section>
          <h2 className="text-2xl font-bold mb-6">Nossas Redes Sociais</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {socialLinks.map((social) => (
              <Button
                key={social.url}
                variant="outline"
                className="h-auto py-3 flex-col gap-2 hover:border-primary hover:shadow-md hover:-translate-y-0.5 hover:bg-primary/10 transition-all duration-300 group"
                onClick={() => window.open(social.url, '_blank')}
              >
                <social.icon className="h-5 w-5 text-foreground group-hover:text-primary group-hover:scale-110 transition-all" />
                <span className="text-xs text-foreground group-hover:text-primary transition-colors">{social.label}</span>
              </Button>
            ))}
          </div>
        </section>
      </div>
    </Layout>
  );
}
