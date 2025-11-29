import { useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Lightbulb, TrendingUp, MessageSquare, ThumbsUp } from "lucide-react";

const COLORS = {
  pending: "#94a3b8",
  em_analise: "#3b82f6",
  concluida: "#10b981",
  rejeitada: "#ef4444",
};

const STATUS_LABELS = {
  pending: "Pendente",
  em_analise: "Em Análise",
  concluida: "Concluída",
  rejeitada: "Rejeitada",
};

const CATEGORY_LABELS = {
  melhoria: "Melhoria",
  nova_ferramenta: "Nova Ferramenta",
  bug: "Bug",
  geral: "Geral",
};

export default function DashboardSugestoes() {
  const { data: statsData } = useQuery({
    queryKey: ["suggestions-stats"],
    queryFn: async () => {
      // Buscar todas as sugestões
      const { data: suggestions, error } = await supabase
        .from("suggestions")
        .select("*");

      if (error) throw error;

      // Buscar votos
      const { data: votes } = await supabase
        .from("suggestion_votes")
        .select("suggestion_id");

      // Buscar comentários
      const { data: comments } = await supabase
        .from("suggestion_comments")
        .select("suggestion_id");

      // Calcular estatísticas por status
      const byStatus = suggestions.reduce((acc, s) => {
        acc[s.status] = (acc[s.status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      // Calcular estatísticas por categoria
      const byCategory = suggestions.reduce((acc, s) => {
        acc[s.category] = (acc[s.category] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      // Calcular votos por sugestão
      const votesCount = votes?.reduce((acc, vote) => {
        acc[vote.suggestion_id] = (acc[vote.suggestion_id] || 0) + 1;
        return acc;
      }, {} as Record<string, number>) || {};

      // Top 5 mais votadas
      const topVoted = suggestions
        .map((s) => ({
          ...s,
          votes: votesCount[s.id] || 0,
        }))
        .sort((a, b) => b.votes - a.votes)
        .slice(0, 5);

      return {
        total: suggestions.length,
        totalVotes: votes?.length || 0,
        totalComments: comments?.length || 0,
        byStatus: Object.entries(byStatus).map(([status, count]) => ({
          name: STATUS_LABELS[status as keyof typeof STATUS_LABELS] || status,
          value: count,
          color: COLORS[status as keyof typeof COLORS],
        })),
        byCategory: Object.entries(byCategory).map(([category, count]) => ({
          name: CATEGORY_LABELS[category as keyof typeof CATEGORY_LABELS] || category,
          value: count,
        })),
        topVoted,
      };
    },
  });

  return (
    <Layout>
      <div className="container mx-auto p-6 max-w-7xl">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Dashboard de Sugestões</h1>
          <p className="text-muted-foreground">
            Estatísticas e análises das sugestões da comunidade
          </p>
        </div>

        {/* Cards de resumo */}
        <div className="grid gap-4 md:grid-cols-4 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Total de Sugestões
              </CardTitle>
              <Lightbulb className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{statsData?.total || 0}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Total de Votos
              </CardTitle>
              <ThumbsUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{statsData?.totalVotes || 0}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Total de Comentários
              </CardTitle>
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{statsData?.totalComments || 0}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Engajamento Médio
              </CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {statsData?.total
                  ? ((statsData.totalVotes + statsData.totalComments) / statsData.total).toFixed(1)
                  : "0"}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Gráficos */}
        <div className="grid gap-6 md:grid-cols-2 mb-8">
          <Card>
            <CardHeader>
              <CardTitle>Distribuição por Status</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={statsData?.byStatus || []}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {(statsData?.byStatus || []).map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Distribuição por Categoria</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={statsData?.byCategory || []}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="value" fill="#3b82f6" name="Quantidade" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Top 5 mais votadas */}
        <Card>
          <CardHeader>
            <CardTitle>Top 5 Sugestões Mais Votadas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {statsData?.topVoted && statsData.topVoted.length > 0 ? (
                statsData.topVoted.map((suggestion, index) => (
                  <div
                    key={suggestion.id}
                    className="flex items-start justify-between p-4 border rounded-lg"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-2xl font-bold text-muted-foreground">
                          #{index + 1}
                        </span>
                        <h3 className="font-semibold">{suggestion.title}</h3>
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {suggestion.description}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      <ThumbsUp className="h-5 w-5 text-primary" />
                      <span className="text-xl font-bold">{suggestion.votes}</span>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-center text-muted-foreground py-8">
                  Nenhuma sugestão com votos ainda
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
