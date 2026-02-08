import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { X, Filter } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface Profile {
  id: string;
  full_name: string;
}

interface TagItem {
  id: string;
  name: string;
  color: string;
}

export interface ConversationFilterValues {
  assignees: string[];
  sectors: string[];
  tags: string[];
  unreadOnly: boolean;
}

interface ConversationFiltersProps {
  filters: ConversationFilterValues;
  onFiltersChange: (filters: ConversationFilterValues) => void;
  onClose: () => void;
}

export const emptyFilters: ConversationFilterValues = {
  assignees: [],
  sectors: [],
  tags: [],
  unreadOnly: false,
};

export function getActiveFilterCount(filters: ConversationFilterValues): number {
  let count = 0;
  if (filters.assignees.length > 0) count++;
  if (filters.sectors.length > 0) count++;
  if (filters.tags.length > 0) count++;
  if (filters.unreadOnly) count++;
  return count;
}

export function ConversationFilters({ filters, onFiltersChange, onClose }: ConversationFiltersProps) {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [allTags, setAllTags] = useState<TagItem[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      const [profilesRes, tagsRes] = await Promise.all([
        supabase.from('profiles').select('id, full_name').eq('is_active', true).order('full_name'),
        supabase.from('whatsapp_tags').select('id, name, color').order('name'),
      ]);
      if (profilesRes.data) setProfiles(profilesRes.data);
      if (tagsRes.data) setAllTags(tagsRes.data as TagItem[]);
    };
    fetchData();
  }, []);

  const toggleArrayItem = (key: keyof Pick<ConversationFilterValues, 'assignees' | 'sectors' | 'tags'>, value: string) => {
    const arr = filters[key];
    const newArr = arr.includes(value) ? arr.filter(v => v !== value) : [...arr, value];
    onFiltersChange({ ...filters, [key]: newArr });
  };

  const clearAll = () => onFiltersChange(emptyFilters);

  const sectors = [
    { value: 'comercial', label: 'Comercial' },
    { value: 'operacional', label: 'Operacional' },
    { value: 'financeiro', label: 'Financeiro' },
  ];

  return (
    <div className="border-t bg-card">
      <div className="p-3 border-b flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Filtros</span>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={clearAll}>Limpar</Button>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <ScrollArea className="max-h-64">
        <div className="p-3 space-y-4">
          {/* Sectors */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground font-medium">Setor</Label>
            <div className="flex flex-wrap gap-1.5">
              {sectors.map(s => (
                <button key={s.value} onClick={() => toggleArrayItem('sectors', s.value)}>
                  <Badge
                    variant={filters.sectors.includes(s.value) ? 'default' : 'outline'}
                    className="cursor-pointer text-[10px]"
                  >
                    {s.label}
                  </Badge>
                </button>
              ))}
            </div>
          </div>

          {/* Tags */}
          {allTags.length > 0 && (
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground font-medium">Tags</Label>
              <div className="flex flex-wrap gap-1.5">
                {allTags.map(tag => (
                  <button key={tag.id} onClick={() => toggleArrayItem('tags', tag.id)}>
                    <Badge
                      variant="outline"
                      className="cursor-pointer text-[10px] transition-all"
                      style={{
                        backgroundColor: filters.tags.includes(tag.id) ? tag.color + '20' : undefined,
                        borderColor: tag.color,
                        color: filters.tags.includes(tag.id) ? tag.color : undefined,
                      }}
                    >
                      {tag.name}
                    </Badge>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Assignees */}
          {profiles.length > 0 && (
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground font-medium">Responsável</Label>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {profiles.map(p => (
                  <label
                    key={p.id}
                    className="flex items-center gap-2 text-xs cursor-pointer hover:bg-accent/50 px-1 py-0.5 rounded"
                  >
                    <Checkbox
                      checked={filters.assignees.includes(p.id)}
                      onCheckedChange={() => toggleArrayItem('assignees', p.id)}
                      className="h-3.5 w-3.5"
                    />
                    <span className="truncate">{p.full_name}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Unread only */}
          <div>
            <label className="flex items-center gap-2 text-xs cursor-pointer">
              <Checkbox
                checked={filters.unreadOnly}
                onCheckedChange={(checked) => onFiltersChange({ ...filters, unreadOnly: checked === true })}
                className="h-3.5 w-3.5"
              />
              <span>Apenas com mensagens não lidas</span>
            </label>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
