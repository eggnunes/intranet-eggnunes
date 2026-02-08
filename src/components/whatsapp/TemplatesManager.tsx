import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Plus, Pencil, Trash2, Upload, FileText } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Template {
  id: string;
  shortcut: string;
  title: string;
  content: string;
  category: string;
  is_shared: boolean;
  created_by: string;
  created_at: string;
}

const CATEGORIES = ['geral', 'saudacao', 'cobranca', 'informativo', 'agendamento', 'documentos', 'outro'];

export function TemplatesManager() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [form, setForm] = useState({ shortcut: '', title: '', content: '', category: 'geral', is_shared: true });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchTemplates = async () => {
    const { data, error } = await supabase
      .from('whatsapp_templates')
      .select('*')
      .order('category')
      .order('shortcut');
    if (!error && data) setTemplates(data as Template[]);
    setLoading(false);
  };

  useEffect(() => { fetchTemplates(); }, []);

  const handleSave = async () => {
    if (!form.shortcut.trim() || !form.title.trim() || !form.content.trim() || !user) return;

    const shortcut = form.shortcut.startsWith('/') ? form.shortcut.substring(1) : form.shortcut;

    if (editingTemplate) {
      const { error } = await supabase
        .from('whatsapp_templates')
        .update({
          shortcut,
          title: form.title,
          content: form.content,
          category: form.category,
          is_shared: form.is_shared,
        })
        .eq('id', editingTemplate.id);

      if (error) {
        toast({ title: 'Erro ao atualizar', variant: 'destructive' });
      } else {
        toast({ title: 'Template atualizado!' });
      }
    } else {
      const { error } = await supabase.from('whatsapp_templates').insert({
        shortcut,
        title: form.title,
        content: form.content,
        category: form.category,
        is_shared: form.is_shared,
        created_by: user.id,
      });

      if (error) {
        toast({ title: 'Erro ao criar', variant: 'destructive' });
      } else {
        toast({ title: 'Template criado!' });
      }
    }

    setDialogOpen(false);
    setEditingTemplate(null);
    setForm({ shortcut: '', title: '', content: '', category: 'geral', is_shared: true });
    fetchTemplates();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('whatsapp_templates').delete().eq('id', id);
    if (error) {
      toast({ title: 'Erro ao deletar', variant: 'destructive' });
    } else {
      toast({ title: 'Template removido' });
      fetchTemplates();
    }
  };

  const handleEdit = (template: Template) => {
    setEditingTemplate(template);
    setForm({
      shortcut: template.shortcut,
      title: template.title,
      content: template.content,
      category: template.category,
      is_shared: template.is_shared,
    });
    setDialogOpen(true);
  };

  const handleNewTemplate = () => {
    setEditingTemplate(null);
    setForm({ shortcut: '', title: '', content: '', category: 'geral', is_shared: true });
    setDialogOpen(true);
  };

  // Bulk upload via CSV
  const handleBulkUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    const text = await file.text();
    const lines = text.split('\n').filter(l => l.trim());

    // Skip header if present
    const startIdx = lines[0].toLowerCase().includes('atalho') ? 1 : 0;
    let created = 0;

    for (let i = startIdx; i < lines.length; i++) {
      const parts = lines[i].split(/[,;]/).map(p => p.trim().replace(/^"|"$/g, ''));
      if (parts.length >= 3) {
        const [shortcut, title, ...contentParts] = parts;
        const content = contentParts.join(', ');
        const cleanShortcut = shortcut.startsWith('/') ? shortcut.substring(1) : shortcut;

        const { error } = await supabase.from('whatsapp_templates').insert({
          shortcut: cleanShortcut,
          title,
          content,
          category: 'geral',
          is_shared: true,
          created_by: user.id,
        });

        if (!error) created++;
      }
    }

    toast({ title: `${created} templates importados com sucesso!` });
    fetchTemplates();
    event.target.value = '';
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Templates de Mensagens</CardTitle>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} className="gap-2">
              <Upload className="h-4 w-4" /> Importar CSV
            </Button>
            <input ref={fileInputRef} type="file" accept=".csv,.txt" className="hidden" onChange={handleBulkUpload} />
            <Button size="sm" onClick={handleNewTemplate} className="gap-2">
              <Plus className="h-4 w-4" /> Novo Template
            </Button>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Use "/" no chat para acessar rapidamente os templates. CSV: atalho, título, conteúdo
        </p>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-center text-muted-foreground py-8">Carregando...</p>
        ) : templates.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">
            <FileText className="h-10 w-10 mx-auto mb-2 opacity-40" />
            <p>Nenhum template criado</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Atalho</TableHead>
                <TableHead>Título</TableHead>
                <TableHead>Conteúdo</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Compartilhado</TableHead>
                <TableHead className="w-24">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {templates.map(t => (
                <TableRow key={t.id}>
                  <TableCell>
                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded">/{t.shortcut}</code>
                  </TableCell>
                  <TableCell className="font-medium text-sm">{t.title}</TableCell>
                  <TableCell>
                    <p className="text-sm text-muted-foreground truncate max-w-xs">{t.content}</p>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">{t.category}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={t.is_shared ? 'default' : 'secondary'} className="text-xs">
                      {t.is_shared ? 'Sim' : 'Não'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(t)}>
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(t.id)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {/* Create/Edit Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingTemplate ? 'Editar Template' : 'Novo Template'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Atalho *</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-sm text-muted-foreground">/</span>
                    <Input
                      className="pl-7"
                      placeholder="saudacao"
                      value={form.shortcut}
                      onChange={(e) => setForm(prev => ({ ...prev, shortcut: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Categoria</Label>
                  <Select value={form.category} onValueChange={(v) => setForm(prev => ({ ...prev, category: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map(c => (
                        <SelectItem key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Título *</Label>
                <Input
                  placeholder="Nome do template"
                  value={form.title}
                  onChange={(e) => setForm(prev => ({ ...prev, title: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Conteúdo *</Label>
                <Textarea
                  placeholder="Texto da mensagem..."
                  value={form.content}
                  onChange={(e) => setForm(prev => ({ ...prev, content: e.target.value }))}
                  rows={5}
                />
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={form.is_shared}
                  onCheckedChange={(v) => setForm(prev => ({ ...prev, is_shared: v }))}
                />
                <Label>Compartilhar com todos</Label>
              </div>
              <Button onClick={handleSave} className="w-full" disabled={!form.shortcut.trim() || !form.title.trim() || !form.content.trim()}>
                {editingTemplate ? 'Atualizar' : 'Criar Template'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
