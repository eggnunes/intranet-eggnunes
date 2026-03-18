import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell, Tooltip } from 'recharts';
import { Users, CalendarCheck, Trophy, RefreshCw } from 'lucide-react';

const STAGE_COLORS = ['#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899', '#f43f5e', '#22c55e'];

const TVMode = () => {
  const [now, setNow] = useState(new Date());
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const { data: leadsCount = 0, refetch: refetchLeads } = useQuery({
    queryKey: ['tv-leads'],
    queryFn: async () => {
      const { count } = await supabase.from('crm_contacts').select('*', { count: 'exact', head: true });
      return count ?? 0;
    },
  });

  const { data: meetingsCount = 0, refetch: refetchMeetings } = useQuery({
    queryKey: ['tv-meetings'],
    queryFn: async () => {
      const { count } = await supabase.from('crm_activities').select('*', { count: 'exact', head: true }).eq('type', 'meeting');
      return count ?? 0;
    },
  });

  const { data: wonCount = 0, refetch: refetchWon } = useQuery({
    queryKey: ['tv-won'],
    queryFn: async () => {
      const { count } = await supabase.from('crm_deals').select('*', { count: 'exact', head: true }).eq('won', true);
      return count ?? 0;
    },
  });

  const { data: funnelData = [], refetch: refetchFunnel } = useQuery({
    queryKey: ['tv-funnel'],
    queryFn: async () => {
      const { data: stages } = await supabase.from('crm_deal_stages').select('id, name, order_index').order('order_index');
      if (!stages?.length) return [];
      const { data: deals } = await supabase.from('crm_deals').select('stage_id');
      const countMap: Record<string, number> = {};
      deals?.forEach(d => { countMap[d.stage_id] = (countMap[d.stage_id] || 0) + 1; });
      return stages.map(s => ({ name: s.name, count: countMap[s.id] || 0 }));
    },
  });

  const { data: movements = [], refetch: refetchMovements } = useQuery({
    queryKey: ['tv-movements'],
    queryFn: async () => {
      const { data } = await supabase
        .from('crm_deal_history')
        .select('id, notes, created_at, deal_id, changed_by, from_stage_id, to_stage_id')
        .order('created_at', { ascending: false })
        .limit(30);
      if (!data?.length) return [];

      const userIds = [...new Set(data.map(m => m.changed_by).filter(Boolean))] as string[];
      const dealIds = [...new Set(data.map(m => m.deal_id).filter(Boolean))] as string[];
      const stageIds = [...new Set(data.flatMap(m => [m.from_stage_id, m.to_stage_id]).filter(Boolean))] as string[];

      const [{ data: profiles }, { data: deals }, { data: stages }] = await Promise.all([
        userIds.length ? supabase.from('profiles').select('id, full_name').in('id', userIds) : { data: [] as { id: string; full_name: string }[] },
        dealIds.length ? supabase.from('crm_deals').select('id, name, value').in('id', dealIds) : { data: [] as { id: string; name: string; value: number | null }[] },
        stageIds.length ? supabase.from('crm_deal_stages').select('id, name').in('id', stageIds) : { data: [] as { id: string; name: string }[] },
      ]);

      const profileMap = Object.fromEntries((profiles || []).map(p => [p.id, p.full_name]));
      const dealMap = Object.fromEntries((deals || []).map(d => [d.id, d]));
      const stageMap = Object.fromEntries((stages || []).map(s => [s.id, s.name]));

      return data.map(m => {
        const userName = m.changed_by ? (profileMap[m.changed_by] || 'Alguém') : 'Sistema';
        const deal = m.deal_id ? dealMap[m.deal_id] : null;
        const dealName = deal?.name || 'negócio';
        const value = deal?.value ? ` de R$ ${Number(deal.value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '';
        
        let text: string;
        if (m.from_stage_id && m.to_stage_id) {
          const from = stageMap[m.from_stage_id] || '?';
          const to = stageMap[m.to_stage_id] || '?';
          text = `${userName} moveu ${dealName}: ${from} → ${to}`;
        } else if (m.to_stage_id && !m.from_stage_id) {
          text = `${userName} criou ${dealName}${value}`;
        } else {
          text = `${userName} atualizou ${dealName}`;
        }
        if (m.notes) text += ` — ${m.notes}`;
        return { id: m.id, text, time: m.created_at };
      });
    },
  });

  useEffect(() => {
    const t = setInterval(async () => {
      setRefreshing(true);
      await Promise.all([refetchLeads(), refetchMeetings(), refetchWon(), refetchFunnel(), refetchMovements()]);
      setTimeout(() => setRefreshing(false), 800);
    }, 30000);
    return () => clearInterval(t);
  }, [refetchLeads, refetchMeetings, refetchWon, refetchFunnel, refetchMovements]);

  const kpis = [
    { label: 'Leads', value: leadsCount, icon: Users, color: 'text-blue-400' },
    { label: 'Agendamentos', value: meetingsCount, icon: CalendarCheck, color: 'text-violet-400' },
    { label: 'Contratos Fechados', value: wonCount, icon: Trophy, color: 'text-emerald-400' },
  ];

  return (
    <div className="fixed inset-0 bg-gray-950 text-gray-100 flex flex-col overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between px-8 py-4 border-b border-gray-800">
        <img src="/logo-eggnunes.png" alt="Logo" className="h-10 object-contain" />
        <div className="text-center">
          <div className="text-5xl font-mono font-bold tracking-widest tabular-nums">
            {format(now, 'HH:mm:ss')}
          </div>
          <div className="text-sm text-gray-400 capitalize mt-1">
            {format(now, "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
          </div>
        </div>
        <div className="flex items-center gap-2 text-gray-500 text-xs">
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-blue-400' : ''}`} />
          {refreshing ? 'Atualizando...' : 'Auto-refresh 30s'}
        </div>
      </header>

      {/* Body */}
      <div className="flex-1 flex overflow-hidden">
        {/* Main content */}
        <div className="flex-1 flex flex-col gap-6 p-8 overflow-hidden">
          {/* KPI Cards */}
          <div className="grid grid-cols-3 gap-6">
            {kpis.map(kpi => (
              <div key={kpi.label} className="bg-gray-900 border border-gray-800 rounded-2xl p-6 flex items-center gap-5">
                <div className={`p-4 rounded-xl bg-gray-800 ${kpi.color}`}>
                  <kpi.icon className="w-8 h-8" />
                </div>
                <div>
                  <div className="text-4xl font-bold tabular-nums">{kpi.value.toLocaleString('pt-BR')}</div>
                  <div className="text-sm text-gray-400 mt-1">{kpi.label}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Funnel Chart */}
          <div className="flex-1 bg-gray-900 border border-gray-800 rounded-2xl p-6 flex flex-col min-h-0">
            <h2 className="text-lg font-semibold text-gray-300 mb-4">Funil de Vendas</h2>
            <div className="flex-1 min-h-0">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={funnelData} layout="vertical" margin={{ left: 20, right: 30, top: 5, bottom: 5 }}>
                  <XAxis type="number" stroke="#6b7280" fontSize={12} />
                  <YAxis type="category" dataKey="name" width={140} stroke="#9ca3af" fontSize={13} />
                  <Tooltip
                    contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8, color: '#f3f4f6' }}
                    formatter={(v: number) => [`${v} negócios`, 'Quantidade']}
                  />
                  <Bar dataKey="count" radius={[0, 6, 6, 0]} barSize={28}>
                    {funnelData.map((_, i) => (
                      <Cell key={i} fill={STAGE_COLORS[i % STAGE_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Sidebar: Latest movements */}
        <aside className="w-[340px] border-l border-gray-800 flex flex-col bg-gray-900/50">
          <h3 className="px-6 py-4 text-sm font-semibold text-gray-400 border-b border-gray-800 uppercase tracking-wider">
            Últimas Movimentações
          </h3>
          <div className="flex-1 overflow-hidden relative">
            <div className="tv-autoscroll absolute inset-0">
              <div className="flex flex-col gap-1 px-4 py-2">
                {movements.map(m => (
                  <div key={m.id} className="py-3 px-3 rounded-lg hover:bg-gray-800/50 transition-colors">
                    <p className="text-sm leading-relaxed">{m.text}</p>
                    <span className="text-xs text-gray-500 mt-1 block">
                      {format(new Date(m.time), "dd/MM HH:mm")}
                    </span>
                  </div>
                ))}
                {movements.length === 0 && (
                  <p className="text-gray-500 text-sm text-center py-8">Nenhuma movimentação recente</p>
                )}
              </div>
            </div>
          </div>
        </aside>
      </div>

      <style>{`
        @keyframes tv-scroll {
          0% { transform: translateY(0); }
          100% { transform: translateY(-50%); }
        }
        .tv-autoscroll > div {
          animation: tv-scroll 40s linear infinite;
        }
        .tv-autoscroll:hover > div {
          animation-play-state: paused;
        }
      `}</style>
    </div>
  );
};

export default TVMode;
