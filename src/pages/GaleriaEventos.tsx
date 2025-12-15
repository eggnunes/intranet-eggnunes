import { useState, useEffect } from 'react';
import { Layout } from '@/components/Layout';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useUserRole } from '@/hooks/useUserRole';
import { useAdminPermissions } from '@/hooks/useAdminPermissions';
import { Camera, Plus, Trash2, Upload, Calendar, Lock, Download, X, ZoomIn } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { format, parse } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

interface Event {
  id: string;
  title: string;
  description: string | null;
  event_date: string;
  created_at: string;
}

interface EventPhoto {
  id: string;
  event_id: string;
  photo_url: string;
  caption: string | null;
  uploaded_by: string;
  created_at: string;
}

const GaleriaEventos = () => {
  const [events, setEvents] = useState<Event[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [photos, setPhotos] = useState<EventPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [eventDialogOpen, setEventDialogOpen] = useState(false);
  const [photoDialogOpen, setPhotoDialogOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [lightboxPhoto, setLightboxPhoto] = useState<EventPhoto | null>(null);
  const { isAdmin } = useUserRole();
  const { canView, loading: permLoading } = useAdminPermissions();
  const { toast } = useToast();

  const handleDownloadPhoto = async (photoUrl: string, photoName?: string) => {
    try {
      const response = await fetch(photoUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = photoName || `foto-evento-${Date.now()}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      toast({
        title: 'Download iniciado',
        description: 'A foto está sendo baixada.'
      });
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Não foi possível baixar a foto.',
        variant: 'destructive'
      });
    }
  };

  const hasEventsAccess = canView('events');

  const [eventFormData, setEventFormData] = useState({
    title: '',
    description: '',
    event_date: new Date()
  });

  const [photoFiles, setPhotoFiles] = useState<FileList | null>(null);

  useEffect(() => {
    const getCurrentUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUserId(user?.id || null);
    };
    getCurrentUser();
    fetchEvents();
  }, []);

  useEffect(() => {
    if (selectedEvent) {
      fetchPhotos(selectedEvent.id);
    }
  }, [selectedEvent]);

  const fetchEvents = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('event_gallery')
      .select('*')
      .order('event_date', { ascending: false });

    if (error) {
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar os eventos.',
        variant: 'destructive'
      });
    } else {
      setEvents(data || []);
      if (data && data.length > 0 && !selectedEvent) {
        setSelectedEvent(data[0]);
      }
    }
    setLoading(false);
  };

  const fetchPhotos = async (eventId: string) => {
    const { data, error } = await supabase
      .from('event_photos')
      .select('*')
      .eq('event_id', eventId)
      .order('created_at', { ascending: false });

    if (error) {
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar as fotos.',
        variant: 'destructive'
      });
    } else {
      setPhotos(data || []);
    }
  };

  const handleCreateEvent = async () => {
    if (!eventFormData.title) {
      toast({
        title: 'Erro',
        description: 'Preencha o título do evento.',
        variant: 'destructive'
      });
      return;
    }

    setUploading(true);

    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error('Usuário não autenticado');

      const { error } = await supabase
        .from('event_gallery')
        .insert({
          title: eventFormData.title,
          description: eventFormData.description,
          event_date: format(eventFormData.event_date, 'yyyy-MM-dd'),
          created_by: userData.user.id
        });

      if (error) throw error;

      toast({
        title: 'Sucesso',
        description: 'Evento criado com sucesso!'
      });

      setEventDialogOpen(false);
      setEventFormData({ title: '', description: '', event_date: new Date() });
      fetchEvents();
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

  const handleUploadPhotos = async () => {
    if (!photoFiles || photoFiles.length === 0 || !selectedEvent) {
      toast({
        title: 'Erro',
        description: 'Selecione pelo menos uma foto.',
        variant: 'destructive'
      });
      return;
    }

    setUploading(true);

    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error('Usuário não autenticado');

      const uploadPromises = Array.from(photoFiles).map(async (file) => {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Math.random()}.${fileExt}`;
        const filePath = `${selectedEvent.id}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('event-photos')
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('event-photos')
          .getPublicUrl(filePath);

        return {
          event_id: selectedEvent.id,
          photo_url: publicUrl,
          uploaded_by: userData.user.id
        };
      });

      const photoData = await Promise.all(uploadPromises);

      const { error: insertError } = await supabase
        .from('event_photos')
        .insert(photoData);

      if (insertError) throw insertError;

      toast({
        title: 'Sucesso',
        description: `${photoFiles.length} foto(s) adicionada(s) com sucesso!`
      });

      setPhotoDialogOpen(false);
      setPhotoFiles(null);
      fetchPhotos(selectedEvent.id);
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

  const handleDeleteEvent = async (id: string) => {
    if (!confirm('Deseja realmente excluir este evento e todas as suas fotos?')) return;

    try {
      const { error } = await supabase
        .from('event_gallery')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: 'Sucesso',
        description: 'Evento excluído com sucesso!'
      });

      setSelectedEvent(null);
      fetchEvents();
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message,
        variant: 'destructive'
      });
    }
  };

  const handleDeletePhoto = async (id: string, photoUrl: string) => {
    if (!confirm('Deseja realmente excluir esta foto?')) return;

    try {
      const fileName = photoUrl.split('/').slice(-2).join('/');
      await supabase.storage
        .from('event-photos')
        .remove([fileName]);

      const { error } = await supabase
        .from('event_photos')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: 'Sucesso',
        description: 'Foto excluída com sucesso!'
      });

      if (selectedEvent) {
        fetchPhotos(selectedEvent.id);
      }
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message,
        variant: 'destructive'
      });
    }
  };

  if (loading || permLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[400px]">
          <p className="text-muted-foreground">Carregando galeria...</p>
        </div>
      </Layout>
    );
  }

  if (!hasEventsAccess) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
          <Lock className="h-16 w-16 text-muted-foreground" />
          <h2 className="text-xl font-semibold">Acesso Restrito</h2>
          <p className="text-muted-foreground text-center max-w-md">
            Você não tem permissão para acessar a galeria de eventos.
          </p>
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
              <Camera className="h-8 w-8" />
              Galeria de Eventos
            </h1>
            <p className="text-muted-foreground mt-2">
              Fotos de confraternizações e eventos do escritório
            </p>
          </div>
          <div className="flex gap-2">
            {isAdmin && (
              <Dialog open={eventDialogOpen} onOpenChange={setEventDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline">
                    <Plus className="h-4 w-4 mr-2" />
                    Novo Evento
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Criar Novo Evento</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="event-title">Título *</Label>
                      <Input
                        id="event-title"
                        value={eventFormData.title}
                        onChange={(e) => setEventFormData({ ...eventFormData, title: e.target.value })}
                        placeholder="Ex: Confraternização de Fim de Ano"
                      />
                    </div>
                    <div>
                      <Label htmlFor="event-date">Data do Evento *</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className="w-full justify-start">
                            <Calendar className="mr-2 h-4 w-4" />
                            {format(eventFormData.event_date, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                          <CalendarComponent
                            mode="single"
                            selected={eventFormData.event_date}
                            onSelect={(date) => date && setEventFormData({ ...eventFormData, event_date: date })}
                            locale={ptBR}
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                    <div>
                      <Label htmlFor="event-description">Descrição</Label>
                      <Textarea
                        id="event-description"
                        value={eventFormData.description}
                        onChange={(e) => setEventFormData({ ...eventFormData, description: e.target.value })}
                        placeholder="Descrição opcional do evento"
                      />
                    </div>
                    <Button onClick={handleCreateEvent} disabled={uploading} className="w-full">
                      {uploading ? 'Criando...' : 'Criar Evento'}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            )}
            {selectedEvent && (
              <Dialog open={photoDialogOpen} onOpenChange={setPhotoDialogOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Upload className="h-4 w-4 mr-2" />
                    Adicionar Fotos
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Adicionar Fotos ao Evento</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="photos">Fotos *</Label>
                      <Input
                        id="photos"
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={(e) => setPhotoFiles(e.target.files)}
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Você pode selecionar múltiplas fotos
                      </p>
                    </div>
                    <Button onClick={handleUploadPhotos} disabled={uploading} className="w-full">
                      {uploading ? 'Enviando...' : 'Adicionar Fotos'}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle>Eventos</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {events.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Nenhum evento cadastrado
                  </p>
                ) : (
                  events.map((event) => (
                    <div
                      key={event.id}
                      className={`p-3 rounded-lg cursor-pointer transition-colors ${
                        selectedEvent?.id === event.id
                          ? 'bg-primary text-primary-foreground'
                          : 'hover:bg-muted'
                      }`}
                      onClick={() => setSelectedEvent(event)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className="font-medium text-sm">{event.title}</p>
                          <p className="text-xs opacity-80">
                            {format(parse(event.event_date, 'yyyy-MM-dd', new Date()), "dd/MM/yyyy")}
                          </p>
                        </div>
                        {isAdmin && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 w-6 p-0"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteEvent(event.id);
                            }}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-3">
            {selectedEvent ? (
              <div className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>{selectedEvent.title}</CardTitle>
                    <CardDescription>
                      {format(parse(selectedEvent.event_date, 'yyyy-MM-dd', new Date()), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                    </CardDescription>
                    {selectedEvent.description && (
                      <p className="text-sm text-muted-foreground mt-2">{selectedEvent.description}</p>
                    )}
                  </CardHeader>
                </Card>

                {photos.length === 0 ? (
                  <Card>
                    <CardContent className="py-12 text-center">
                      <Camera className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                      <p className="text-muted-foreground">
                        Nenhuma foto disponível para este evento.
                      </p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {photos.map((photo) => {
                      const canDelete = isAdmin || photo.uploaded_by === currentUserId;
                      
                      return (
                        <div key={photo.id} className="relative group">
                          <img
                            src={photo.photo_url}
                            alt={photo.caption || 'Foto do evento'}
                            className="w-full h-48 object-cover rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                            onClick={() => setLightboxPhoto(photo)}
                          />
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors rounded-lg pointer-events-none" />
                          <div className="absolute bottom-2 left-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button
                              size="sm"
                              variant="secondary"
                              className="h-8 w-8 p-0"
                              onClick={(e) => {
                                e.stopPropagation();
                                setLightboxPhoto(photo);
                              }}
                              title="Ver em tamanho maior"
                            >
                              <ZoomIn className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="secondary"
                              className="h-8 w-8 p-0"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDownloadPhoto(photo.photo_url);
                              }}
                              title="Baixar foto"
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                          </div>
                          {canDelete && (
                            <Button
                              size="sm"
                              variant="destructive"
                              className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeletePhoto(photo.id, photo.photo_url);
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : (
              <Card>
                <CardContent className="py-12 text-center">
                  <Camera className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">
                    Selecione um evento para ver as fotos
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>

      {/* Lightbox Modal */}
      {lightboxPhoto && (
        <div 
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setLightboxPhoto(null)}
        >
          <div className="absolute top-4 right-4 flex gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={(e) => {
                e.stopPropagation();
                handleDownloadPhoto(lightboxPhoto.photo_url);
              }}
              title="Baixar foto"
            >
              <Download className="h-4 w-4 mr-2" />
              Baixar
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setLightboxPhoto(null)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <img
            src={lightboxPhoto.photo_url}
            alt={lightboxPhoto.caption || 'Foto do evento'}
            className="max-w-full max-h-[90vh] object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </Layout>
  );
};

export default GaleriaEventos;
