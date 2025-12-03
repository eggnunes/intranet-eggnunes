import { Layout } from '@/components/Layout';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FileText, TrendingUp, ExternalLink, Star } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';

export default function AgentesIA() {
  const { user } = useAuth();
  const [favorites, setFavorites] = useState<string[]>([]);
  const [loadingFavorites, setLoadingFavorites] = useState<string[]>([]);

  // Scroll para o topo ao montar a página
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    if (user) {
      loadFavorites();
    }
  }, [user]);

  const loadFavorites = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('ai_agent_favorites')
      .select('agent_url')
      .eq('user_id', user.id);

    if (error) {
      console.error('Error loading favorites:', error);
      return;
    }

    setFavorites(data.map(f => f.agent_url));
  };

  const toggleFavorite = async (agentUrl: string) => {
    if (!user) return;

    setLoadingFavorites(prev => [...prev, agentUrl]);

    const isFavorite = favorites.includes(agentUrl);

    if (isFavorite) {
      const { error } = await supabase
        .from('ai_agent_favorites')
        .delete()
        .eq('user_id', user.id)
        .eq('agent_url', agentUrl);

      if (error) {
        console.error('Error removing favorite:', error);
        toast.error('Erro ao remover favorito');
      } else {
        setFavorites(prev => prev.filter(url => url !== agentUrl));
        toast.success('Favorito removido');
      }
    } else {
      const { error } = await supabase
        .from('ai_agent_favorites')
        .insert({ user_id: user.id, agent_url: agentUrl });

      if (error) {
        console.error('Error adding favorite:', error);
        toast.error('Erro ao adicionar favorito');
      } else {
        setFavorites(prev => [...prev, agentUrl]);
        toast.success('Adicionado aos favoritos');
      }
    }

    setLoadingFavorites(prev => prev.filter(url => url !== agentUrl));
  };

  const isFavorite = (agentUrl: string) => favorites.includes(agentUrl);
  const isLoading = (agentUrl: string) => loadingFavorites.includes(agentUrl);
  const aiAgentsOperacional = [
    { 
      url: 'https://chatgpt.com/g/g-68a77e96240881919f99f8ccbfa5aa8e-criador-de-peticao-inicial-de-ferias-premio', 
      label: 'Criador de Petição Inicial de Férias Prêmio',
      categories: ['Petições', 'Previdenciário']
    },
    { 
      url: 'https://chatgpt.com/g/g-6891239314f48191bb9a7e7c8f64fb5d-peticao-ir-doenca-grave', 
      label: 'Petição IR Doença Grave',
      categories: ['Petições', 'Tributário']
    },
    { 
      url: 'https://chatgpt.com/g/g-68adeddf18c08191b9a7d275f00d9ef1-revisor-juridico-em-portugues', 
      label: 'Revisor Jurídico em Português',
      categories: ['Revisão']
    },
    { 
      url: 'https://chatgpt.com/g/g-K62TVrWSl-criador-de-sustentacoes-orais', 
      label: 'Criador de Sustentações Orais',
      categories: ['Petições', 'Processual']
    },
    { 
      url: 'https://chatgpt.com/g/g-lEfkFv45q-elaborador-de-quesitos-para-pericia-judicial', 
      label: 'Elaborador de Quesitos para Perícia Judicial',
      categories: ['Perícia', 'Processual']
    },
    { 
      url: 'https://chatgpt.com/g/g-Kuz9DNuDy-revisor-de-contratos', 
      label: 'Revisor de Contratos',
      categories: ['Contratos', 'Revisão']
    },
    { 
      url: 'https://chatgpt.com/g/g-68aded307d6c8191bb9df71680bfbbd8-gerador-de-notificacao-extrajudicial', 
      label: 'Gerador de Notificação Extrajudicial',
      categories: ['Petições', 'Extrajudicial']
    },
  ];

  const aiAgentsMarketing = [
    { 
      url: 'https://chatgpt.com/g/g-68adf6a5dd348191b584156ab940ddd4-criador-de-e-book-juridico', 
      label: 'Criador de E-book Jurídico',
      categories: ['Conteúdo', 'E-book']
    },
    { 
      url: 'https://chatgpt.com/g/g-68adf54812ec8191aa8ea5c66cd1525e-posts-sobre-decisoes-judiciais-favoraveis', 
      label: 'Posts sobre Decisões Judiciais Favoráveis',
      categories: ['Redes Sociais', 'Conteúdo']
    },
    { 
      url: 'https://chatgpt.com/g/g-685639fe2d4881918ef4b1a869bc2e6b-gera-prompt-para-veo-3', 
      label: 'Gera Prompt para Veo 3',
      categories: ['Vídeo', 'Criação']
    },
    { 
      url: 'https://chatgpt.com/g/g-U7he26ZGB-criacao-de-artigos-para-advogados', 
      label: 'Criação de Artigos para Advogados',
      categories: ['Conteúdo', 'Blog']
    },
  ];

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      'Petições': 'bg-blue-100 text-blue-700 border-blue-200',
      'Contratos': 'bg-emerald-100 text-emerald-700 border-emerald-200',
      'Revisão': 'bg-amber-100 text-amber-700 border-amber-200',
      'Previdenciário': 'bg-indigo-100 text-indigo-700 border-indigo-200',
      'Tributário': 'bg-cyan-100 text-cyan-700 border-cyan-200',
      'Processual': 'bg-violet-100 text-violet-700 border-violet-200',
      'Perícia': 'bg-teal-100 text-teal-700 border-teal-200',
      'Extrajudicial': 'bg-slate-100 text-slate-700 border-slate-200',
      'Conteúdo': 'bg-pink-100 text-pink-700 border-pink-200',
      'E-book': 'bg-fuchsia-100 text-fuchsia-700 border-fuchsia-200',
      'Redes Sociais': 'bg-rose-100 text-rose-700 border-rose-200',
      'Vídeo': 'bg-orange-100 text-orange-700 border-orange-200',
      'Criação': 'bg-purple-100 text-purple-700 border-purple-200',
      'Blog': 'bg-lime-100 text-lime-700 border-lime-200',
    };
    return colors[category] || 'bg-gray-100 text-gray-700 border-gray-200';
  };

  const allAgents = [...aiAgentsOperacional, ...aiAgentsMarketing];
  const favoriteAgents = allAgents.filter(agent => isFavorite(agent.url));

  const AgentCard = ({ agent, iconBgColor, icon: Icon, iconColor }: any) => (
    <Card className="h-full bg-gradient-to-br hover:shadow-lg hover:-translate-y-1 transition-all duration-300 border">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3 mb-3">
          <a
            href={agent.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-start gap-3 flex-1 min-w-0 group"
          >
            <div className={`p-2 rounded-lg ${iconBgColor} transition-colors flex-shrink-0`}>
              <Icon className={`h-5 w-5 ${iconColor}`} />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="font-semibold text-base group-hover:text-purple-700 transition-colors mb-2">
                {agent.label}
              </h4>
            </div>
            <ExternalLink className="h-4 w-4 text-muted-foreground group-hover:text-purple-600 transition-colors flex-shrink-0 mt-1" />
          </a>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 flex-shrink-0"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              toggleFavorite(agent.url);
            }}
            disabled={isLoading(agent.url)}
          >
            <Star
              className={`h-4 w-4 transition-colors ${
                isFavorite(agent.url)
                  ? 'fill-yellow-400 text-yellow-400'
                  : 'text-muted-foreground hover:text-yellow-400'
              }`}
            />
          </Button>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {agent.categories.map((category: string) => (
            <Badge
              key={category}
              variant="outline"
              className={`text-xs ${getCategoryColor(category)}`}
            >
              {category}
            </Badge>
          ))}
        </div>
      </CardContent>
    </Card>
  );

  return (
    <Layout>
      <div className="space-y-8">
        {/* Header */}
        <div className="border-b pb-6">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
            Agentes de IA
          </h1>
          <p className="text-muted-foreground mt-2">
            Assistentes inteligentes para otimizar seu trabalho jurídico
          </p>
        </div>

        {/* Favoritos */}
        {favoriteAgents.length > 0 && (
          <section>
            <div className="mb-6">
              <h2 className="text-2xl font-bold flex items-center gap-3">
                <div className="p-2 rounded-lg bg-gradient-to-br from-yellow-500/20 to-yellow-600/20">
                  <Star className="h-5 w-5 text-yellow-600 fill-yellow-600" />
                </div>
                Favoritos
              </h2>
              <p className="text-muted-foreground text-sm mt-1">Seus agentes favoritos para acesso rápido</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {favoriteAgents.map((agent) => {
                const isOperacional = aiAgentsOperacional.some(a => a.url === agent.url);
                return (
                  <AgentCard
                    key={agent.url}
                    agent={agent}
                    iconBgColor={isOperacional ? 'bg-purple-100 group-hover:bg-purple-200' : 'bg-pink-100 group-hover:bg-pink-200'}
                    icon={isOperacional ? FileText : TrendingUp}
                    iconColor={isOperacional ? 'text-purple-700' : 'text-pink-700'}
                  />
                );
              })}
            </div>
          </section>
        )}

        {/* Agentes de IA - Operacional */}
        <section>
          <div className="mb-6">
            <h2 className="text-2xl font-bold flex items-center gap-3">
              <div className="p-2 rounded-lg bg-gradient-to-br from-purple-500/20 to-purple-600/20">
                <FileText className="h-5 w-5 text-purple-600" />
              </div>
              Para o Operacional
            </h2>
            <p className="text-muted-foreground text-sm mt-1">Ferramentas de IA para agilizar processos jurídicos</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {aiAgentsOperacional.map((agent) => (
              <AgentCard
                key={agent.url}
                agent={agent}
                iconBgColor="bg-purple-100 group-hover:bg-purple-200"
                icon={FileText}
                iconColor="text-purple-700"
              />
            ))}
          </div>
        </section>

        {/* Agentes de IA - Marketing */}
        <section>
          <div className="mb-6">
            <h2 className="text-2xl font-bold flex items-center gap-3">
              <div className="p-2 rounded-lg bg-gradient-to-br from-pink-500/20 to-pink-600/20">
                <TrendingUp className="h-5 w-5 text-pink-600" />
              </div>
              Para o Marketing
            </h2>
            <p className="text-muted-foreground text-sm mt-1">Ferramentas de IA para criar conteúdo jurídico</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {aiAgentsMarketing.map((agent) => (
              <AgentCard
                key={agent.url}
                agent={agent}
                iconBgColor="bg-pink-100 group-hover:bg-pink-200"
                icon={TrendingUp}
                iconColor="text-pink-700"
              />
            ))}
          </div>
        </section>
      </div>
    </Layout>
  );
}
