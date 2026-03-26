import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  LineChart, Line, AreaChart, Area, Legend
} from 'recharts';
import {
  Users, Eye, TrendingUp, Heart, MessageCircle, Image, Video, ExternalLink, UserPlus
} from 'lucide-react';

interface InstagramTabProps {
  dateRange: { from: Date; to: Date };
}

export default function InstagramTab({ dateRange }: InstagramTabProps) {
  const dateFrom = format(dateRange.from, 'yyyy-MM-dd');
  const dateTo = format(dateRange.to, 'yyyy-MM-dd');

  const { data: accountInfo, isLoading: loadingAccount, error: accountError } = useQuery({
    queryKey: ['instagram-account-info'],
    queryFn: async () => {
      const resp = await supabase.functions.invoke('instagram-insights', {
        body: { action: 'account_info' },
      });
      if (resp.error) throw new Error(resp.error.message || 'Erro');
      if (resp.data?.error) throw new Error(resp.data.error);
      return resp.data?.account;
    },
  });

  const { data: dailyInsights = [], isLoading: loadingDaily } = useQuery({
    queryKey: ['instagram-daily-insights', dateFrom, dateTo],
    queryFn: async () => {
      const resp = await supabase.functions.invoke('instagram-insights', {
        body: { action: 'daily_insights', date_from: dateFrom, date_to: dateTo },
      });
      if (resp.data?.error) throw new Error(resp.data.error);
      return resp.data?.daily || [];
    },
    enabled: !!accountInfo,
  });

  const { data: topPosts = [], isLoading: loadingPosts } = useQuery({
    queryKey: ['instagram-top-posts'],
    queryFn: async () => {
      const resp = await supabase.functions.invoke('instagram-insights', {
        body: { action: 'top_engaged' },
      });
      if (resp.data?.error) throw new Error(resp.data.error);
      return resp.data?.top_posts || [];
    },
    enabled: !!accountInfo,
  });

  // Chart data
  const chartData = useMemo(() => dailyInsights.map((d: any) => ({
    data: format(new Date(d.date), 'dd/MM'),
    impressoes: d.impressions || 0,
    alcance: d.reach || 0,
    seguidores: d.follower_count || 0,
    visitas: d.profile_views || 0,
  })), [dailyInsights]);

  // Summary metrics
  const totals = useMemo(() => {
    const t = { impressions: 0, reach: 0, profileViews: 0, followerGrowth: 0 };
    for (const d of dailyInsights) {
      t.impressions += d.impressions || 0;
      t.reach += d.reach || 0;
      t.profileViews += d.profile_views || 0;
    }
    if (dailyInsights.length >= 2) {
      const first = dailyInsights[0]?.follower_count || 0;
      const last = dailyInsights[dailyInsights.length - 1]?.follower_count || 0;
      t.followerGrowth = last - first;
    }
    return t;
  }, [dailyInsights]);

  if (accountError) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-destructive font-medium mb-2">Erro ao carregar Instagram</p>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            {(accountError as Error).message}
          </p>
          <p className="text-xs text-muted-foreground mt-4">
            Verifique se o token do Meta Ads possui as permissões: <strong>instagram_basic</strong>, <strong>instagram_manage_insights</strong> e <strong>pages_show_list</strong>.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (loadingAccount) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Profile section */}
      {accountInfo && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row items-center gap-4">
              {accountInfo.profile_picture_url && (
                <img
                  src={accountInfo.profile_picture_url}
                  alt={accountInfo.name}
                  className="w-20 h-20 rounded-full border-2 border-primary/20"
                />
              )}
              <div className="text-center sm:text-left flex-1">
                <h3 className="text-lg font-bold text-foreground">{accountInfo.name}</h3>
                <p className="text-sm text-muted-foreground">@{accountInfo.username}</p>
                {accountInfo.biography && (
                  <p className="text-sm text-foreground/80 mt-1 max-w-md">{accountInfo.biography}</p>
                )}
                {accountInfo.website && (
                  <a href={accountInfo.website} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline flex items-center gap-1 mt-1 justify-center sm:justify-start">
                    <ExternalLink className="h-3 w-3" />{accountInfo.website}
                  </a>
                )}
              </div>
              <div className="flex gap-6 text-center">
                <div>
                  <div className="text-xl font-bold text-foreground">{(accountInfo.followers_count || 0).toLocaleString('pt-BR')}</div>
                  <div className="text-xs text-muted-foreground">Seguidores</div>
                </div>
                <div>
                  <div className="text-xl font-bold text-foreground">{(accountInfo.follows_count || 0).toLocaleString('pt-BR')}</div>
                  <div className="text-xs text-muted-foreground">Seguindo</div>
                </div>
                <div>
                  <div className="text-xl font-bold text-foreground">{(accountInfo.media_count || 0).toLocaleString('pt-BR')}</div>
                  <div className="text-xs text-muted-foreground">Posts</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Metric cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="pt-4 pb-3 text-center">
            <UserPlus className="h-4 w-4 mx-auto text-muted-foreground mb-1" />
            <div className="text-xs text-muted-foreground">Crescimento</div>
            <div className={`text-lg font-bold ${totals.followerGrowth >= 0 ? 'text-green-600' : 'text-destructive'}`}>
              {totals.followerGrowth >= 0 ? '+' : ''}{totals.followerGrowth.toLocaleString('pt-BR')}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 text-center">
            <Eye className="h-4 w-4 mx-auto text-muted-foreground mb-1" />
            <div className="text-xs text-muted-foreground">Impressões</div>
            <div className="text-lg font-bold text-foreground">{totals.impressions.toLocaleString('pt-BR')}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 text-center">
            <Users className="h-4 w-4 mx-auto text-muted-foreground mb-1" />
            <div className="text-xs text-muted-foreground">Alcance</div>
            <div className="text-lg font-bold text-foreground">{totals.reach.toLocaleString('pt-BR')}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 text-center">
            <TrendingUp className="h-4 w-4 mx-auto text-muted-foreground mb-1" />
            <div className="text-xs text-muted-foreground">Visitas ao Perfil</div>
            <div className="text-lg font-bold text-foreground">{totals.profileViews.toLocaleString('pt-BR')}</div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      {loadingDaily ? (
        <Skeleton className="h-64 w-full" />
      ) : chartData.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Follower growth */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Seguidores</CardTitle>
              <CardDescription className="text-xs">Evolução no período</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
                    <XAxis dataKey="data" tick={{ fontSize: 10 }} className="text-muted-foreground" />
                    <YAxis tick={{ fontSize: 10 }} className="text-muted-foreground" />
                    <RechartsTooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }} />
                    <Area type="monotone" dataKey="seguidores" stroke="hsl(var(--primary))" fill="hsl(var(--primary) / 0.2)" name="Seguidores" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Reach & Impressions */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Alcance e Impressões</CardTitle>
              <CardDescription className="text-xs">Diário no período</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
                    <XAxis dataKey="data" tick={{ fontSize: 10 }} className="text-muted-foreground" />
                    <YAxis tick={{ fontSize: 10 }} className="text-muted-foreground" />
                    <RechartsTooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }} />
                    <Legend />
                    <Bar dataKey="alcance" fill="hsl(215, 80%, 55%)" name="Alcance" radius={[2, 2, 0, 0]} />
                    <Bar dataKey="impressoes" fill="hsl(340, 75%, 55%)" name="Impressões" radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            Nenhum dado de insights disponível para o período selecionado.
          </CardContent>
        </Card>
      )}

      {/* Top 10 posts */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Heart className="h-4 w-4 text-pink-500" />
            Top 10 Posts Mais Engajados
          </CardTitle>
          <CardDescription className="text-xs">Posts com maior número de curtidas + comentários</CardDescription>
        </CardHeader>
        <CardContent>
          {loadingPosts ? (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-48" />)}
            </div>
          ) : topPosts.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
              {topPosts.map((post: any, idx: number) => (
                <a
                  key={post.id}
                  href={post.permalink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group block rounded-lg border border-border overflow-hidden hover:border-primary/50 transition-colors"
                >
                  <div className="relative aspect-square bg-muted">
                    {post.media_url ? (
                      post.media_type === 'VIDEO' ? (
                        <div className="w-full h-full flex items-center justify-center bg-muted">
                          <Video className="h-8 w-8 text-muted-foreground" />
                          {post.thumbnail_url && (
                            <img src={post.thumbnail_url} alt="" className="absolute inset-0 w-full h-full object-cover" />
                          )}
                        </div>
                      ) : (
                        <img src={post.media_url} alt="" className="w-full h-full object-cover" />
                      )
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Image className="h-8 w-8 text-muted-foreground" />
                      </div>
                    )}
                    <Badge className="absolute top-1 left-1 text-[10px] px-1.5 py-0" variant="secondary">
                      #{idx + 1}
                    </Badge>
                  </div>
                  <div className="p-2 space-y-1">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="flex items-center gap-0.5 text-pink-500">
                        <Heart className="h-3 w-3" />
                        {(post.like_count || 0).toLocaleString('pt-BR')}
                      </span>
                      <span className="flex items-center gap-0.5 text-muted-foreground">
                        <MessageCircle className="h-3 w-3" />
                        {(post.comments_count || 0).toLocaleString('pt-BR')}
                      </span>
                    </div>
                    {post.caption && (
                      <p className="text-[10px] text-muted-foreground line-clamp-2">{post.caption}</p>
                    )}
                    <p className="text-[10px] text-muted-foreground/60">
                      {format(new Date(post.timestamp), "dd/MM/yyyy", { locale: ptBR })}
                    </p>
                  </div>
                </a>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">Nenhum post encontrado.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
