import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, Pencil, Check, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface TagItem {
  id: string;
  name: string;
  color: string;
  created_at: string;
  usage_count?: number;
}

const TAG_COLORS = [
  '#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6',
  '#EC4899', '#6B7280', '#F97316', '#14B8A6', '#6366F1',
];

export function TagsManager() {
  const { toast } = useToast();
  const [tags, setTags] = useState<TagItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState('#3B82F6');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('');

  useEffect(() => {
    fetchTags();
  }, []);

  const fetchTags = async () => {
    setLoading(true);
    const { data: tagsData } = await supabase.from('whatsapp_tags').select('*').order('name');
    if (tagsData) {
      // Get usage counts
      const { data: usageData } = await supabase.from('whatsapp_conversation_tags').select('tag_id');
      const countMap: Record<string, number> = {};
      usageData?.forEach(u => { countMap[u.tag_id] = (countMap[u.tag_id] || 0) + 1; });

      setTags((tagsData as TagItem[]).map(t => ({ ...t, usage_count: countMap[t.id] || 0 })));
    }
    setLoading(false);
  };

  const handleCreate = async () => {
    if (!newName.trim()) return;
    const { error } = await supabase.from('whatsapp_tags').insert({ name: newName.trim(), color: newColor });
    if (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } else {
      setNewName('');
      fetchTags();
    }
  };

  const handleUpdate = async (id: string) => {
    if (!editName.trim()) return;
    const { error } = await supabase.from('whatsapp_tags').update({ name: editName.trim(), color: editColor }).eq('id', id);
    if (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } else {
      setEditingId(null);
      fetchTags();
    }
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('whatsapp_tags').delete().eq('id', id);
    if (error) {
      toast({ title: 'Erro ao excluir', description: error.message, variant: 'destructive' });
    } else {
      fetchTags();
    }
  };

  return (
    <div className="space-y-4">
      {/* Create new tag */}
      <Card>
        <CardContent className="pt-4">
          <h3 className="text-sm font-medium mb-3">Criar Nova Tag</h3>
          <div className="flex items-end gap-3">
            <div className="flex-1 space-y-1.5">
              <Input
                placeholder="Nome da tag (ex: VIP, Urgente...)"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                className="h-9"
              />
            </div>
            <div className="flex gap-1.5 items-center">
              {TAG_COLORS.map(c => (
                <button
                  key={c}
                  className={`h-6 w-6 rounded-full border-2 transition-all ${newColor === c ? 'border-foreground scale-110' : 'border-transparent'}`}
                  style={{ backgroundColor: c }}
                  onClick={() => setNewColor(c)}
                />
              ))}
            </div>
            <Button onClick={handleCreate} disabled={!newName.trim()} size="sm">
              <Plus className="h-4 w-4 mr-1" /> Criar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Tags list */}
      <Card>
        <CardContent className="pt-4">
          <h3 className="text-sm font-medium mb-3">Tags Cadastradas ({tags.length})</h3>
          {loading ? (
            <p className="text-sm text-muted-foreground text-center py-4">Carregando...</p>
          ) : tags.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Nenhuma tag cadastrada</p>
          ) : (
            <div className="space-y-2">
              {tags.map(tag => (
                <div key={tag.id} className="flex items-center gap-3 p-2 rounded border hover:bg-accent/50 transition-colors">
                  {editingId === tag.id ? (
                    <>
                      <Input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="h-7 text-sm flex-1"
                        onKeyDown={(e) => e.key === 'Enter' && handleUpdate(tag.id)}
                        autoFocus
                      />
                      <div className="flex gap-1">
                        {TAG_COLORS.map(c => (
                          <button
                            key={c}
                            className={`h-4 w-4 rounded-full border-2 ${editColor === c ? 'border-foreground' : 'border-transparent'}`}
                            style={{ backgroundColor: c }}
                            onClick={() => setEditColor(c)}
                          />
                        ))}
                      </div>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleUpdate(tag.id)}>
                        <Check className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditingId(null)}>
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </>
                  ) : (
                    <>
                      <Badge style={{ backgroundColor: tag.color + '20', borderColor: tag.color, color: tag.color }} variant="outline">
                        {tag.name}
                      </Badge>
                      <span className="text-xs text-muted-foreground ml-auto">
                        {tag.usage_count || 0} conversa{(tag.usage_count || 0) !== 1 ? 's' : ''}
                      </span>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditingId(tag.id); setEditName(tag.name); setEditColor(tag.color); }}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(tag.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
