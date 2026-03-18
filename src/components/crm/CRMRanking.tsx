import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Loader2, Phone, CalendarCheck, Trophy, Percent } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { motion, AnimatePresence } from 'framer-motion';

type Criteria = 'calls' | 'meetings' | 'closings' | 'conversion';

interface SellerStats {
  ownerId: string;
  name: string;
  calls: number;
  meetings: number;
  closings: number;
  totalDeals: number;
  conversion: number;
}

const CRITERIA_CONFIG: Record<Criteria, { label: string; icon: typeof Phone; suffix: string }> = {
  calls: { label: 'Chamados', icon: Phone, suffix: '' },
  meetings: { label: 'Agendamentos', icon: CalendarCheck, suffix: '' },
  closings: { label: 'Fechamentos', icon: Trophy, suffix: '' },
  conversion: { label: 'Conversão', icon: Percent, suffix: '%' },
};

const MEDALS = ['🥇', '🥈', '🥉'];

const MEDAL_BORDERS = [
  'border-yellow-400 shadow-yellow-400/20',
  'border-gray-400 shadow-gray-400/20',
  'border-amber-600 shadow-amber-600/20',
];

export const CRMRanking = () => {
  const [sellers, setSellers] = useState<SellerStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [criteria, setCriteria] = useState<Criteria>('closings');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [dealsRes, activitiesRes, profilesRes] = await Promise.all([
        supabase.from('crm_deals').select('owner_id, won, closed_at'),
        supabase.from('crm_activities').select('owner_id, type'),
        supabase.from('profiles').select('id, full_name'),
      ]);

      const deals = dealsRes.data || [];
      const activities = activitiesRes.data || [];
      const profiles = profilesRes.data || [];

      const profileMap = new Map(profiles.map(p => [p.id, p.full_name || 'Sem nome']));

      // Collect all unique owner IDs
      const ownerIds = new Set<string>();
      deals.forEach(d => d.owner_id && ownerIds.add(d.owner_id));
      activities.forEach(a => a.owner_id && ownerIds.add(a.owner_id));

      const statsMap = new Map<string, SellerStats>();

      ownerIds.forEach(id => {
        statsMap.set(id, {
          ownerId: id,
          name: profileMap.get(id) || id.substring(0, 8),
          calls: 0,
          meetings: 0,
          closings: 0,
          totalDeals: 0,
          conversion: 0,
        });
      });

      deals.forEach(d => {
        if (!d.owner_id) return;
        const s = statsMap.get(d.owner_id);
        if (!s) return;
        s.totalDeals++;
        if (d.won === true) s.closings++;
      });

      activities.forEach(a => {
        if (!a.owner_id) return;
        const s = statsMap.get(a.owner_id);
        if (!s) return;
        if (a.type === 'call') s.calls++;
        if (a.type === 'meeting') s.meetings++;
      });

      statsMap.forEach(s => {
        s.conversion = s.totalDeals > 0 ? Math.round((s.closings / s.totalDeals) * 100) : 0;
      });

      setSellers(Array.from(statsMap.values()));
    } catch (err) {
      console.error('Error fetching ranking data:', err);
    } finally {
      setLoading(false);
    }
  };

  const sorted = useMemo(() => {
    return [...sellers]
      .sort((a, b) => b[criteria] - a[criteria])
      .slice(0, 10);
  }, [sellers, criteria]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-yellow-500" />
            Ranking de Vendedores
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Criteria buttons */}
          <div className="flex flex-wrap gap-2">
            {(Object.keys(CRITERIA_CONFIG) as Criteria[]).map(key => {
              const cfg = CRITERIA_CONFIG[key];
              const Icon = cfg.icon;
              return (
                <Button
                  key={key}
                  variant={criteria === key ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setCriteria(key)}
                >
                  <Icon className="h-4 w-4 mr-1" />
                  {cfg.label}
                </Button>
              );
            })}
          </div>

          {/* Ranking list */}
          {sorted.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">Nenhum dado encontrado.</p>
          ) : (
            <div className="space-y-3">
              <AnimatePresence mode="popLayout">
                {sorted.map((seller, idx) => {
                  const isTop3 = idx < 3;
                  const value = seller[criteria];
                  const suffix = CRITERIA_CONFIG[criteria].suffix;

                  return (
                    <motion.div
                      key={seller.ownerId}
                      layout
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      transition={{ duration: 0.3, delay: idx * 0.05 }}
                    >
                      <div
                        className={`flex items-center gap-4 p-4 rounded-lg border-2 transition-colors ${
                          isTop3
                            ? `${MEDAL_BORDERS[idx]} shadow-md bg-card`
                            : 'border-border bg-card'
                        }`}
                      >
                        {/* Position */}
                        <div className="flex-shrink-0 w-10 text-center">
                          {isTop3 ? (
                            <span className="text-2xl">{MEDALS[idx]}</span>
                          ) : (
                            <span className="text-lg font-bold text-muted-foreground">
                              {idx + 1}º
                            </span>
                          )}
                        </div>

                        {/* Avatar */}
                        <Avatar className={isTop3 ? 'h-12 w-12' : 'h-10 w-10'}>
                          <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                            {seller.name
                              .split(' ')
                              .map(w => w[0])
                              .join('')
                              .substring(0, 2)
                              .toUpperCase()}
                          </AvatarFallback>
                        </Avatar>

                        {/* Name */}
                        <div className="flex-1 min-w-0">
                          <p className={`font-semibold truncate ${isTop3 ? 'text-lg' : ''}`}>
                            {seller.name}
                          </p>
                        </div>

                        {/* Value */}
                        <div className="flex-shrink-0 text-right">
                          <span className={`font-bold ${isTop3 ? 'text-2xl text-primary' : 'text-xl text-muted-foreground'}`}>
                            {value}{suffix}
                          </span>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
