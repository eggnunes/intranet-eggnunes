import { useState, useEffect } from 'react';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { useAdminPermissions } from '@/hooks/useAdminPermissions';
import { supabase } from '@/integrations/supabase/client';
import { 
  Home, Calendar, Users, ArrowRightLeft, Check, X, Clock,
  Plus, Trash2, Bell, AlertCircle, BarChart3, FileSpreadsheet, FileText, Download, Shuffle, Building
} from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isSameMonth, isToday, addMonths, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface Profile {
  id: string;
  full_name: string;
  avatar_url: string | null;
  position: string | null;
}

interface HomeOfficeSchedule {
  id: string;
  user_id: string;
  day_of_week: number;
  month: number;
  year: number;
  profile?: Profile;
}

interface SwapRequest {
  id: string;
  requester_id: string;
  target_id: string;
  requester_original_date: string;
  target_original_date: string;
  status: string;
  created_at: string;
  requester_profile?: Profile;
  target_profile?: Profile;
}

const DAYS_OF_WEEK = [
  { value: 1, label: 'Segunda-feira', short: 'Seg' },
  { value: 2, label: 'Terça-feira', short: 'Ter' },
  { value: 3, label: 'Quarta-feira', short: 'Qua' },
  { value: 4, label: 'Quinta-feira', short: 'Qui' },
  { value: 5, label: 'Sexta-feira', short: 'Sex' },
];

