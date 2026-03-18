import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Loader2, Plus, Pencil, TrendingUp, TrendingDown, Users, DollarSign, CalendarIcon, Target } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useUserRole } from '@/hooks/useUserRole';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface Campaign {
  id: string;
  name: string;
  platform: string;
  type: string;
  investment: number;
  start_date: string | null;
  end_date: string | null;
  status: string;
  created_by: string | null;
  created_at: string;
  leads_count?: number;
  deals_won_count?: number;
  revenue?: number;
}

interface CampaignForm {
  name: string;
  platform: string;
  type: string;
  investment: string;
  start_date: Date | undefined;
  end_date: Date | undefined;
}

const PLATFORMS = [
  { value: 'facebook', label: 'Facebook', color: 'bg-blue-500/15 text-blue-700 border-blue-500/30 dark:text-blue-400' },
  { value: 'instagram', label: 'Instagram', color: 'bg-pink-500/15 text-pink-700 border-pink-500/30 dark:text-pink-400' },
  { value: 'google', label: 'Google', color: 'bg-amber-500/15 text-amber-700 border-amber-500/30 dark:text-amber-400' },
  { value: 'linkedin', label: 'LinkedIn', color: 'bg-sky-600/15 text-sky-700 border-sky-600/30 dark:text-sky-400' },
  { value: 'tiktok', label: 'TikTok', color: 'bg-neutral-800/15 text-neutral-800 border-neutral-800/30 dark:text-neutral-300' },
  { value: 'outro', label: 'Outro', color: 'bg-muted text-muted-foreground border-border' },
];

const TYPES = [
  { value: 'trafego', label: 'Tráfego' },
  { value: 'conversao', label: 'Conversão' },
  { value: 'branding', label: 'Branding' },
];

const PLATFORM_CARD_BORDERS: Record<string, string> = {
  facebook: 'border-l-blue-500',
  instagram: 'border-l-pink-500',
  google: 'border-l-amber-500',
  linkedin: 'border-l-sky-600',
  tiktok: 'border-l-neutral-700',
  outro: 'border-l-muted-foreground',
};

const emptyForm: CampaignForm = {
  name: '',
  platform: 'facebook',
  type: 'trafego',
  investment: '',
  start_date: undefined,
  end_date: undefined,
};

