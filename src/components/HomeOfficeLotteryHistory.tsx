import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { History, Calendar, Users } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { format, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Profile {
  id: string;
  full_name: string;
  avatar_url: string | null;
}

interface ScheduleWithProfile {
  id: string;
  user_id: string;
  day_of_week: number;
  month: number;
  year: number;
  created_at: string;
  profile?: Profile;
}

const DAYS_OF_WEEK = [
  { value: 1, label: 'Segunda-feira', short: 'Seg' },
  { value: 2, label: 'Terça-feira', short: 'Ter' },
  { value: 3, label: 'Quarta-feira', short: 'Qua' },
  { value: 4, label: 'Quinta-feira', short: 'Qui' },
  { value: 5, label: 'Sexta-feira', short: 'Sex' },
];

export const HomeOfficeLotteryHistory = () => {
  const [history, setHistory] = useState<ScheduleWithProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());

  const currentYear = new Date().getFullYear();
  const years = [currentYear, currentYear - 1, currentYear - 2];

  useEffect(() => {
    fetchHistory();
  }, [selectedYear]);

  const fetchHistory = async () => {
    setLoading(true);
    
    const { data, error } = await supabase
      .from('home_office_schedules')
      .select('*')
      .eq('year', selectedYear)
      .order('month', { ascending: false })
      .order('day_of_week', { ascending: true });

    if (error) {
      console.error('Error fetching history:', error);
      setLoading(false);
      return;
    }

    // Fetch profiles for each schedule
    const userIds = [...new Set((data || []).map(s => s.user_id))];
    let profiles: Record<string, Profile> = {};
    
    if (userIds.length > 0) {
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url')
        .in('id', userIds);
      
      profilesData?.forEach(p => {
        profiles[p.id] = p;
      });
    }

    const schedulesWithProfiles = (data || []).map(s => ({
      ...s,
      profile: profiles[s.user_id]
    }));

    setHistory(schedulesWithProfiles);
    setLoading(false);
  };

  // Group by month
  const groupedByMonth = history.reduce((acc, schedule) => {
    const key = `${schedule.year}-${schedule.month}`;
    if (!acc[key]) {
      acc[key] = {
        month: schedule.month,
        year: schedule.year,
        schedules: []
      };
    }
    acc[key].schedules.push(schedule);
    return acc;
  }, {} as Record<string, { month: number; year: number; schedules: ScheduleWithProfile[] }>);

  const monthGroups = Object.values(groupedByMonth).sort((a, b) => b.month - a.month);

  const getMonthLabel = (month: number, year: number) => {
    const date = new Date(year, month - 1, 1);
    return format(date, 'MMMM yyyy', { locale: ptBR });
  };

  // Group schedules by lawyer within each month
  const groupByLawyer = (schedules: ScheduleWithProfile[]) => {
    const grouped: Record<string, { profile: Profile; days: number[] }> = {};
    
    schedules.forEach(s => {
      if (!s.profile) return;
      if (!grouped[s.user_id]) {
        grouped[s.user_id] = {
          profile: s.profile,
          days: []
        };
      }
      grouped[s.user_id].days.push(s.day_of_week);
    });

    return Object.values(grouped).sort((a, b) => 
      a.profile.full_name.localeCompare(b.profile.full_name)
    );
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8">
          <p className="text-center text-muted-foreground">Carregando histórico...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5" />
                Histórico de Sorteios
              </CardTitle>
              <CardDescription>
                Visualize os sorteios de home office realizados em cada mês
              </CardDescription>
            </div>
            <Select
              value={selectedYear.toString()}
              onValueChange={(value) => setSelectedYear(parseInt(value))}
            >
              <SelectTrigger className="w-[120px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {years.map(year => (
                  <SelectItem key={year} value={year.toString()}>
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {monthGroups.length === 0 ? (
            <div className="text-center py-12">
              <History className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">
                Nenhum sorteio registrado para {selectedYear}
              </p>
            </div>
          ) : (
            <ScrollArea className="h-[500px]">
              <div className="space-y-6">
                {monthGroups.map(group => {
                  const lawyerGroups = groupByLawyer(group.schedules);
                  
                  return (
                    <Card key={`${group.year}-${group.month}`} className="border-2">
                      <CardHeader className="pb-3">
                        <CardTitle className="flex items-center gap-2 text-lg capitalize">
                          <Calendar className="h-4 w-4" />
                          {getMonthLabel(group.month, group.year)}
                        </CardTitle>
                        <CardDescription className="flex items-center gap-2">
                          <Users className="h-4 w-4" />
                          {lawyerGroups.length} advogado(s) escalado(s)
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {lawyerGroups.map(lawyer => (
                            <div
                              key={lawyer.profile.id}
                              className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border"
                            >
                              <Avatar className="h-10 w-10">
                                <AvatarImage src={lawyer.profile.avatar_url || ''} />
                                <AvatarFallback>
                                  {lawyer.profile.full_name.charAt(0)}
                                </AvatarFallback>
                              </Avatar>
                              <div className="flex-1 min-w-0">
                                <p className="font-medium truncate">
                                  {lawyer.profile.full_name}
                                </p>
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {lawyer.days.sort().map(day => (
                                    <Badge
                                      key={day}
                                      variant="secondary"
                                      className="text-xs"
                                    >
                                      {DAYS_OF_WEEK.find(d => d.value === day)?.short}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
