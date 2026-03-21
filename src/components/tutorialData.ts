import { TutorialStep } from './TutorialOverlay';

export const tutorialsByPage: Record<string, { pageName: string; steps: TutorialStep[] }> = {
  dashboard: {
    pageName: 'Dashboard Principal',
    steps: [
      {
        title: 'Bem-vindo ao Dashboard!',
        description: 'Esta é a tela principal da intranet. Aqui você encontra um resumo das informações mais importantes: avisos, tarefas pendentes, aniversariantes e acesso rápido às páginas mais utilizadas.',
      },
      {
        title: 'Acesso Rápido',
        description: 'A seção de Acesso Rápido é personalizada com base nas páginas que você mais visita. Quanto mais usar uma funcionalidade, mais destaque ela ganha aqui.',
      },
      {
        title: 'Mural de Avisos',
        description: 'Avisos importantes aparecem em destaque. Avisos fixados ficam sempre no topo. Clique para expandir e ver o conteúdo completo.',
      },
      {
        title: 'Busca Global',
        description: 'Use Ctrl+K (ou ⌘K no Mac) para abrir a busca global. Você pode encontrar qualquer página da intranet rapidamente digitando o nome.',
      },
    ],
  },
  processos: {
    pageName: 'Processos Dashboard',
    steps: [
      {
        title: 'Dashboard de Processos',
        description: 'Aqui você tem uma visão geral de todos os processos do escritório. Os contadores no topo mostram totais, processos ativos e distribuição por tipo.',
      },
      {
        title: 'Filtros e Busca',
        description: 'Use os filtros para buscar processos por número, cliente, responsável ou status. Você pode combinar filtros para refinar a pesquisa.',
      },
      {
        title: 'Status dos Processos',
        description: 'Cada processo tem um status visual: ativo, arquivado, em produção ou execução. As cores facilitam a identificação rápida.',
      },
    ],
  },
  tarefas: {
    pageName: 'Tarefas Advbox',
    steps: [
      {
        title: 'Gestão de Tarefas',
        description: 'Visualize todas as tarefas sincronizadas do Advbox. Use as abas para alternar entre lista de tarefas e relatórios de produtividade.',
      },
      {
        title: 'Filtros Inteligentes',
        description: 'Filtre por responsável, status, data de vencimento e tipo de tarefa. Alertas de tarefas excluídas ficam ocultos por padrão.',
      },
      {
        title: 'Paginação',
        description: 'As tarefas são exibidas 50 por página. Use os botões de navegação na parte inferior para percorrer todas as tarefas.',
      },
    ],
  },
  movimentacoes: {
    pageName: 'Movimentações Advbox',
    steps: [
      {
        title: 'Movimentações Processuais',
        description: 'Acompanhe todas as movimentações dos processos em tempo real. O gráfico de timeline mostra a distribuição temporal das movimentações.',
      },
      {
        title: 'Lista de Movimentações',
        description: 'A lista mostra detalhes de cada movimentação com data, processo associado e descrição. Use os filtros para localizar movimentações específicas.',
      },
    ],
  },
  publicacoes: {
    pageName: 'Publicações ADVBox',
    steps: [
      {
        title: 'Feed de Publicações',
        description: 'Veja todas as publicações dos Diários Oficiais relacionadas aos processos do escritório. As publicações são sincronizadas automaticamente.',
      },
      {
        title: 'Detalhes da Publicação',
        description: 'Clique em uma publicação para ver o conteúdo completo. Você pode copiar trechos e marcar publicações como lidas.',
      },
    ],
  },
  marketing: {
    pageName: 'Marketing Hub',
    steps: [
      {
        title: 'Hub de Marketing',
        description: 'Central de marketing do escritório. Acompanhe campanhas, métricas de leads, performance de anúncios e ROI de cada canal.',
      },
      {
        title: 'Métricas e Relatórios',
        description: 'Os dashboards mostram dados em tempo real sobre leads capturados, custo por lead, taxa de conversão e comparativos entre campanhas.',
      },
      {
        title: 'Integração com Meta Ads',
        description: 'Quando configurado, os dados do Meta Ads são importados automaticamente para análise comparativa com os leads recebidos.',
      },
    ],
  },
  financeiro: {
    pageName: 'Dashboard Financeiro',
    steps: [
      {
        title: 'Painel Financeiro',
        description: 'Visão consolidada das finanças do escritório: receitas, despesas, saldo das contas e fluxo de caixa. Dados atualizados em tempo real.',
      },
      {
        title: 'Lançamentos',
        description: 'Cadastre receitas e despesas com categorização, rateio por setor e controle de status (pendente, pago, cancelado).',
      },
      {
        title: 'Relatórios',
        description: 'Acesse relatórios detalhados por período, categoria, setor e cliente. Exporte em Excel ou PDF para análise offline.',
      },
    ],
  },
};