export const CRMCampaigns = () => {
  const { isAdmin } = useUserRole();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<CampaignForm>(emptyForm);

  useEffect(() => {
    fetchCampaigns();
  }, []);

  const fetchCampaigns = async () => {
    try {
      const { data, error } = await supabase
        .from('crm_campaigns')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Enrich with leads/deals counts
      const enriched = await Promise.all(
        (data || []).map(async (c: any) => {
          const { count: leadsCount } = await supabase
            .from('crm_contacts')
            .select('*', { count: 'exact', head: true })
            .ilike('traffic_source', `%${c.name}%`);

          const { data: wonDeals } = await supabase
            .from('crm_deals')
            .select('value')
            .eq('won', true)
            .ilike('name', `%${c.name}%`);

          const revenue = (wonDeals || []).reduce((sum: number, d: any) => sum + (Number(d.value) || 0), 0);

          return {
            ...c,
            leads_count: leadsCount || 0,
            deals_won_count: (wonDeals || []).length,
            revenue,
          };
        })
      );

      setCampaigns(enriched);
    } catch (error) {
      console.error('Error fetching campaigns:', error);
      toast.error('Erro ao carregar campanhas');
    } finally {
      setLoading(false);
    }
  };

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (c: Campaign) => {
    setEditingId(c.id);
    setForm({
      name: c.name,
      platform: c.platform,
      type: c.type,
      investment: String(c.investment),
      start_date: c.start_date ? new Date(c.start_date) : undefined,
      end_date: c.end_date ? new Date(c.end_date) : undefined,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error('Nome da campanha é obrigatório');
      return;
    }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const payload = {
        name: form.name,
        platform: form.platform,
        type: form.type,
        investment: parseFloat(form.investment) || 0,
        start_date: form.start_date ? format(form.start_date, 'yyyy-MM-dd') : null,
        end_date: form.end_date ? format(form.end_date, 'yyyy-MM-dd') : null,
        created_by: user?.id,
      };

      if (editingId) {
        const { error } = await supabase
          .from('crm_campaigns')
          .update(payload)
          .eq('id', editingId);
        if (error) throw error;
        toast.success('Campanha atualizada');
      } else {
        const { error } = await supabase
          .from('crm_campaigns')
          .insert(payload);
        if (error) throw error;
        toast.success('Campanha criada');
      }

      setDialogOpen(false);
      fetchCampaigns();
    } catch (error: any) {
      toast.error(error.message || 'Erro ao salvar campanha');
    } finally {
      setSaving(false);
    }
  };

  const getPlatformInfo = (platform: string) =>
    PLATFORMS.find((p) => p.value === platform) || PLATFORMS[5];

  const getTypeLabel = (type: string) =>
    TYPES.find((t) => t.value === type)?.label || type;

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Campanhas de Marketing</h3>
          <p className="text-sm text-muted-foreground">Gerencie investimentos e acompanhe ROI</p>
        </div>
        {isAdmin && (
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4 mr-2" />
            Nova Campanha
          </Button>
        )}
      </div>

      {campaigns.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Nenhuma campanha cadastrada ainda.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {campaigns.map((c, i) => {
            const platform = getPlatformInfo(c.platform);
            const roi = c.revenue - c.investment;
            const roiPositive = roi >= 0;

            return (
              <Card
                key={c.id}
                className={cn(
                  'border-l-4 animate-in fade-in slide-in-from-bottom-2 duration-300',
                  PLATFORM_CARD_BORDERS[c.platform] || 'border-l-muted-foreground'
                )}
                style={{ animationDelay: `${i * 60}ms`, animationFillMode: 'both' }}
              >
                <CardHeader className="pb-2 flex flex-row items-start justify-between">
                  <div className="space-y-1">
                    <CardTitle className="text-base">{c.name}</CardTitle>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={cn('text-xs', platform.color)}>
                        {platform.label}
                      </Badge>
                      <Badge variant="secondary" className="text-xs">
                        {getTypeLabel(c.type)}
                      </Badge>
                    </div>
                  </div>
                  {isAdmin && (
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEdit(c)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="flex items-center gap-1.5">
                      <DollarSign className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-muted-foreground">Investimento</span>
                    </div>
                    <span className="text-right font-medium">{formatCurrency(c.investment)}</span>

                    <div className="flex items-center gap-1.5">
                      <Users className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-muted-foreground">Leads</span>
                    </div>
                    <span className="text-right font-medium">{c.leads_count}</span>

                    <div className="flex items-center gap-1.5">
                      <Target className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-muted-foreground">Fechamentos</span>
                    </div>
                    <span className="text-right font-medium">{c.deals_won_count}</span>
                  </div>

                  <div className={cn(
                    'flex items-center justify-between p-2 rounded-md',
                    roiPositive ? 'bg-green-500/10' : 'bg-red-500/10'
                  )}>
                    <div className="flex items-center gap-1.5 text-sm">
                      {roiPositive ? (
                        <TrendingUp className="h-4 w-4 text-green-600" />
                      ) : (
                        <TrendingDown className="h-4 w-4 text-red-600" />
                      )}
                      <span className="font-medium">ROI</span>
                    </div>
                    <span className={cn('font-bold text-sm', roiPositive ? 'text-green-600' : 'text-red-600')}>
                      {formatCurrency(roi)}
                    </span>
                  </div>

                  {(c.start_date || c.end_date) && (
                    <p className="text-xs text-muted-foreground">
                      {c.start_date && format(new Date(c.start_date), 'dd/MM/yyyy')}
                      {c.start_date && c.end_date && ' — '}
                      {c.end_date && format(new Date(c.end_date), 'dd/MM/yyyy')}
                    </p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Editar Campanha' : 'Nova Campanha'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Ex: Black Friday 2026"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Plataforma</Label>
                <Select value={form.platform} onValueChange={(v) => setForm({ ...form, platform: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PLATFORMS.map((p) => (
                      <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Investimento (R$)</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={form.investment}
                onChange={(e) => setForm({ ...form, investment: e.target.value })}
                placeholder="0,00"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Data Início</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn('w-full justify-start text-left font-normal', !form.start_date && 'text-muted-foreground')}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {form.start_date ? format(form.start_date, 'dd/MM/yyyy') : 'Selecionar'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={form.start_date} onSelect={(d) => setForm({ ...form, start_date: d })} initialFocus className="p-3 pointer-events-auto" />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2">
                <Label>Data Fim</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn('w-full justify-start text-left font-normal', !form.end_date && 'text-muted-foreground')}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {form.end_date ? format(form.end_date, 'dd/MM/yyyy') : 'Selecionar'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={form.end_date} onSelect={(d) => setForm({ ...form, end_date: d })} initialFocus className="p-3 pointer-events-auto" />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingId ? 'Salvar' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
