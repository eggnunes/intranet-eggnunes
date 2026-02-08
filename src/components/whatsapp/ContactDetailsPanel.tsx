import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { X, Pencil, Check, Plus, UserPlus, Tag } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Profile {
  id: string;
  full_name: string;
  avatar_url: string | null;
}

interface TagItem {
  id: string;
  name: string;
  color: string;
}

interface ContactDetailsPanelProps {
  conversationId: string;
  contactName: string | null;
  phone: string;
  sector: string | null;
  onClose: () => void;
  onNameUpdated: (name: string) => void;
  onSectorUpdated: (sector: string | null) => void;
}

export function ContactDetailsPanel({
  conversationId,
  contactName,
  phone,
  sector,
  onClose,
  onNameUpdated,
  onSectorUpdated,
}: ContactDetailsPanelProps) {
  const { toast } = useToast();
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(contactName || '');
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [assignees, setAssignees] = useState<string[]>([]);
  const [allTags, setAllTags] = useState<TagItem[]>([]);
  const [conversationTags, setConversationTags] = useState<string[]>([]);
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState('#6B7280');
  const [showAddTag, setShowAddTag] = useState(false);

  useEffect(() => {
    fetchProfiles();
    fetchAssignees();
    fetchTags();
    fetchConversationTags();
  }, [conversationId]);

  const fetchProfiles = async () => {
    const { data } = await supabase.from('profiles').select('id, full_name, avatar_url').eq('is_active', true).order('full_name');
    if (data) setProfiles(data);
  };

  const fetchAssignees = async () => {
    const { data } = await supabase.from('whatsapp_conversation_assignees').select('user_id').eq('conversation_id', conversationId);
    if (data) setAssignees(data.map(d => d.user_id));
  };

  const fetchTags = async () => {
    const { data } = await supabase.from('whatsapp_tags').select('*').order('name');
    if (data) setAllTags(data as TagItem[]);
  };

  const fetchConversationTags = async () => {
    const { data } = await supabase.from('whatsapp_conversation_tags').select('tag_id').eq('conversation_id', conversationId);
    if (data) setConversationTags(data.map(d => d.tag_id));
  };

  const handleSaveName = async () => {
    const { error } = await supabase
      .from('whatsapp_conversations')
      .update({ contact_name: nameValue.trim() || null })
      .eq('id', conversationId);

    if (error) {
      toast({ title: 'Erro ao salvar nome', variant: 'destructive' });
    } else {
      onNameUpdated(nameValue.trim());
      setEditingName(false);
    }
  };

  const handleSectorChange = async (value: string) => {
    const sectorValue = value === 'none' ? null : value;
    const { error } = await supabase
      .from('whatsapp_conversations')
      .update({ sector: sectorValue })
      .eq('id', conversationId);

    if (error) {
      toast({ title: 'Erro ao atualizar setor', variant: 'destructive' });
    } else {
      onSectorUpdated(sectorValue);
    }
  };

  const toggleAssignee = async (userId: string) => {
    if (assignees.includes(userId)) {
      await supabase.from('whatsapp_conversation_assignees').delete().eq('conversation_id', conversationId).eq('user_id', userId);
      setAssignees(prev => prev.filter(id => id !== userId));
    } else {
      await supabase.from('whatsapp_conversation_assignees').insert({ conversation_id: conversationId, user_id: userId });
      setAssignees(prev => [...prev, userId]);
    }
  };

  const toggleTag = async (tagId: string) => {
    if (conversationTags.includes(tagId)) {
      await supabase.from('whatsapp_conversation_tags').delete().eq('conversation_id', conversationId).eq('tag_id', tagId);
      setConversationTags(prev => prev.filter(id => id !== tagId));
    } else {
      await supabase.from('whatsapp_conversation_tags').insert({ conversation_id: conversationId, tag_id: tagId });
      setConversationTags(prev => [...prev, tagId]);
    }
  };

  const handleCreateTag = async () => {
    if (!newTagName.trim()) return;
    const { data, error } = await supabase.from('whatsapp_tags').insert({ name: newTagName.trim(), color: newTagColor }).select().single();
    if (error) {
      toast({ title: 'Erro ao criar tag', description: error.message, variant: 'destructive' });
    } else if (data) {
      setAllTags(prev => [...prev, data as TagItem]);
      setNewTagName('');
      setShowAddTag(false);
    }
  };

  const formatPhone = (p: string) => {
    if (p.startsWith('55') && p.length >= 12) {
      const ddd = p.substring(2, 4);
      const num = p.substring(4);
      return num.length === 9
        ? `(${ddd}) ${num.substring(0, 5)}-${num.substring(5)}`
        : `(${ddd}) ${num.substring(0, 4)}-${num.substring(4)}`;
    }
    return p;
  };

  const tagColors = ['#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6', '#EC4899', '#6B7280', '#F97316'];

  return (
    <div className="w-80 border-l bg-card flex flex-col h-full">
      <div className="p-4 border-b flex items-center justify-between">
        <h3 className="font-semibold text-sm">Detalhes do Contato</h3>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-5">
          {/* Name */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Nome do Contato</Label>
            {editingName ? (
              <div className="flex gap-1.5">
                <Input
                  value={nameValue}
                  onChange={(e) => setNameValue(e.target.value)}
                  className="h-8 text-sm"
                  autoFocus
                  onKeyDown={(e) => e.key === 'Enter' && handleSaveName()}
                />
                <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0" onClick={handleSaveName}>
                  <Check className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0" onClick={() => setEditingName(false)}>
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{contactName || formatPhone(phone)}</span>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setNameValue(contactName || ''); setEditingName(true); }}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
            <p className="text-xs text-muted-foreground">{formatPhone(phone)}</p>
          </div>

          {/* Sector */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Setor</Label>
            <Select value={sector || 'none'} onValueChange={handleSectorChange}>
              <SelectTrigger className="h-8 text-sm">
                <SelectValue placeholder="Selecionar setor" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nenhum</SelectItem>
                <SelectItem value="comercial">Comercial</SelectItem>
                <SelectItem value="operacional">Operacional</SelectItem>
                <SelectItem value="financeiro">Financeiro</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Assignees */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground flex items-center gap-1">
              <UserPlus className="h-3.5 w-3.5" /> Responsáveis
            </Label>
            <div className="space-y-1">
              {profiles.map(p => (
                <button
                  key={p.id}
                  onClick={() => toggleAssignee(p.id)}
                  className={`w-full text-left px-2 py-1.5 rounded text-xs flex items-center gap-2 transition-colors ${
                    assignees.includes(p.id) ? 'bg-primary/10 text-primary' : 'hover:bg-accent'
                  }`}
                >
                  <div className={`h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-medium ${
                    assignees.includes(p.id) ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                  }`}>
                    {p.full_name?.charAt(0) || '?'}
                  </div>
                  <span className="truncate">{p.full_name}</span>
                  {assignees.includes(p.id) && <Check className="h-3 w-3 ml-auto flex-shrink-0" />}
                </button>
              ))}
            </div>
          </div>

          {/* Tags */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground flex items-center gap-1">
              <Tag className="h-3.5 w-3.5" /> Tags
            </Label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {allTags.map(tag => (
                <button key={tag.id} onClick={() => toggleTag(tag.id)}>
                  <Badge
                    variant="outline"
                    className="text-[10px] cursor-pointer transition-all"
                    style={{
                      backgroundColor: conversationTags.includes(tag.id) ? tag.color + '20' : undefined,
                      borderColor: tag.color,
                      color: conversationTags.includes(tag.id) ? tag.color : undefined,
                    }}
                  >
                    {tag.name}
                    {conversationTags.includes(tag.id) && <Check className="h-2.5 w-2.5 ml-0.5" />}
                  </Badge>
                </button>
              ))}
            </div>

            {showAddTag ? (
              <div className="space-y-2 p-2 border rounded bg-muted/30">
                <Input
                  placeholder="Nome da tag"
                  value={newTagName}
                  onChange={(e) => setNewTagName(e.target.value)}
                  className="h-7 text-xs"
                  onKeyDown={(e) => e.key === 'Enter' && handleCreateTag()}
                />
                <div className="flex gap-1">
                  {tagColors.map(c => (
                    <button
                      key={c}
                      className={`h-5 w-5 rounded-full border-2 transition-all ${newTagColor === c ? 'border-foreground scale-110' : 'border-transparent'}`}
                      style={{ backgroundColor: c }}
                      onClick={() => setNewTagColor(c)}
                    />
                  ))}
                </div>
                <div className="flex gap-1">
                  <Button size="sm" className="h-6 text-xs flex-1" onClick={handleCreateTag}>Criar</Button>
                  <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => setShowAddTag(false)}>Cancelar</Button>
                </div>
              </div>
            ) : (
              <Button variant="outline" size="sm" className="h-7 text-xs w-full" onClick={() => setShowAddTag(true)}>
                <Plus className="h-3 w-3 mr-1" /> Nova Tag
              </Button>
            )}
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
