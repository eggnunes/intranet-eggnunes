import { useState, useEffect, useRef } from 'react';
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
import { useEmailNotification } from '@/hooks/useEmailNotification';
import { Megaphone, Plus, Trash2, Pin, Calendar, Trophy, Upload, Link2, X, Download, ExternalLink, FileText, Image, Video, File, BookmarkPlus, Copy } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Switch } from '@/components/ui/switch';

interface Attachment {
  id: string;
  announcement_id: string;
  file_name: string;
  file_url: string;
  file_type: string | null;
  file_size: number | null;
  is_link: boolean;
  created_at: string;
}

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
  const [attachmentsMap, setAttachmentsMap] = useState<Record<string, Attachment[]>>({});
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const { isAdmin } = useUserRole();
  const { canEdit, isSocioOrRafael } = useAdminPermissions();
  const { toast } = useToast();
  const { user } = useAuth();
  const { sendAnnouncementEmail } = useEmailNotification();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const canManageAnnouncements = isSocioOrRafael || canEdit('announcements');

  const [formData, setFormData] = useState({
    title: '',
    content: '',
    type: 'comunicado' as 'comunicado' | 'evento' | 'conquista',
    is_pinned: false
  });
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [linkInput, setLinkInput] = useState('');
  const [pendingLinks, setPendingLinks] = useState<string[]>([]);

  useEffect(() => {
    fetchAnnouncements();
  }, []);

  useEffect(() => {
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
      toast({ title: 'Erro', description: 'Não foi possível carregar os avisos.', variant: 'destructive' });
    } else {
      const anns = (data as Announcement[]) || [];
      setAnnouncements(anns);
      if (anns.length > 0) {
        fetchAttachments(anns.map(a => a.id));
      }
    }
    setLoading(false);
  };

  const fetchAttachments = async (announcementIds: string[]) => {
    const { data } = await supabase
      .from('announcement_attachments')
      .select('*')
      .in('announcement_id', announcementIds);

    if (data) {
      const map: Record<string, Attachment[]> = {};
      (data as Attachment[]).forEach(att => {
        if (!map[att.announcement_id]) map[att.announcement_id] = [];
        map[att.announcement_id].push(att);
      });
      setAttachmentsMap(map);
    }
  };

  const markAnnouncementsAsRead = async () => {
    if (!user) return;
    try {
      const { data: readAnnouncements } = await supabase
        .from('announcement_reads')
        .select('announcement_id')
        .eq('user_id', user.id);

      const readIds = new Set(readAnnouncements?.map(r => r.announcement_id) || []);
      const unreadAnnouncements = announcements.filter(a => !readIds.has(a.id));

      if (unreadAnnouncements.length > 0) {
        const reads = unreadAnnouncements.map(a => ({
          announcement_id: a.id,
          user_id: user.id
        }));
        await supabase.from('announcement_reads').insert(reads);
      }
    } catch (error) {
      console.error('Erro ao marcar avisos como lidos:', error);
    }
  };

  const handleAddLink = () => {
    const trimmed = linkInput.trim();
    if (!trimmed) return;
    if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
      toast({ title: 'Link inválido', description: 'O link deve começar com http:// ou https://', variant: 'destructive' });
      return;
    }
    setPendingLinks(prev => [...prev, trimmed]);
    setLinkInput('');
  };

  const handleCreate = async () => {
    if (!formData.title || !formData.content) {
      toast({ title: 'Erro', description: 'Preencha todos os campos obrigatórios.', variant: 'destructive' });
      return;
    }

    setUploading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error('Usuário não autenticado');

      const { data: announcementData, error } = await supabase
        .from('announcements')
        .insert({
          title: formData.title,
          content: formData.content,
          type: formData.type,
          is_pinned: formData.is_pinned,
          created_by: userData.user.id
        })
        .select('id')
        .single();

      if (error) throw error;
      const announcementId = announcementData.id;

      // Upload files
      for (const file of pendingFiles) {
        const ext = file.name.split('.').pop();
        const path = `${announcementId}/${Date.now()}_${file.name}`;
        const { error: uploadError } = await supabase.storage
          .from('announcement-attachments')
          .upload(path, file);

        if (uploadError) {
          console.error('Upload error:', uploadError);
          continue;
        }

        const { data: urlData } = supabase.storage
          .from('announcement-attachments')
          .getPublicUrl(path);

        await supabase.from('announcement_attachments').insert({
          announcement_id: announcementId,
          file_name: file.name,
          file_url: urlData.publicUrl,
          file_type: file.type,
          file_size: file.size,
          is_link: false,
          uploaded_by: userData.user.id
        });
      }

      // Save links
      for (const link of pendingLinks) {
        const linkName = new URL(link).hostname;
        await supabase.from('announcement_attachments').insert({
          announcement_id: announcementId,
          file_name: linkName,
          file_url: link,
          file_type: 'link',
          file_size: null,
          is_link: true,
          uploaded_by: userData.user.id
        });
      }

      // Send email notifications
      const { data: activeUsers } = await supabase
        .from('profiles')
        .select('id, email, full_name')
        .eq('is_active', true)
        .eq('is_suspended', false)
        .eq('approval_status', 'approved');

      if (activeUsers) {
        for (const recipient of activeUsers) {
          if (recipient.email && recipient.id !== userData.user.id) {
            sendAnnouncementEmail(
              recipient.email, recipient.id, recipient.full_name || 'Colaborador',
              formData.title, formData.content
            ).catch(err => console.error('Error sending announcement email:', err));
          }
        }
      }

      toast({ title: 'Sucesso', description: 'Aviso criado com sucesso!' });
      setDialogOpen(false);
      setFormData({ title: '', content: '', type: 'comunicado', is_pinned: false });
      setPendingFiles([]);
      setPendingLinks([]);
      fetchAnnouncements();
    } catch (error: any) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Deseja realmente excluir este aviso?')) return;
    try {
      const { error } = await supabase.from('announcements').delete().eq('id', id);
      if (error) throw error;
      toast({ title: 'Sucesso', description: 'Aviso excluído com sucesso!' });
      fetchAnnouncements();
    } catch (error: any) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    }
  };

  const handleTogglePin = async (id: string, isPinned: boolean) => {
    try {
      const { error } = await supabase.from('announcements').update({ is_pinned: isPinned }).eq('id', id);
      if (error) throw error;
      toast({ title: 'Sucesso', description: isPinned ? 'Aviso fixado no topo!' : 'Aviso desfixado!' });
      fetchAnnouncements();
    } catch (error: any) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    }
  };

  const handleSaveToUsefulDocs = async (att: Attachment) => {
    if (!user) return;
    try {
      const { error } = await supabase.from('useful_documents').insert({
        title: att.file_name,
        file_url: att.file_url,
        description: att.is_link ? 'Link do Mural de Avisos' : 'Anexo do Mural de Avisos',
        uploaded_by: user.id
      });
      if (error) throw error;
      toast({ title: 'Sucesso', description: 'Documento salvo em Documentos Úteis!' });
    } catch (error: any) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    }
  };

  const handleDeleteAttachment = async (att: Attachment) => {
    try {
      // Delete from storage if not a link
      if (!att.is_link) {
        const urlParts = att.file_url.split('/announcement-attachments/');
        if (urlParts[1]) {
          await supabase.storage.from('announcement-attachments').remove([decodeURIComponent(urlParts[1])]);
        }
      }
      await supabase.from('announcement_attachments').delete().eq('id', att.id);
      toast({ title: 'Sucesso', description: 'Anexo removido!' });
      fetchAnnouncements();
    } catch (error: any) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'comunicado': return <Megaphone className="h-5 w-5" />;
      case 'evento': return <Calendar className="h-5 w-5" />;
      case 'conquista': return <Trophy className="h-5 w-5" />;
      default: return <Megaphone className="h-5 w-5" />;
    }
  };

  const getTypeBadgeVariant = (type: string) => {
    switch (type) {
      case 'comunicado': return 'default';
      case 'evento': return 'secondary';
      case 'conquista': return 'outline';
      default: return 'default';
    }
  };

  const getFileIcon = (fileType: string | null, isLink: boolean) => {
    if (isLink) return <Link2 className="h-4 w-4" />;
    if (!fileType) return <File className="h-4 w-4" />;
    if (fileType.startsWith('image/')) return <Image className="h-4 w-4" />;
    if (fileType.startsWith('video/')) return <Video className="h-4 w-4" />;
    if (fileType.includes('pdf')) return <FileText className="h-4 w-4 text-red-500" />;
    if (fileType.includes('word') || fileType.includes('document')) return <FileText className="h-4 w-4 text-blue-500" />;
    return <File className="h-4 w-4" />;
  };

  const isImage = (fileType: string | null) => fileType?.startsWith('image/');
  const isVideo = (fileType: string | null) => fileType?.startsWith('video/');

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
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

                  {/* Attachments section */}
                  <div className="space-y-3">
                    <Label>Anexos</Label>

                    {/* File upload */}
                    <div
                      className="border-2 border-dashed border-border rounded-lg p-4 text-center cursor-pointer hover:border-primary/50 transition-colors"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Upload className="h-6 w-6 mx-auto text-muted-foreground mb-2" />
                      <p className="text-sm text-muted-foreground">
                        Clique para selecionar arquivos (imagens, PDFs, vídeos, Word, etc.)
                      </p>
                      <input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        className="hidden"
                        accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv"
                        onChange={(e) => {
                          if (e.target.files) {
                            setPendingFiles(prev => [...prev, ...Array.from(e.target.files!)]);
                          }
                        }}
                      />
                    </div>

                    {/* Pending files list */}
                    {pendingFiles.length > 0 && (
                      <div className="space-y-1">
                        {pendingFiles.map((file, i) => (
                          <div key={i} className="flex items-center justify-between bg-muted/50 rounded px-3 py-1.5 text-sm">
                            <span className="truncate">{file.name} ({formatFileSize(file.size)})</span>
                            <Button size="sm" variant="ghost" onClick={() => setPendingFiles(prev => prev.filter((_, idx) => idx !== i))}>
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Link input */}
                    <div className="flex gap-2">
                      <Input
                        value={linkInput}
                        onChange={(e) => setLinkInput(e.target.value)}
                        placeholder="https://exemplo.com/documento"
                        onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddLink())}
                      />
                      <Button type="button" variant="outline" onClick={handleAddLink}>
                        <Link2 className="h-4 w-4 mr-1" />
                        Adicionar
                      </Button>
                    </div>

                    {/* Pending links */}
                    {pendingLinks.length > 0 && (
                      <div className="space-y-1">
                        {pendingLinks.map((link, i) => (
                          <div key={i} className="flex items-center justify-between bg-muted/50 rounded px-3 py-1.5 text-sm">
                            <span className="truncate flex items-center gap-1"><Link2 className="h-3 w-3" />{link}</span>
                            <Button size="sm" variant="ghost" onClick={() => setPendingLinks(prev => prev.filter((_, idx) => idx !== i))}>
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
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
              <p className="text-muted-foreground">Nenhum aviso disponível no momento.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {announcements.map((announcement) => {
              const atts = attachmentsMap[announcement.id] || [];
              return (
                <Card key={announcement.id} className={announcement.is_pinned ? 'border-primary' : ''}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3 flex-1">
                        {getTypeIcon(announcement.type)}
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <CardTitle>{announcement.title}</CardTitle>
                            {announcement.is_pinned && <Pin className="h-4 w-4 text-primary" />}
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
                          <Button size="sm" variant="ghost" onClick={() => handleTogglePin(announcement.id, !announcement.is_pinned)}
                            title={announcement.is_pinned ? "Desafixar" : "Fixar no topo"}>
                            <Pin className={`h-4 w-4 ${announcement.is_pinned ? 'text-primary fill-primary' : 'text-muted-foreground'}`} />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => handleDelete(announcement.id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-muted-foreground whitespace-pre-wrap">{announcement.content}</p>

                    {/* Attachments display */}
                    {atts.length > 0 && (
                      <div className="space-y-3 pt-2 border-t">
                        <p className="text-sm font-medium">Anexos ({atts.length})</p>

                        {/* Image previews */}
                        {atts.filter(a => isImage(a.file_type)).length > 0 && (
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                            {atts.filter(a => isImage(a.file_type)).map(att => (
                              <a key={att.id} href={att.file_url} target="_blank" rel="noopener noreferrer" className="block">
                                <img src={att.file_url} alt={att.file_name} className="rounded-md object-cover w-full h-32 border" />
                              </a>
                            ))}
                          </div>
                        )}

                        {/* Video previews */}
                        {atts.filter(a => isVideo(a.file_type)).map(att => (
                          <video key={att.id} controls className="rounded-md w-full max-h-64">
                            <source src={att.file_url} type={att.file_type || 'video/mp4'} />
                          </video>
                        ))}

                        {/* Files and links list */}
                        <div className="space-y-1.5">
                          {atts.filter(a => !isImage(a.file_type) && !isVideo(a.file_type)).map(att => (
                            <div key={att.id} className="flex items-center justify-between bg-muted/30 rounded-md px-3 py-2 text-sm">
                              <div className="flex items-center gap-2 min-w-0">
                                {getFileIcon(att.file_type, att.is_link)}
                                <span className="truncate">{att.file_name}</span>
                                {att.file_size && <span className="text-muted-foreground text-xs shrink-0">({formatFileSize(att.file_size)})</span>}
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                <Button size="sm" variant="ghost" asChild>
                                  <a href={att.file_url} target="_blank" rel="noopener noreferrer">
                                    {att.is_link ? <ExternalLink className="h-3.5 w-3.5" /> : <Download className="h-3.5 w-3.5" />}
                                  </a>
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Action buttons for all attachments */}
                        <div className="flex flex-wrap gap-1.5">
                          {atts.map(att => (
                            <div key={`actions-${att.id}`} className="flex items-center gap-1">
                              <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => handleSaveToUsefulDocs(att)}>
                                <BookmarkPlus className="h-3 w-3 mr-1" />
                                {att.file_name.length > 15 ? att.file_name.slice(0, 15) + '…' : att.file_name} → Docs Úteis
                              </Button>
                              {canManageAnnouncements && (
                                <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => handleDeleteAttachment(att)}>
                                  <Trash2 className="h-3 w-3 text-destructive" />
                                </Button>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </Layout>
  );
};

export default MuralAvisos;
