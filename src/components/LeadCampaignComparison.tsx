import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts';
import { GitCompare, Calendar, TrendingUp, BarChart3, Filter, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { format, subDays, parseISO, startOfDay, eachDayOfInterval } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Lead {
  id: string;
  utm_source: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_term: string | null;
  created_at: string;
}

type CompareType = 'campaign' | 'adset' | 'ad';

const COLORS = ['hsl(var(--primary))', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#84cc16'];

export function LeadCampaignComparison() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('30');
  const [compareType, setCompareType] = useState<CompareType>('campaign');
  const [selectedItems, setSelectedItems] = useState<string[]>([]);

  useEffect(() => {
    fetchLeads();
  }, [period]);

  // Reset selections when compare type changes
  useEffect(() => {
    setSelectedItems([]);
  }, [compareType]);

  const fetchLeads = async () => {
    setLoading(true);
    try {
      const startDate = subDays(new Date(), parseInt(period));
      
      const { data, error } = await supabase
        .from('captured_leads')
        .select('id, utm_source, utm_campaign, utm_content, utm_term, created_at')
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: true });

      if (error) throw error;
      setLeads(data || []);
    } catch (error) {
      console.error('Error fetching leads:', error);
    } finally {
      setLoading(false);
    }
  };

  // Get available items based on compare type
  const availableItems = useMemo(() => {
    const items = new Set<string>();
    leads.forEach(lead => {
      let value: string | null = null;
      switch (compareType) {
        case 'campaign':
          value = lead.utm_campaign;
          break;
        case 'adset':
          value = lead.utm_content;
          break;
        case 'ad':
          value = lead.utm_term;
          break;
      }
      if (value) items.add(value);
    });
    return Array.from(items).sort();
  }, [leads, compareType]);

  // Filter leads by selected items
  const filteredLeads = useMemo(() => {
    if (selectedItems.length === 0) return [];
    
    return leads.filter(lead => {
      let value: string | null = null;
      switch (compareType) {
        case 'campaign':
          value = lead.utm_campaign;
          break;
        case 'adset':
          value = lead.utm_content;
          break;
        case 'ad':
          value = lead.utm_term;
          break;
      }
      return value && selectedItems.includes(value);
    });
  }, [leads, selectedItems, compareType]);

  // Calculate comparison stats
  const comparisonStats = useMemo(() => {
    const stats: Record<string, { total: number; byDay: Record<string, number> }> = {};
    
    selectedItems.forEach(item => {
      stats[item] = { total: 0, byDay: {} };
    });

    filteredLeads.forEach(lead => {
      let value: string | null = null;
      switch (compareType) {
        case 'campaign':
          value = lead.utm_campaign;
          break;
        case 'adset':
          value = lead.utm_content;
          break;
        case 'ad':
          value = lead.utm_term;
          break;
      }
      
      if (value && stats[value]) {
        stats[value].total++;
        const day = format(parseISO(lead.created_at), 'yyyy-MM-dd');
        stats[value].byDay[day] = (stats[value].byDay[day] || 0) + 1;
      }
    });

    return stats;
  }, [filteredLeads, selectedItems, compareType]);

  // Chart data for bar comparison
  const barChartData = useMemo(() => {
    return selectedItems.map((item, index) => ({
      name: item.length > 25 ? item.substring(0, 25) + '...' : item,
      fullName: item,
      leads: comparisonStats[item]?.total || 0,
      fill: COLORS[index % COLORS.length]
    }));
  }, [selectedItems, comparisonStats]);

  // Chart data for timeline
  const timelineData = useMemo(() => {
    if (selectedItems.length === 0) return [];

    const startDate = subDays(new Date(), parseInt(period));
    const days = eachDayOfInterval({ start: startDate, end: new Date() });
    
    return days.map(day => {
      const dayKey = format(day, 'yyyy-MM-dd');
      const dayData: Record<string, string | number> = {
        date: format(day, 'dd/MM', { locale: ptBR })
      };
      
      selectedItems.forEach(item => {
        dayData[item] = comparisonStats[item]?.byDay[dayKey] || 0;
      });
      
      return dayData;
    });
  }, [selectedItems, comparisonStats, period]);

  // Pie chart data
  const pieChartData = useMemo(() => {
    return selectedItems.map((item, index) => ({
      name: item.length > 20 ? item.substring(0, 20) + '...' : item,
      fullName: item,
      value: comparisonStats[item]?.total || 0,
      fill: COLORS[index % COLORS.length]
    }));
  }, [selectedItems, comparisonStats]);

  const toggleItem = (item: string) => {
    setSelectedItems(prev => 
      prev.includes(item) 
        ? prev.filter(i => i !== item)
        : prev.length < 5 ? [...prev, item] : prev
    );
  };

  const clearSelection = () => {
    setSelectedItems([]);
  };

  const getTypeLabel = () => {
    switch (compareType) {
      case 'campaign': return 'Campanhas';
      case 'adset': return 'Conjuntos de Anúncios';
      case 'ad': return 'Anúncios';
    }
  };

  const totalSelected = selectedItems.reduce((acc, item) => acc + (comparisonStats[item]?.total || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <GitCompare className="h-5 w-5 text-primary" />
            Comparar Performance
          </CardTitle>
          <CardDescription>
            Compare a quantidade de leads entre campanhas, conjuntos de anúncios ou anúncios
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            {/* Period selector */}
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <Select value={period} onValueChange={setPeriod}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">Últimos 7 dias</SelectItem>
                  <SelectItem value="14">Últimos 14 dias</SelectItem>
                  <SelectItem value="30">Últimos 30 dias</SelectItem>
                  <SelectItem value="60">Últimos 60 dias</SelectItem>
                  <SelectItem value="90">Últimos 90 dias</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Compare type selector */}
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <Select value={compareType} onValueChange={(v) => setCompareType(v as CompareType)}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="campaign">Comparar Campanhas</SelectItem>
                  <SelectItem value="adset">Comparar Conjuntos</SelectItem>
                  <SelectItem value="ad">Comparar Anúncios</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {selectedItems.length > 0 && (
              <Button variant="ghost" size="sm" onClick={clearSelection}>
                <X className="h-4 w-4 mr-1" />
                Limpar seleção
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Selection Panel */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Selecione para Comparar</CardTitle>
            <CardDescription>
              Escolha até 5 {getTypeLabel().toLowerCase()} para comparar
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-muted-foreground text-center py-4">Carregando...</p>
            ) : availableItems.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">
                Nenhum item disponível para o período selecionado
              </p>
            ) : (
              <ScrollArea className="h-[400px] pr-4">
                <div className="space-y-2">
                  {availableItems.map((item, index) => {
                    const isSelected = selectedItems.includes(item);
                    const itemStats = leads.filter(l => {
                      switch (compareType) {
                        case 'campaign': return l.utm_campaign === item;
                        case 'adset': return l.utm_content === item;
                        case 'ad': return l.utm_term === item;
                      }
                    }).length;

                    return (
                      <div 
                        key={item} 
                        className={`flex items-center gap-3 p-2 rounded-md border transition-colors cursor-pointer ${
                          isSelected ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'
                        }`}
                        onClick={() => toggleItem(item)}
                      >
                        <Checkbox 
                          checked={isSelected}
                          disabled={!isSelected && selectedItems.length >= 5}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate" title={item}>{item}</p>
                          <p className="text-xs text-muted-foreground">{itemStats} leads</p>
                        </div>
                        {isSelected && (
                          <div 
                            className="w-3 h-3 rounded-full flex-shrink-0" 
                            style={{ backgroundColor: COLORS[selectedItems.indexOf(item) % COLORS.length] }}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>

        {/* Results Panel */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <BarChart3 className="h-4 w-4" />
                  Resultado da Comparação
                </CardTitle>
                <CardDescription>
                  {selectedItems.length === 0 
                    ? `Selecione ${getTypeLabel().toLowerCase()} para comparar`
                    : `Comparando ${selectedItems.length} ${getTypeLabel().toLowerCase()}`
                  }
                </CardDescription>
              </div>
              {selectedItems.length > 0 && (
                <Badge variant="secondary" className="text-lg px-3 py-1">
                  Total: {totalSelected} leads
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {selectedItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <GitCompare className="h-12 w-12 mb-4 opacity-50" />
                <p>Selecione itens à esquerda para começar a comparação</p>
              </div>
            ) : (
              <Tabs defaultValue="bar" className="space-y-4">
                <TabsList>
                  <TabsTrigger value="bar">Barras</TabsTrigger>
                  <TabsTrigger value="timeline">Evolução</TabsTrigger>
                  <TabsTrigger value="pie">Pizza</TabsTrigger>
                  <TabsTrigger value="table">Tabela</TabsTrigger>
                </TabsList>

                {/* Bar Chart */}
                <TabsContent value="bar">
                  <div className="h-[350px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={barChartData} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" />
                        <YAxis 
                          dataKey="name" 
                          type="category" 
                          width={150}
                          tick={{ fontSize: 12 }}
                        />
                        <Tooltip 
                          formatter={(value: number) => [`${value} leads`, 'Quantidade']}
                          labelFormatter={(label) => barChartData.find(d => d.name === label)?.fullName || label}
                        />
                        <Bar dataKey="leads" radius={[0, 4, 4, 0]}>
                          {barChartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.fill} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </TabsContent>

                {/* Timeline Chart */}
                <TabsContent value="timeline">
                  <div className="h-[350px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={timelineData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis 
                          dataKey="date" 
                          tick={{ fontSize: 11 }}
                          interval={Math.floor(timelineData.length / 10)}
                        />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        {selectedItems.map((item, index) => (
                          <Line
                            key={item}
                            type="monotone"
                            dataKey={item}
                            name={item.length > 20 ? item.substring(0, 20) + '...' : item}
                            stroke={COLORS[index % COLORS.length]}
                            strokeWidth={2}
                            dot={false}
                          />
                        ))}
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </TabsContent>

                {/* Pie Chart */}
                <TabsContent value="pie">
                  <div className="h-[350px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={pieChartData}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                          outerRadius={120}
                          dataKey="value"
                        >
                          {pieChartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.fill} />
                          ))}
                        </Pie>
                        <Tooltip 
                          formatter={(value: number, name: string) => [
                            `${value} leads (${totalSelected > 0 ? ((value / totalSelected) * 100).toFixed(1) : 0}%)`,
                            pieChartData.find(d => d.name === name)?.fullName || name
                          ]}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </TabsContent>

                {/* Table View */}
                <TabsContent value="table">
                  <div className="space-y-3">
                    {selectedItems.map((item, index) => {
                      const stats = comparisonStats[item];
                      const percentage = totalSelected > 0 ? ((stats?.total || 0) / totalSelected) * 100 : 0;
                      
                      return (
                        <div key={item} className="flex items-center gap-3 p-3 rounded-lg border">
                          <div 
                            className="w-4 h-4 rounded-full flex-shrink-0" 
                            style={{ backgroundColor: COLORS[index % COLORS.length] }}
                          />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate" title={item}>{item}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <div className="flex-1 bg-muted rounded-full h-2">
                                <div 
                                  className="h-2 rounded-full transition-all" 
                                  style={{ 
                                    width: `${percentage}%`,
                                    backgroundColor: COLORS[index % COLORS.length]
                                  }}
                                />
                              </div>
                            </div>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="text-xl font-bold">{stats?.total || 0}</p>
                            <p className="text-xs text-muted-foreground">{percentage.toFixed(1)}%</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </TabsContent>
              </Tabs>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Performance Summary */}
      {selectedItems.length >= 2 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Resumo de Performance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {/* Best performer */}
              <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20">
                <p className="text-sm text-muted-foreground">Melhor Performance</p>
                <p className="font-bold text-green-600 dark:text-green-400 truncate" title={
                  [...selectedItems].sort((a, b) => 
                    (comparisonStats[b]?.total || 0) - (comparisonStats[a]?.total || 0)
                  )[0]
                }>
                  {(() => {
                    const best = [...selectedItems].sort((a, b) => 
                      (comparisonStats[b]?.total || 0) - (comparisonStats[a]?.total || 0)
                    )[0];
                    return best?.length > 30 ? best.substring(0, 30) + '...' : best;
                  })()}
                </p>
                <p className="text-2xl font-bold">
                  {comparisonStats[
                    [...selectedItems].sort((a, b) => 
                      (comparisonStats[b]?.total || 0) - (comparisonStats[a]?.total || 0)
                    )[0]
                  ]?.total || 0} leads
                </p>
              </div>

              {/* Worst performer */}
              <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20">
                <p className="text-sm text-muted-foreground">Menor Performance</p>
                <p className="font-bold text-red-600 dark:text-red-400 truncate" title={
                  [...selectedItems].sort((a, b) => 
                    (comparisonStats[a]?.total || 0) - (comparisonStats[b]?.total || 0)
                  )[0]
                }>
                  {(() => {
                    const worst = [...selectedItems].sort((a, b) => 
                      (comparisonStats[a]?.total || 0) - (comparisonStats[b]?.total || 0)
                    )[0];
                    return worst?.length > 30 ? worst.substring(0, 30) + '...' : worst;
                  })()}
                </p>
                <p className="text-2xl font-bold">
                  {comparisonStats[
                    [...selectedItems].sort((a, b) => 
                      (comparisonStats[a]?.total || 0) - (comparisonStats[b]?.total || 0)
                    )[0]
                  ]?.total || 0} leads
                </p>
              </div>

              {/* Difference */}
              <div className="p-4 rounded-lg bg-muted/50 border">
                <p className="text-sm text-muted-foreground">Diferença</p>
                <p className="text-2xl font-bold">
                  {(() => {
                    const sorted = [...selectedItems].sort((a, b) => 
                      (comparisonStats[b]?.total || 0) - (comparisonStats[a]?.total || 0)
                    );
                    const best = comparisonStats[sorted[0]]?.total || 0;
                    const worst = comparisonStats[sorted[sorted.length - 1]]?.total || 0;
                    return best - worst;
                  })()} leads
                </p>
                <p className="text-xs text-muted-foreground">Entre melhor e pior</p>
              </div>

              {/* Average */}
              <div className="p-4 rounded-lg bg-muted/50 border">
                <p className="text-sm text-muted-foreground">Média</p>
                <p className="text-2xl font-bold">
                  {selectedItems.length > 0 
                    ? Math.round(totalSelected / selectedItems.length)
                    : 0} leads
                </p>
                <p className="text-xs text-muted-foreground">Por {compareType === 'campaign' ? 'campanha' : compareType === 'adset' ? 'conjunto' : 'anúncio'}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
