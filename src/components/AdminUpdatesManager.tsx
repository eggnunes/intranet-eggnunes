import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sparkles, Plus, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Update {
  id: string;
  title: string;
  description: string;
  category: string;
  created_at: string;
}

const CATEGORY_MAP: Record<string, { label: string; value: string }> = {
  feature: { label: 'Nova Funcionalidade', value: 'feature' },
  improvement: { label: 'Melhoria', value: 'improvement' },
  fix: { label: 'Correção', value: 'fix' },
  update: { label: 'Atualização', value: 'update' },
};

export const AdminUpdatesManager = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [updates, setUpdates] = useState<Update[]>([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('feature');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchUpdates();
  }, []);

  const fetchUpdates = async () => {
    const { data } = await supabase
      .from('intranet_updates')
      .select('*')
      .order('created_at', { ascending: false });
    if (data) setUpdates(data);
  };

  const handleCreate = async () => {
    if (!title.trim() || !description.trim() || !user) return;
    setSaving(true);

    const { error } = await supabase
      .from('intranet_updates')
      .insert({ title: title.trim(), description: description.trim(), category, created_by: user.id });

    if (error) {
      toast({ title: 'Erro', description: 'Erro ao criar atualização', variant: 'destructive' });
    } else {
      toast({ title: 'Sucesso', description: 'Atualização cadastrada com sucesso' });
      setTitle('');
      setDescription('');
      setCategory('feature');
      fetchUpdates();
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('intranet_updates').delete().eq('id', id);
    if (error) {
      toast({ title: 'Erro', description: 'Erro ao excluir atualização', variant: 'destructive' });
    } else {
      toast({ title: 'Excluída', description: 'Atualização removida' });
      fetchUpdates();
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Nova Atualização
          </CardTitle>
          <CardDescription>Cadastre uma nova notificação de funcionalidade para todos os usuários</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="update-title">Título</Label>
            <Input id="update-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: Sistema de Gestão de Folgas" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="update-description">Descrição</Label>
            <Textarea id="update-description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Descreva a funcionalidade ou melhoria..." rows={3} />
          </div>
          <div className="space-y-2">
            <Label>Categoria</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.values(CATEGORY_MAP).map((c) => (
                  <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={handleCreate} disabled={saving || !title.trim() || !description.trim()}>
            {saving ? 'Salvando...' : 'Cadastrar Atualização'}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            Atualizações Cadastradas
          </CardTitle>
          <CardDescription>{updates.length} atualização(ões) registrada(s)</CardDescription>
        </CardHeader>
        <CardContent>
          {updates.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Nenhuma atualização cadastrada</p>
          ) : (
            <div className="space-y-3">
              {updates.map((u) => (
                <div key={u.id} className="flex items-start justify-between gap-3 p-3 border rounded-lg">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-medium text-sm truncate">{u.title}</h4>
                      <Badge variant="secondary" className="text-xs shrink-0">
                        {CATEGORY_MAP[u.category]?.label || u.category}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2">{u.description}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {format(new Date(u.created_at), "d 'de' MMMM 'de' yyyy", { locale: ptBR })}
                    </p>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(u.id)} className="shrink-0 text-destructive hover:text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