const HomeOffice = () => {
  const [schedules, setSchedules] = useState<HomeOfficeSchedule[]>([]);
  const [lawyers, setLawyers] = useState<Profile[]>([]);
  const [swapRequests, setSwapRequests] = useState<SwapRequest[]>([]);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedLawyer, setSelectedLawyer] = useState<string>('');
  const [selectedDays, setSelectedDays] = useState<number[]>([]);
  const [isAddingSchedule, setIsAddingSchedule] = useState(false);
  const [swapTargetId, setSwapTargetId] = useState<string>('');
  const [swapMyDate, setSwapMyDate] = useState<string>('');
  const [swapTargetDate, setSwapTargetDate] = useState<string>('');
  const [isRequestingSwap, setIsRequestingSwap] = useState(false);
  const [userProfile, setUserProfile] = useState<Profile | null>(null);
  
  // Randomizer state
  const [randomDialogOpen, setRandomDialogOpen] = useState(false);
  const [selectedLawyersForRandom, setSelectedLawyersForRandom] = useState<string[]>([]);
  const [mandatoryOfficeDay, setMandatoryOfficeDay] = useState<number>(3); // Default Wednesday
  const [isRandomizing, setIsRandomizing] = useState(false);
  
  const { toast } = useToast();
  const { user } = useAuth();
  const { isAdmin } = useUserRole();
  const { canEdit } = useAdminPermissions();

  const month = currentMonth.getMonth() + 1;
  const year = currentMonth.getFullYear();
  const monthLabel = format(currentMonth, 'MMMM yyyy', { locale: ptBR });

  const isLawyer = userProfile?.position === 'advogado';
  
  // Check if user can manage home office
  const canManageHomeOffice = isAdmin && (canEdit('home_office') || canEdit('users'));

  // Randomize home office schedule
  const handleRandomizeSchedule = async () => {
    if (selectedLawyersForRandom.length === 0) {
      toast({
        title: 'Selecione advogados',
        description: 'Selecione pelo menos um advogado para o sorteio.',
        variant: 'destructive',
      });
      return;
    }

    setIsRandomizing(true);

    try {
      // Get available days (excluding mandatory office day)
      const availableDays = DAYS_OF_WEEK
        .map(d => d.value)
        .filter(d => d !== mandatoryOfficeDay);

      // Shuffle function
      const shuffle = <T,>(array: T[]): T[] => {
        const arr = [...array];
        for (let i = arr.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
      };

      // Assign random days to each selected lawyer
      const assignments: { userId: string; days: number[] }[] = [];
      
      for (const lawyerId of selectedLawyersForRandom) {
        // Shuffle available days and pick 2
        const shuffledDays = shuffle(availableDays);
        const assignedDays = shuffledDays.slice(0, 2);
        assignments.push({ userId: lawyerId, days: assignedDays });
      }

      // Delete existing schedules for selected lawyers in this month
      for (const lawyerId of selectedLawyersForRandom) {
        await supabase
          .from('home_office_schedules')
          .delete()
          .eq('user_id', lawyerId)
          .eq('month', month)
          .eq('year', year);
      }

      // Insert new schedules
      const scheduleInserts = assignments.flatMap(({ userId, days }) =>
        days.map(day => ({
          user_id: userId,
          day_of_week: day,
          month,
          year,
          created_by: user?.id,
        }))
      );

      const { error } = await supabase
        .from('home_office_schedules')
        .insert(scheduleInserts);

      if (error) throw error;

      toast({
        title: 'Sorteio realizado!',
        description: `Escala de home office sorteada para ${selectedLawyersForRandom.length} advogado(s). Dia presencial obrigatório: ${DAYS_OF_WEEK.find(d => d.value === mandatoryOfficeDay)?.label}.`,
      });

      setRandomDialogOpen(false);
      setSelectedLawyersForRandom([]);
      fetchSchedules();
    } catch (error: any) {
      console.error('Error randomizing schedule:', error);
      toast({
        title: 'Erro',
        description: error.message || 'Não foi possível realizar o sorteio.',
        variant: 'destructive',
      });
    } finally {
      setIsRandomizing(false);
    }
  };

  const toggleLawyerSelection = (lawyerId: string) => {
    setSelectedLawyersForRandom(prev =>
      prev.includes(lawyerId)
        ? prev.filter(id => id !== lawyerId)
        : [...prev, lawyerId]
    );
  };

  const selectAllLawyers = () => {
    setSelectedLawyersForRandom(lawyers.map(l => l.id));
  };

  const deselectAllLawyers = () => {
    setSelectedLawyersForRandom([]);
  };

  useEffect(() => {
    fetchLawyers();
    fetchSchedules();
    fetchSwapRequests();
    fetchUserProfile();
  }, [month, year]);

  const fetchUserProfile = async () => {
    if (!user) return;
    
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url, position')
      .eq('id', user.id)
      .maybeSingle();

    if (!error && data) {
      setUserProfile(data);
    }
  };

  const fetchLawyers = async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url, position')
      .eq('position', 'advogado')
      .eq('approval_status', 'approved')
      .order('full_name');

    if (error) {
      console.error('Error fetching lawyers:', error);
      return;
    }

    setLawyers(data || []);
  };

  const fetchSchedules = async () => {
    const { data, error } = await supabase
      .from('home_office_schedules')
      .select('*')
      .eq('month', month)
      .eq('year', year);

    if (error) {
      console.error('Error fetching schedules:', error);
      return;
    }

    // Fetch profiles for each schedule
    const userIds = [...new Set((data || []).map(s => s.user_id))];
    let profiles: Record<string, Profile> = {};
    
    if (userIds.length > 0) {
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url, position')
        .in('id', userIds);
      
      profilesData?.forEach(p => {
        profiles[p.id] = p;
      });
    }

    const schedulesWithProfiles = (data || []).map(s => ({
      ...s,
      profile: profiles[s.user_id]
    }));

    setSchedules(schedulesWithProfiles);
  };

  const fetchSwapRequests = async () => {
    const { data, error } = await supabase
      .from('home_office_swap_requests')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching swap requests:', error);
      return;
    }

    // Fetch profiles
    const userIds = [...new Set((data || []).flatMap(r => [r.requester_id, r.target_id]))];
    let profiles: Record<string, Profile> = {};
    
    if (userIds.length > 0) {
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url, position')
        .in('id', userIds);
      
      profilesData?.forEach(p => {
        profiles[p.id] = p;
      });
    }

    const requestsWithProfiles = (data || []).map(r => ({
      ...r,
      requester_profile: profiles[r.requester_id],
      target_profile: profiles[r.target_id]
    }));

    setSwapRequests(requestsWithProfiles);
  };

  const handleAddSchedule = async () => {
    if (!selectedLawyer || selectedDays.length === 0) {
      toast({
        title: 'Dados incompletos',
        description: 'Selecione um advogado e pelo menos um dia.',
        variant: 'destructive',
      });
      return;
    }

    if (selectedDays.length > 2) {
      toast({
        title: 'Limite excedido',
        description: 'Máximo de 2 dias de home office por semana.',
        variant: 'destructive',
      });
      return;
    }

    setIsAddingSchedule(true);

    try {
      // Delete existing schedules for this user/month
      await supabase
        .from('home_office_schedules')
        .delete()
        .eq('user_id', selectedLawyer)
        .eq('month', month)
        .eq('year', year);

      // Insert new schedules
      const scheduleInserts = selectedDays.map(day => ({
        user_id: selectedLawyer,
        day_of_week: day,
        month,
        year,
        created_by: user?.id,
      }));

      const { error } = await supabase
        .from('home_office_schedules')
        .insert(scheduleInserts);

      if (error) throw error;

      toast({
        title: 'Escala cadastrada',
        description: 'A escala de home office foi atualizada.',
      });

      setSelectedLawyer('');
      setSelectedDays([]);
      fetchSchedules();
    } catch (error: any) {
      console.error('Error adding schedule:', error);
      toast({
        title: 'Erro',
        description: error.message || 'Não foi possível cadastrar a escala.',
        variant: 'destructive',
      });
    } finally {
      setIsAddingSchedule(false);
    }
  };

  const handleDeleteSchedule = async (userId: string) => {
    if (!confirm('Tem certeza que deseja remover a escala deste advogado?')) return;

    try {
      const { error } = await supabase
        .from('home_office_schedules')
        .delete()
        .eq('user_id', userId)
        .eq('month', month)
        .eq('year', year);

      if (error) throw error;

      toast({
        title: 'Escala removida',
        description: 'A escala foi removida com sucesso.',
      });

      fetchSchedules();
    } catch (error: any) {
      console.error('Error deleting schedule:', error);
      toast({
        title: 'Erro',
        description: error.message || 'Não foi possível remover a escala.',
        variant: 'destructive',
      });
    }
  };

  const handleRequestSwap = async () => {
    if (!swapTargetId || !swapMyDate || !swapTargetDate) {
      toast({
        title: 'Dados incompletos',
        description: 'Preencha todos os campos da solicitação.',
        variant: 'destructive',
      });
      return;
    }

    setIsRequestingSwap(true);

    try {
      const { error } = await supabase
        .from('home_office_swap_requests')
        .insert({
          requester_id: user?.id,
          target_id: swapTargetId,
          requester_original_date: swapMyDate,
          target_original_date: swapTargetDate,
        });

      if (error) throw error;

      toast({
        title: 'Solicitação enviada',
        description: 'Sua solicitação de troca foi enviada.',
      });

      setSwapTargetId('');
      setSwapMyDate('');
      setSwapTargetDate('');
      fetchSwapRequests();
    } catch (error: any) {
      console.error('Error requesting swap:', error);
      toast({
        title: 'Erro',
        description: error.message || 'Não foi possível enviar a solicitação.',
        variant: 'destructive',
      });
    } finally {
      setIsRequestingSwap(false);
    }
  };

  const handleRespondSwap = async (requestId: string, accept: boolean) => {
    try {
      const { error } = await supabase
        .from('home_office_swap_requests')
        .update({
          status: accept ? 'accepted' : 'rejected',
          responded_at: new Date().toISOString(),
        })
        .eq('id', requestId);

      if (error) throw error;

      toast({
        title: accept ? 'Troca aceita' : 'Troca recusada',
        description: accept 
          ? 'A troca de dia foi aceita. Lembre-se de informar a administração.'
          : 'A solicitação de troca foi recusada.',
      });

      fetchSwapRequests();
    } catch (error: any) {
      console.error('Error responding to swap:', error);
      toast({
        title: 'Erro',
        description: error.message || 'Não foi possível processar a resposta.',
        variant: 'destructive',
      });
    }
  };

  const handleCancelSwap = async (requestId: string) => {
    try {
      const { error } = await supabase
        .from('home_office_swap_requests')
        .delete()
        .eq('id', requestId);

      if (error) throw error;

      toast({
        title: 'Solicitação cancelada',
        description: 'A solicitação foi cancelada.',
      });

      fetchSwapRequests();
    } catch (error: any) {
      console.error('Error canceling swap:', error);
      toast({
        title: 'Erro',
        description: error.message || 'Não foi possível cancelar.',
        variant: 'destructive',
      });
    }
  };

  const toggleDaySelection = (day: number) => {
    if (selectedDays.includes(day)) {
      setSelectedDays(selectedDays.filter(d => d !== day));
    } else {
      if (selectedDays.length < 2) {
        setSelectedDays([...selectedDays, day]);
      } else {
        toast({
          title: 'Limite atingido',
          description: 'Máximo de 2 dias de home office por semana.',
          variant: 'destructive',
        });
      }
    }
  };

  const getSchedulesByDay = (dayOfWeek: number) => {
    return schedules.filter(s => s.day_of_week === dayOfWeek);
  };

  const getUserSchedule = (userId: string) => {
    return schedules.filter(s => s.user_id === userId);
  };

  const getMySchedule = () => {
    if (!user) return [];
    return schedules.filter(s => s.user_id === user.id);
  };

  const pendingRequestsForMe = swapRequests.filter(
    r => r.target_id === user?.id && r.status === 'pending'
  );

  const myPendingRequests = swapRequests.filter(
    r => r.requester_id === user?.id && r.status === 'pending'
  );

  // Get available dates for swap based on schedule
  const getAvailableDatesForUser = (userId: string) => {
    const userSchedule = schedules.filter(s => s.user_id === userId);
    const dates: string[] = [];
    
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    const days = eachDayOfInterval({ start, end });
    
    days.forEach(day => {
      const dayOfWeek = getDay(day);
      if (userSchedule.some(s => s.day_of_week === dayOfWeek)) {
        dates.push(format(day, 'yyyy-MM-dd'));
      }
    });
    
    return dates;
  };

  const myAvailableDates = user ? getAvailableDatesForUser(user.id) : [];
  const otherLawyers = lawyers.filter(l => l.id !== user?.id);

  // Calculate statistics for the current month
  const getStatistics = () => {
    const lawyerStats = lawyers.map(lawyer => {
      const lawyerSchedule = schedules.filter(s => s.user_id === lawyer.id);
      const daysCount = lawyerSchedule.length;
      
      return {
        lawyer,
        daysCount,
        days: lawyerSchedule.map(s => DAYS_OF_WEEK.find(d => d.value === s.day_of_week)?.label || '')
      };
    });

    const totalScheduledDays = schedules.length;
    const lawyersWithSchedule = [...new Set(schedules.map(s => s.user_id))].length;
    
    return {
      lawyerStats,
      totalScheduledDays,
      lawyersWithSchedule,
      totalLawyers: lawyers.length
    };
  };

  const stats = getStatistics();

  // Export functions
  const exportToExcel = () => {
    const data = lawyers.map(lawyer => {
      const lawyerSchedule = schedules.filter(s => s.user_id === lawyer.id);
      const days = lawyerSchedule.map(s => DAYS_OF_WEEK.find(d => d.value === s.day_of_week)?.label || '').join(', ');
      return {
        'Advogado': lawyer.full_name,
        'Dias de Home Office': days || 'Sem escala',
        'Quantidade': lawyerSchedule.length
      };
    });

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Escala Home Office');
    
    ws['!cols'] = [
      { wch: 30 },
      { wch: 40 },
      { wch: 12 }
    ];

    XLSX.writeFile(wb, `escala-home-office-${format(currentMonth, 'yyyy-MM')}.xlsx`);
    
    toast({
      title: 'Exportado com sucesso',
      description: 'Escala exportada para Excel.',
    });
  };

  const exportToPDF = () => {
    const doc = new jsPDF();
    
    doc.setFontSize(18);
    doc.text(`Escala de Home Office - ${format(currentMonth, 'MMMM yyyy', { locale: ptBR })}`, 14, 20);
    
    doc.setFontSize(10);
    doc.text(`Gerado em: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, 14, 28);

    // Schedule by day
    const scheduleByDay = DAYS_OF_WEEK.map(day => {
      const daySchedules = schedules.filter(s => s.day_of_week === day.value);
      return {
        'Dia': day.label,
        'Advogados': daySchedules.map(s => s.profile?.full_name || 'Desconhecido').join(', ') || 'Ninguém escalado'
      };
    });

    autoTable(doc, {
      startY: 35,
      head: [['Dia da Semana', 'Advogados de Home Office']],
      body: scheduleByDay.map(row => [row['Dia'], row['Advogados']]),
      headStyles: { fillColor: [59, 130, 246] },
    });

    // Individual schedules
    const tableEndY = (doc as any).lastAutoTable.finalY + 15;
    doc.setFontSize(14);
    doc.text('Escala Individual', 14, tableEndY);

    const individualData = lawyers.map(lawyer => {
      const lawyerSchedule = schedules.filter(s => s.user_id === lawyer.id);
      const days = lawyerSchedule.map(s => DAYS_OF_WEEK.find(d => d.value === s.day_of_week)?.label || '').join(', ');
      return [lawyer.full_name, days || 'Sem escala', lawyerSchedule.length.toString()];
    });

    autoTable(doc, {
      startY: tableEndY + 5,
      head: [['Advogado', 'Dias de Home Office', 'Qtd']],
      body: individualData,
      headStyles: { fillColor: [59, 130, 246] },
    });

    doc.save(`escala-home-office-${format(currentMonth, 'yyyy-MM')}.pdf`);
    
    toast({
      title: 'Exportado com sucesso',
      description: 'Escala exportada para PDF.',
    });
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
              <Home className="h-8 w-8 text-primary" />
              Escala de Home Office
            </h1>
            <p className="text-muted-foreground mt-2">
              Gerencie a escala de home office dos advogados
            </p>
          </div>
          
          {pendingRequestsForMe.length > 0 && (
            <Badge variant="destructive" className="flex items-center gap-1">
              <Bell className="h-4 w-4" />
              {pendingRequestsForMe.length} solicitação(ões) pendente(s)
            </Badge>
          )}
        </div>

        {/* Month Navigation */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <Button variant="outline" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
              Mês Anterior
            </Button>
            <span className="text-lg font-semibold capitalize">{monthLabel}</span>
            <Button variant="outline" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
              Próximo Mês
            </Button>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={exportToExcel}>
              <FileSpreadsheet className="h-4 w-4 mr-1" />
              Excel
            </Button>
            <Button variant="outline" size="sm" onClick={exportToPDF}>
              <FileText className="h-4 w-4 mr-1" />
              PDF
            </Button>
          </div>
        </div>

        <Tabs defaultValue="board" className="w-full">
          <TabsList className={`grid w-full ${canManageHomeOffice ? 'grid-cols-4' : isLawyer ? 'grid-cols-2' : 'grid-cols-1'}`}>
            <TabsTrigger value="board">Mural da Semana</TabsTrigger>
            {isLawyer && (
              <TabsTrigger value="swap" className="flex items-center gap-2">
                <ArrowRightLeft className="h-4 w-4" />
                Trocar Dias
                {pendingRequestsForMe.length > 0 && (
                  <Badge variant="destructive" className="ml-1 h-5 w-5 p-0 justify-center">
                    {pendingRequestsForMe.length}
                  </Badge>
                )}
              </TabsTrigger>
            )}
            {canManageHomeOffice && (
              <>
                <TabsTrigger value="manage">Gerenciar Escala</TabsTrigger>
                <TabsTrigger value="stats">
                  <BarChart3 className="h-4 w-4 mr-1" />
                  Estatísticas
                </TabsTrigger>
              </>
            )}
          </TabsList>

          {/* Board Tab */}
          <TabsContent value="board" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Escala de Home Office - {format(currentMonth, 'MMMM yyyy', { locale: ptBR })}
                </CardTitle>
                <CardDescription>
                  Visualize quem está de home office em cada dia da semana
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                  {DAYS_OF_WEEK.map(day => {
                    const daySchedules = getSchedulesByDay(day.value);
                    return (
                      <div key={day.value} className="border rounded-lg p-4">
                        <h3 className="font-semibold text-center mb-3 pb-2 border-b">
                          {day.label}
                        </h3>
                        {daySchedules.length === 0 ? (
                          <p className="text-center text-muted-foreground text-sm py-4">
                            Ninguém escalado
                          </p>
                        ) : (
                          <div className="space-y-2">
                            {daySchedules.map(schedule => (
                              <div
                                key={schedule.id}
                                className="flex items-center gap-2 p-2 rounded-lg bg-primary/10"
                              >
                                <Avatar className="h-8 w-8">
                                  <AvatarImage src={schedule.profile?.avatar_url || ''} />
                                  <AvatarFallback>
                                    {schedule.profile?.full_name?.charAt(0) || '?'}
                                  </AvatarFallback>
                                </Avatar>
                                <span className="text-sm font-medium truncate">
                                  {schedule.profile?.full_name || 'Usuário'}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* My Schedule */}
            {isLawyer && (
              <Card>
                <CardHeader>
                  <CardTitle>Minha Escala</CardTitle>
                  <CardDescription>
                    Seus dias de home office este mês
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {getMySchedule().length === 0 ? (
                    <p className="text-muted-foreground">
                      Você ainda não tem dias de home office cadastrados para este mês.
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {getMySchedule().map(schedule => (
                        <Badge key={schedule.id} variant="default" className="text-sm">
                          {DAYS_OF_WEEK.find(d => d.value === schedule.day_of_week)?.label}
                        </Badge>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Swap Tab - Only for lawyers */}
          {isLawyer && (
          <TabsContent value="swap" className="space-y-6">
            {/* Pending requests for me */}
            {pendingRequestsForMe.length > 0 && (
              <Card className="border-destructive">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-destructive">
                    <Bell className="h-5 w-5" />
                    Solicitações Recebidas
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {pendingRequestsForMe.map(request => (
                    <div key={request.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border">
                      <div className="flex items-center gap-3">
                        <Avatar>
                          <AvatarImage src={request.requester_profile?.avatar_url || ''} />
                          <AvatarFallback>
                            {request.requester_profile?.full_name?.charAt(0) || '?'}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">{request.requester_profile?.full_name}</p>
                          <p className="text-sm text-muted-foreground">
                            Quer trocar <strong>{format(new Date(request.requester_original_date), 'dd/MM/yyyy')}</strong> pelo seu dia <strong>{format(new Date(request.target_original_date), 'dd/MM/yyyy')}</strong>
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => handleRespondSwap(request.id, true)}>
                          <Check className="h-4 w-4 mr-1" />
                          Aceitar
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => handleRespondSwap(request.id, false)}>
                          <X className="h-4 w-4 mr-1" />
                          Recusar
                        </Button>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* My pending requests */}
            {myPendingRequests.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="h-5 w-5" />
                    Minhas Solicitações Pendentes
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {myPendingRequests.map(request => (
                    <div key={request.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border">
                      <div className="flex items-center gap-3">
                        <Avatar>
                          <AvatarImage src={request.target_profile?.avatar_url || ''} />
                          <AvatarFallback>
                            {request.target_profile?.full_name?.charAt(0) || '?'}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">Para: {request.target_profile?.full_name}</p>
                          <p className="text-sm text-muted-foreground">
                            Trocar meu dia <strong>{format(new Date(request.requester_original_date), 'dd/MM/yyyy')}</strong> pelo dia <strong>{format(new Date(request.target_original_date), 'dd/MM/yyyy')}</strong>
                          </p>
                        </div>
                      </div>
                      <Button size="sm" variant="outline" onClick={() => handleCancelSwap(request.id)}>
                        Cancelar
                      </Button>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Request Swap */}
            {isLawyer && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ArrowRightLeft className="h-5 w-5" />
                    Solicitar Troca
                  </CardTitle>
                  <CardDescription>
                    Solicite a troca de um dia de home office com outro advogado
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {getMySchedule().length === 0 ? (
                    <p className="text-muted-foreground">
                      Você precisa ter dias de home office cadastrados para solicitar troca.
                    </p>
                  ) : (
                    <>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <label className="text-sm font-medium mb-2 block">Meu dia (que quero trocar)</label>
                          <Select value={swapMyDate} onValueChange={setSwapMyDate}>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione seu dia" />
                            </SelectTrigger>
                            <SelectContent>
                              {myAvailableDates.map(date => (
                                <SelectItem key={date} value={date}>
                                  {format(new Date(date), 'EEEE, dd/MM', { locale: ptBR })}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div>
                          <label className="text-sm font-medium mb-2 block">Trocar com</label>
                          <Select value={swapTargetId} onValueChange={(value) => {
                            setSwapTargetId(value);
                            setSwapTargetDate('');
                          }}>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione um advogado" />
                            </SelectTrigger>
                            <SelectContent>
                              {otherLawyers.filter(l => getUserSchedule(l.id).length > 0).map(lawyer => (
                                <SelectItem key={lawyer.id} value={lawyer.id}>
                                  {lawyer.full_name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div>
                          <label className="text-sm font-medium mb-2 block">Dia da outra pessoa</label>
                          <Select value={swapTargetDate} onValueChange={setSwapTargetDate} disabled={!swapTargetId}>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione o dia" />
                            </SelectTrigger>
                            <SelectContent>
                              {swapTargetId && getAvailableDatesForUser(swapTargetId).map(date => (
                                <SelectItem key={date} value={date}>
                                  {format(new Date(date), 'EEEE, dd/MM', { locale: ptBR })}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <Button onClick={handleRequestSwap} disabled={isRequestingSwap || !swapMyDate || !swapTargetId || !swapTargetDate}>
                        <ArrowRightLeft className="h-4 w-4 mr-2" />
                        Solicitar Troca
                      </Button>
                    </>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Swap History */}
            <Card>
              <CardHeader>
                <CardTitle>Histórico de Trocas</CardTitle>
              </CardHeader>
              <CardContent>
                {swapRequests.filter(r => r.status !== 'pending').length === 0 ? (
                  <p className="text-muted-foreground">Nenhuma troca realizada ainda.</p>
                ) : (
                  <div className="space-y-2">
                    {swapRequests.filter(r => r.status !== 'pending').slice(0, 10).map(request => (
                      <div key={request.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{request.requester_profile?.full_name}</span>
                          <ArrowRightLeft className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{request.target_profile?.full_name}</span>
                        </div>
                        <Badge variant={request.status === 'accepted' ? 'default' : 'secondary'}>
                          {request.status === 'accepted' ? 'Aceita' : 'Recusada'}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          )}

          {/* Manage Tab (Admin Only) */}
          {canManageHomeOffice && (
            <>
            <TabsContent value="manage" className="space-y-6">
              {/* Randomizer Card */}
              <Card className="border-primary/50 bg-primary/5">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shuffle className="h-5 w-5 text-primary" />
                    Sorteio Automático de Home Office
                  </CardTitle>
                  <CardDescription>
                    Sorteie automaticamente os dias de home office para os advogados selecionados, garantindo um dia presencial obrigatório para todos.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Dialog open={randomDialogOpen} onOpenChange={setRandomDialogOpen}>
                    <DialogTrigger asChild>
                      <Button className="gap-2">
                        <Shuffle className="h-4 w-4" />
                        Sortear Escala
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl">
                      <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                          <Shuffle className="h-5 w-5" />
                          Sortear Home Office - {format(currentMonth, 'MMMM yyyy', { locale: ptBR })}
                        </DialogTitle>
                        <DialogDescription>
                          Selecione os advogados e o dia presencial obrigatório. O sistema sorteará 2 dias de home office para cada advogado, excluindo o dia presencial.
                        </DialogDescription>
                      </DialogHeader>
                      
                      <div className="space-y-6 py-4">
                        {/* Mandatory Office Day Selection */}
                        <div className="space-y-2">
                          <Label className="flex items-center gap-2">
                            <Building className="h-4 w-4" />
                            Dia Presencial Obrigatório
                          </Label>
                          <p className="text-sm text-muted-foreground">
                            Neste dia, todos os advogados deverão estar no escritório.
                          </p>
                          <Select 
                            value={mandatoryOfficeDay.toString()} 
                            onValueChange={(v) => setMandatoryOfficeDay(parseInt(v))}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {DAYS_OF_WEEK.map(day => (
                                <SelectItem key={day.value} value={day.value.toString()}>
                                  {day.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        {/* Lawyer Selection */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <Label className="flex items-center gap-2">
                              <Users className="h-4 w-4" />
                              Advogados para o Sorteio
                            </Label>
                            <div className="flex gap-2">
                              <Button variant="outline" size="sm" onClick={selectAllLawyers}>
                                Selecionar Todos
                              </Button>
                              <Button variant="outline" size="sm" onClick={deselectAllLawyers}>
                                Limpar
                              </Button>
                            </div>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            Selecione os advogados que participarão do sorteio. A escala existente será substituída.
                          </p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[300px] overflow-y-auto p-2 border rounded-lg">
                            {lawyers.map(lawyer => (
                              <div
                                key={lawyer.id}
                                className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors ${
                                  selectedLawyersForRandom.includes(lawyer.id)
                                    ? 'bg-primary/10 border border-primary'
                                    : 'bg-muted/30 border border-transparent hover:bg-muted/50'
                                }`}
                                onClick={() => toggleLawyerSelection(lawyer.id)}
                              >
                                <Checkbox
                                  checked={selectedLawyersForRandom.includes(lawyer.id)}
                                  onCheckedChange={() => toggleLawyerSelection(lawyer.id)}
                                />
                                <Avatar className="h-8 w-8">
                                  <AvatarImage src={lawyer.avatar_url || ''} />
                                  <AvatarFallback>{lawyer.full_name.charAt(0)}</AvatarFallback>
                                </Avatar>
                                <span className="text-sm font-medium truncate">{lawyer.full_name}</span>
                              </div>
                            ))}
                          </div>
                          <p className="text-sm text-muted-foreground text-center">
                            {selectedLawyersForRandom.length} de {lawyers.length} advogado(s) selecionado(s)
                          </p>
                        </div>

                        {/* Preview */}
                        {selectedLawyersForRandom.length > 0 && (
                          <div className="p-4 rounded-lg bg-muted/30 border">
                            <h4 className="font-medium mb-2">Resumo do Sorteio</h4>
                            <ul className="text-sm text-muted-foreground space-y-1">
                              <li>• <strong>{selectedLawyersForRandom.length}</strong> advogado(s) terão suas escalas sorteadas</li>
                              <li>• Cada um receberá <strong>2 dias</strong> de home office aleatórios</li>
                              <li>• <strong>{DAYS_OF_WEEK.find(d => d.value === mandatoryOfficeDay)?.label}</strong> será o dia presencial obrigatório</li>
                              <li>• Dias disponíveis para sorteio: {DAYS_OF_WEEK.filter(d => d.value !== mandatoryOfficeDay).map(d => d.short).join(', ')}</li>
                            </ul>
                          </div>
                        )}
                      </div>

                      <DialogFooter>
                        <Button variant="outline" onClick={() => setRandomDialogOpen(false)}>
                          Cancelar
                        </Button>
                        <Button 
                          onClick={handleRandomizeSchedule} 
                          disabled={isRandomizing || selectedLawyersForRandom.length === 0}
                          className="gap-2"
                        >
                          {isRandomizing ? (
                            <>Sorteando...</>
                          ) : (
                            <>
                              <Shuffle className="h-4 w-4" />
                              Sortear Agora
                            </>
                          )}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Plus className="h-5 w-5" />
                    Cadastrar/Editar Escala
                  </CardTitle>
                  <CardDescription>
                    Defina os dias de home office para cada advogado (máximo 2 dias por semana)
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">Advogado</label>
                    <Select value={selectedLawyer} onValueChange={(value) => {
                      setSelectedLawyer(value);
                      const existingSchedule = schedules.filter(s => s.user_id === value);
                      setSelectedDays(existingSchedule.map(s => s.day_of_week));
                    }}>
                      <SelectTrigger className="w-full md:w-[300px]">
                        <SelectValue placeholder="Selecione um advogado" />
                      </SelectTrigger>
                      <SelectContent>
                        {lawyers.map(lawyer => (
                          <SelectItem key={lawyer.id} value={lawyer.id}>
                            <div className="flex items-center gap-2">
                              <Avatar className="h-6 w-6">
                                <AvatarImage src={lawyer.avatar_url || ''} />
                                <AvatarFallback>{lawyer.full_name.charAt(0)}</AvatarFallback>
                              </Avatar>
                              {lawyer.full_name}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {selectedLawyer && (
                    <>
                      <div>
                        <label className="text-sm font-medium mb-2 block">
                          Dias de Home Office (selecione até 2)
                        </label>
                        <div className="flex flex-wrap gap-2">
                          {DAYS_OF_WEEK.map(day => (
                            <Button
                              key={day.value}
                              variant={selectedDays.includes(day.value) ? 'default' : 'outline'}
                              onClick={() => toggleDaySelection(day.value)}
                            >
                              {day.label}
                            </Button>
                          ))}
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <Button onClick={handleAddSchedule} disabled={isAddingSchedule}>
                          {isAddingSchedule ? 'Salvando...' : 'Salvar Escala'}
                        </Button>
                        <Button variant="outline" onClick={() => {
                          setSelectedLawyer('');
                          setSelectedDays([]);
                        }}>
                          Cancelar
                        </Button>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>

              {/* Current Schedules */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Escalas Cadastradas - {format(currentMonth, 'MMMM yyyy', { locale: ptBR })}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {lawyers.length === 0 ? (
                    <p className="text-muted-foreground">Nenhum advogado cadastrado.</p>
                  ) : (
                    <div className="space-y-2">
                      {lawyers.map(lawyer => {
                        const lawyerSchedule = getUserSchedule(lawyer.id);
                        return (
                          <div key={lawyer.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border">
                            <div className="flex items-center gap-3">
                              <Avatar>
                                <AvatarImage src={lawyer.avatar_url || ''} />
                                <AvatarFallback>{lawyer.full_name.charAt(0)}</AvatarFallback>
                              </Avatar>
                              <div>
                                <p className="font-medium">{lawyer.full_name}</p>
                                {lawyerSchedule.length === 0 ? (
                                  <p className="text-sm text-muted-foreground">Sem escala definida</p>
                                ) : (
                                  <div className="flex gap-1 mt-1">
                                    {lawyerSchedule.map(s => (
                                      <Badge key={s.id} variant="secondary" className="text-xs">
                                        {DAYS_OF_WEEK.find(d => d.value === s.day_of_week)?.short}
                                      </Badge>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                            {lawyerSchedule.length > 0 && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-destructive"
                                onClick={() => handleDeleteSchedule(lawyer.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Statistics Tab */}
            <TabsContent value="stats" className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Total de Advogados
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{stats.totalLawyers}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Advogados com Escala
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{stats.lawyersWithSchedule}</div>
                    <p className="text-xs text-muted-foreground">
                      {stats.totalLawyers > 0 
                        ? `${Math.round((stats.lawyersWithSchedule / stats.totalLawyers) * 100)}% do total`
                        : '0% do total'}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Dias de HO Cadastrados
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{stats.totalScheduledDays}</div>
                    <p className="text-xs text-muted-foreground">
                      Média de {stats.lawyersWithSchedule > 0 
                        ? (stats.totalScheduledDays / stats.lawyersWithSchedule).toFixed(1) 
                        : '0'} dias por advogado
                    </p>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5" />
                    Utilização por Advogado - {format(currentMonth, 'MMMM yyyy', { locale: ptBR })}
                  </CardTitle>
                  <CardDescription>
                    Detalhamento dos dias de home office de cada advogado
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {stats.lawyerStats.length === 0 ? (
                    <p className="text-muted-foreground">Nenhum advogado cadastrado.</p>
                  ) : (
                    <div className="space-y-3">
                      {stats.lawyerStats.map(({ lawyer, daysCount, days }) => (
                        <div key={lawyer.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border">
                          <div className="flex items-center gap-3">
                            <Avatar>
                              <AvatarImage src={lawyer.avatar_url || ''} />
                              <AvatarFallback>{lawyer.full_name.charAt(0)}</AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-medium">{lawyer.full_name}</p>
                              {daysCount === 0 ? (
                                <p className="text-sm text-muted-foreground">Sem home office cadastrado</p>
                              ) : (
                                <p className="text-sm text-muted-foreground">{days.join(', ')}</p>
                              )}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-lg font-semibold">{daysCount} {daysCount === 1 ? 'dia' : 'dias'}</div>
                            <div className="text-xs text-muted-foreground">por semana</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Swap Statistics */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ArrowRightLeft className="h-5 w-5" />
                    Estatísticas de Trocas
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="text-center p-4 rounded-lg bg-muted/30">
                      <div className="text-2xl font-bold text-primary">
                        {swapRequests.filter(r => r.status === 'pending').length}
                      </div>
                      <p className="text-sm text-muted-foreground">Pendentes</p>
                    </div>
                    <div className="text-center p-4 rounded-lg bg-muted/30">
                      <div className="text-2xl font-bold text-green-600">
                        {swapRequests.filter(r => r.status === 'accepted').length}
                      </div>
                      <p className="text-sm text-muted-foreground">Aceitas</p>
                    </div>
                    <div className="text-center p-4 rounded-lg bg-muted/30">
                      <div className="text-2xl font-bold text-red-600">
                        {swapRequests.filter(r => r.status === 'rejected').length}
                      </div>
                      <p className="text-sm text-muted-foreground">Recusadas</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
            </>
          )}
        </Tabs>
      </div>
    </Layout>
  );
};

export default HomeOffice;
