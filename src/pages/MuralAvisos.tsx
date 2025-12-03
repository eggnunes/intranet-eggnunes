import { useState, useEffect } from 'react';
import { Layout } from '@/components/Layout';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useUserRole } from '@/hooks/useUserRole';
import { useAdminPermissions } from '@/hooks/useAdminPermissions';
import { useAuth } from '@/hooks/useAuth';
import { Megaphone, Plus, Trash2, Pin, Calendar, Trophy } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Switch } from '@/components/ui/switch';

interface Announcement {
  id: string;
  title: string;
  content: string;
  type: 'comunicado' | 'evento' | 'conquista';
  is_pinned: boolean;
  attachment_url: string | null;
  created_at: string;
}

const MuralAvisos = () => {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const { isAdmin } = useUserRole();
  const { canEdit, isSocioOrRafael } = useAdminPermissions();
  const { toast } = useToast();
  const { user } = useAuth();
  
  // Check if user can manage announcements
  const canManageAnnouncements = isSocioOrRafael || canEdit('announcements');

  const [formData, setFormData] = useState({
    title: '',
    content: '',
    type: 'comunicado' as 'comunicado' | 'evento' | 'conquista',
    is_pinned: false
  });

  useEffect(() => {
    fetchAnnouncements();
  }, []);

  useEffect(() => {
    // Marcar avisos como lidos quando a página é carregada
    if (user && announcements.length > 0) {
      markAnnouncementsAsRead();
    }
  }, [user, announcements.length]);

  const fetchAnnouncements = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('announcements')
      .select('*')
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) {
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar os avisos.',
        variant: 'destructive'
      });
    } else {
      setAnnouncements((data as Announcement[]) || []);
    }
    setLoading(false);
  };

  const markAnnouncementsAsRead = async () => {
    if (!user) return;

    try {
      // Buscar avisos que o usuário ainda não leu
      const { data: readAnnouncements } = await supabase
        .from('announcement_reads')
        .select('announcement_id')
        .eq('user_id', user.id);

      const readIds = new Set(readAnnouncements?.map(r => r.announcement_id) || []);
      const unreadAnnouncements = announcements.filter(a => !readIds.has(a.id));

      if (unreadAnnouncements.length > 0) {
        // Marcar todos como lidos
        const reads = unreadAnnouncements.map(a => ({
          announcement_id: a.id,
          user_id: user.id
        }));

        await supabase
          .from('announcement_reads')
          .insert(reads);
      }
    } catch (error) {
      console.error('Erro ao marcar avisos como lidos:', error);
    }
  };

  const handleCreate = async () => {
    if (!formData.title || !formData.content) {
      toast({
        title: 'Erro',
        description: 'Preencha todos os campos obrigatórios.',
        variant: 'destructive'
      });
      return;
    }

    setUploading(true);

    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error('Usuário não autenticado');

      const { error } = await supabase
        .from('announcements')
        .insert({
          title: formData.title,
          content: formData.content,
          type: formData.type,
          is_pinned: formData.is_pinned,
          created_by: userData.user.id
        });

      if (error) throw error;

      toast({
        title: 'Sucesso',
        description: 'Aviso criado com sucesso!'
      });

      setDialogOpen(false);
      setFormData({ title: '', content: '', type: 'comunicado', is_pinned: false });
      fetchAnnouncements();
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Deseja realmente excluir este aviso?')) return;

    try {
      const { error } = await supabase
        .from('announcements')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: 'Sucesso',
        description: 'Aviso excluído com sucesso!'
      });

      fetchAnnouncements();
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message,
        variant: 'destructive'
      });
    }
  };

  const handleTogglePin = async (id: string, isPinned: boolean) => {
    try {
      const { error } = await supabase
        .from('announcements')
        .update({ is_pinned: isPinned })
        .eq('id', id);

      if (error) throw error;

      toast({
        title: 'Sucesso',
        description: isPinned ? 'Aviso fixado no topo!' : 'Aviso desfixado!'
      });

      fetchAnnouncements();
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message,
        variant: 'destructive'
      });
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'comunicado':
        return <Megaphone className="h-5 w-5" />;
      case 'evento':
        return <Calendar className="h-5 w-5" />;
      case 'conquista':
        return <Trophy className="h-5 w-5" />;
      default:
        return <Megaphone className="h-5 w-5" />;
    }
  };

  const getTypeBadgeVariant = (type: string) => {
    switch (type) {
      case 'comunicado':
        return 'default';
      case 'evento':
        return 'secondary';
      case 'conquista':
        return 'outline';
      default:
        return 'default';
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[400px]">
          <p className="text-muted-foreground">Carregando avisos...</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Megaphone className="h-8 w-8" />
              Mural de Avisos
            </h1>
            <p className="text-muted-foreground mt-2">
              Comunicados, eventos e conquistas do escritório
            </p>
          </div>
          {canManageAnnouncements && (
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Novo Aviso
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Criar Novo Aviso</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="title">Título *</Label>
                    <Input
                      id="title"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      placeholder="Título do aviso"
                    />
                  </div>
                  <div>
                    <Label htmlFor="type">Tipo *</Label>
                    <Select
                      value={formData.type}
                      onValueChange={(value: any) => setFormData({ ...formData, type: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="comunicado">Comunicado</SelectItem>
                        <SelectItem value="evento">Evento</SelectItem>
                        <SelectItem value="conquista">Conquista</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="content">Conteúdo *</Label>
                    <Textarea
                      id="content"
                      value={formData.content}
                      onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                      placeholder="Conteúdo do aviso"
                      rows={5}
                    />
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="pinned"
                      checked={formData.is_pinned}
                      onCheckedChange={(checked) => setFormData({ ...formData, is_pinned: checked })}
                    />
                    <Label htmlFor="pinned">Fixar no topo</Label>
                  </div>
                  <Button onClick={handleCreate} disabled={uploading} className="w-full">
                    {uploading ? 'Criando...' : 'Criar Aviso'}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>

        {announcements.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Megaphone className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">
                Nenhum aviso disponível no momento.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {announcements.map((announcement) => (
              <Card key={announcement.id} className={announcement.is_pinned ? 'border-primary' : ''}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3 flex-1">
                      {getTypeIcon(announcement.type)}
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <CardTitle>{announcement.title}</CardTitle>
                          {announcement.is_pinned && (
                            <Pin className="h-4 w-4 text-primary" />
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={getTypeBadgeVariant(announcement.type)} className="capitalize">
                            {announcement.type}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(announcement.created_at), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                          </span>
                        </div>
                      </div>
                    </div>
                    {canManageAnnouncements && (
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleTogglePin(announcement.id, !announcement.is_pinned);
                          }}
                          title={announcement.is_pinned ? "Desafixar" : "Fixar no topo"}
                        >
                          <Pin className={`h-4 w-4 ${announcement.is_pinned ? 'text-primary fill-primary' : 'text-muted-foreground'}`} />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(announcement.id);
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground whitespace-pre-wrap">{announcement.content}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
};

export default MuralAvisos;
