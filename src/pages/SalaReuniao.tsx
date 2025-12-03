import { useState, useEffect } from 'react';
import { Layout } from '@/components/Layout';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { toast } from 'sonner';
import { CalendarIcon, Clock, Plus, Trash2, Users, DoorOpen } from 'lucide-react';
import { format, addDays, isSameDay, parse, startOfWeek, endOfWeek, eachDayOfInterval, isToday, isBefore, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface Booking {
  id: string;
  user_id: string;
  booking_date: string;
  start_time: string;
  end_time: string;
  title: string;
  description: string | null;
  created_at: string;
  profiles?: {
    full_name: string;
    avatar_url: string | null;
  };
}

export default function SalaReuniao() {
  const { user } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [showNewBooking, setShowNewBooking] = useState(false);
  const [newBooking, setNewBooking] = useState({
    booking_date: new Date(),
    start_time: '09:00',
    end_time: '10:00',
    title: '',
    description: ''
  });

  useEffect(() => {
    fetchBookings();
  }, []);

  const fetchBookings = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('meeting_room_bookings')
      .select('*')
      .gte('booking_date', format(addDays(new Date(), -7), 'yyyy-MM-dd'))
      .order('booking_date', { ascending: true })
      .order('start_time', { ascending: true });

    if (error) {
      console.error('Error fetching bookings:', error);
      toast.error('Erro ao carregar reservas');
    } else {
      // Fetch user profiles
      const userIds = [...new Set(data?.map(b => b.user_id) || [])];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url')
        .in('id', userIds);

      const profilesMap = new Map(profiles?.map(p => [p.id, p]) || []);

      const enrichedBookings = (data || []).map(booking => ({
        ...booking,
        profiles: profilesMap.get(booking.user_id)
      }));

      setBookings(enrichedBookings);
    }
    setLoading(false);
  };

  const handleCreateBooking = async () => {
    if (!user || !newBooking.title || !newBooking.start_time || !newBooking.end_time) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }

    // Check for conflicts
    const bookingDate = format(newBooking.booking_date, 'yyyy-MM-dd');
    const conflicts = bookings.filter(b => 
      b.booking_date === bookingDate &&
      ((newBooking.start_time >= b.start_time && newBooking.start_time < b.end_time) ||
       (newBooking.end_time > b.start_time && newBooking.end_time <= b.end_time) ||
       (newBooking.start_time <= b.start_time && newBooking.end_time >= b.end_time))
    );

    if (conflicts.length > 0) {
      toast.error('Já existe uma reserva neste horário');
      return;
    }

    const { error } = await supabase
      .from('meeting_room_bookings')
      .insert({
        user_id: user.id,
        booking_date: bookingDate,
        start_time: newBooking.start_time,
        end_time: newBooking.end_time,
        title: newBooking.title,
        description: newBooking.description || null
      });

    if (error) {
      toast.error('Erro ao criar reserva');
      console.error(error);
    } else {
      toast.success('Reserva criada com sucesso');
      setShowNewBooking(false);
      setNewBooking({
        booking_date: new Date(),
        start_time: '09:00',
        end_time: '10:00',
        title: '',
        description: ''
      });
      fetchBookings();
    }
  };

  const handleDeleteBooking = async (bookingId: string) => {
    const { error } = await supabase
      .from('meeting_room_bookings')
      .delete()
      .eq('id', bookingId);

    if (error) {
      toast.error('Erro ao cancelar reserva');
    } else {
      toast.success('Reserva cancelada');
      fetchBookings();
    }
  };

  // Get bookings for selected date
  const selectedDateBookings = bookings.filter(b => 
    isSameDay(parse(b.booking_date, 'yyyy-MM-dd', new Date()), selectedDate)
  );

  // Get week days for weekly view
  const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(selectedDate, { weekStartsOn: 1 });
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });

  // Check if a date has bookings
  const hasBookings = (date: Date) => {
    return bookings.some(b => isSameDay(parse(b.booking_date, 'yyyy-MM-dd', new Date()), date));
  };

  // Time slots
  const timeSlots = [
    '08:00', '09:00', '10:00', '11:00', '12:00', '13:00', 
    '14:00', '15:00', '16:00', '17:00', '18:00', '19:00'
  ];

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-muted-foreground">Carregando...</div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <DoorOpen className="h-8 w-8" />
              Sala de Reunião
            </h1>
            <p className="text-muted-foreground mt-1">
              Reserve a sala de reunião para suas reuniões
            </p>
          </div>
          <Dialog open={showNewBooking} onOpenChange={setShowNewBooking}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Nova Reserva
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Nova Reserva</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Data *</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start text-left font-normal">
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {format(newBooking.booking_date, "PPP", { locale: ptBR })}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={newBooking.booking_date}
                        onSelect={(date) => date && setNewBooking({ ...newBooking, booking_date: date })}
                        disabled={(date) => isBefore(startOfDay(date), startOfDay(new Date()))}
                        initialFocus
                        locale={ptBR}
                        className="pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Horário Início *</Label>
                    <Input 
                      type="time" 
                      value={newBooking.start_time}
                      onChange={(e) => setNewBooking({ ...newBooking, start_time: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Horário Fim *</Label>
                    <Input 
                      type="time" 
                      value={newBooking.end_time}
                      onChange={(e) => setNewBooking({ ...newBooking, end_time: e.target.value })}
                    />
                  </div>
                </div>
                <div>
                  <Label>Título/Assunto *</Label>
                  <Input 
                    value={newBooking.title}
                    onChange={(e) => setNewBooking({ ...newBooking, title: e.target.value })}
                    placeholder="Ex: Reunião com cliente"
                  />
                </div>
                <div>
                  <Label>Descrição (opcional)</Label>
                  <Textarea 
                    value={newBooking.description}
                    onChange={(e) => setNewBooking({ ...newBooking, description: e.target.value })}
                    placeholder="Detalhes da reunião..."
                    rows={3}
                  />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="outline" onClick={() => setShowNewBooking(false)}>Cancelar</Button>
                  <Button onClick={handleCreateBooking}>Reservar</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Calendar sidebar */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Calendário</CardTitle>
            </CardHeader>
            <CardContent>
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(date) => date && setSelectedDate(date)}
                locale={ptBR}
                className="rounded-md border pointer-events-auto"
                modifiers={{
                  hasBooking: (date) => hasBookings(date)
                }}
                modifiersStyles={{
                  hasBooking: { fontWeight: 'bold', textDecoration: 'underline', color: 'hsl(var(--primary))' }
                }}
              />
              <div className="mt-4 text-sm text-muted-foreground">
                <p className="flex items-center gap-2">
                  <span className="font-bold underline text-primary">Data</span> = tem reservas
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Daily view */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>
                  {isToday(selectedDate) ? 'Hoje' : format(selectedDate, "EEEE, d 'de' MMMM", { locale: ptBR })}
                </span>
                <Badge variant="outline" className="font-normal">
                  {selectedDateBookings.length} reserva(s)
                </Badge>
              </CardTitle>
              <CardDescription>
                Reservas para o dia selecionado
              </CardDescription>
            </CardHeader>
            <CardContent>
              {selectedDateBookings.length === 0 ? (
                <div className="text-center py-12">
                  <DoorOpen className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">Nenhuma reserva para este dia</p>
                  <p className="text-sm text-muted-foreground mt-1">A sala está disponível</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {selectedDateBookings.map(booking => (
                    <div 
                      key={booking.id} 
                      className={cn(
                        "p-4 rounded-lg border",
                        booking.user_id === user?.id 
                          ? "bg-primary/5 border-primary/20" 
                          : "bg-muted/50"
                      )}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <Clock className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">
                              {booking.start_time.slice(0, 5)} - {booking.end_time.slice(0, 5)}
                            </span>
                          </div>
                          <h4 className="font-semibold">{booking.title}</h4>
                          {booking.description && (
                            <p className="text-sm text-muted-foreground mt-1">{booking.description}</p>
                          )}
                          <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
                            <Users className="h-3 w-3" />
                            <span>{booking.profiles?.full_name || 'Usuário'}</span>
                          </div>
                        </div>
                        {booking.user_id === user?.id && (
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            className="text-destructive hover:text-destructive"
                            onClick={() => handleDeleteBooking(booking.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Weekly overview */}
        <Card>
          <CardHeader>
            <CardTitle>Visão Semanal</CardTitle>
            <CardDescription>
              Semana de {format(weekStart, "d 'de' MMM", { locale: ptBR })} a {format(weekEnd, "d 'de' MMM", { locale: ptBR })}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <div className="grid grid-cols-7 gap-2 min-w-[700px]">
                {weekDays.map(day => {
                  const dayBookings = bookings.filter(b => 
                    isSameDay(parse(b.booking_date, 'yyyy-MM-dd', new Date()), day)
                  );
                  const isPast = isBefore(startOfDay(day), startOfDay(new Date()));
                  
                  return (
                    <div 
                      key={day.toISOString()} 
                      className={cn(
                        "p-3 rounded-lg border min-h-[120px] cursor-pointer transition-colors",
                        isToday(day) && "border-primary bg-primary/5",
                        isSameDay(day, selectedDate) && "ring-2 ring-primary",
                        isPast && "opacity-50"
                      )}
                      onClick={() => setSelectedDate(day)}
                    >
                      <div className="text-center mb-2">
                        <p className="text-xs text-muted-foreground">
                          {format(day, 'EEE', { locale: ptBR })}
                        </p>
                        <p className={cn(
                          "text-lg font-semibold",
                          isToday(day) && "text-primary"
                        )}>
                          {format(day, 'd')}
                        </p>
                      </div>
                      <div className="space-y-1">
                        {dayBookings.slice(0, 3).map(b => (
                          <div 
                            key={b.id} 
                            className="text-xs bg-primary/10 text-primary rounded px-1 py-0.5 truncate"
                          >
                            {b.start_time.slice(0, 5)} {b.title}
                          </div>
                        ))}
                        {dayBookings.length > 3 && (
                          <p className="text-xs text-muted-foreground text-center">
                            +{dayBookings.length - 3} mais
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}