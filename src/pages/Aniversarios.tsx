import { useState, useEffect } from 'react';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Cake, User } from 'lucide-react';
import { format, getMonth, getDate, parse } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';

interface Profile {
  id: string;
  full_name: string;
  avatar_url: string | null;
  birth_date: string | null;
  position: string | null;
}

interface BirthdaysByMonth {
  [key: number]: Profile[];
}

export default function Aniversarios() {
  const [birthdays, setBirthdays] = useState<BirthdaysByMonth>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchBirthdays();
  }, []);

  const fetchBirthdays = async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url, birth_date, position')
      .eq('approval_status', 'approved')
      .not('birth_date', 'is', null)
      .order('birth_date', { ascending: true });

    if (!error && data) {
      const grouped = data.reduce((acc: BirthdaysByMonth, profile) => {
        if (profile.birth_date) {
          const month = getMonth(parse(profile.birth_date, 'yyyy-MM-dd', new Date()));
          if (!acc[month]) {
            acc[month] = [];
          }
          acc[month].push(profile);
        }
        return acc;
      }, {});

      // Ordenar aniversariantes dentro de cada mês por dia
      Object.keys(grouped).forEach((monthKey) => {
        const month = parseInt(monthKey);
        grouped[month].sort((a, b) => {
          const dayA = getDate(parse(a.birth_date!, 'yyyy-MM-dd', new Date()));
          const dayB = getDate(parse(b.birth_date!, 'yyyy-MM-dd', new Date()));
          return dayA - dayB;
        });
      });

      setBirthdays(grouped);
    }
    setLoading(false);
  };

  const monthNames = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];

  const getPositionLabel = (position: string | null) => {
    if (!position) return '';
    const positions: { [key: string]: string } = {
      socio: 'Sócio',
      advogado: 'Advogado',
      estagiario: 'Estagiário',
      comercial: 'Comercial',
      administrativo: 'Administrativo',
    };
    return positions[position] || position;
  };

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
      <div className="space-y-8">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-gradient-to-br from-pink-500/20 to-rose-500/20">
            <Cake className="h-8 w-8 text-pink-600" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">Aniversários</h1>
            <p className="text-muted-foreground">Celebre com a equipe ao longo do ano</p>
          </div>
        </div>

        <div className="space-y-6">
          {Object.keys(birthdays).length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                Nenhum aniversário cadastrado ainda.
              </CardContent>
            </Card>
          ) : (
            monthNames.map((monthName, index) => {
              const monthBirthdays = birthdays[index];
              if (!monthBirthdays || monthBirthdays.length === 0) return null;

              return (
                <Card key={index} className="border-l-4 border-l-primary">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Cake className="h-5 w-5 text-primary" />
                      {monthName}
                      <Badge variant="secondary" className="ml-2">
                        {monthBirthdays.length} {monthBirthdays.length === 1 ? 'aniversariante' : 'aniversariantes'}
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {monthBirthdays.map((profile) => (
                        <div
                          key={profile.id}
                          className="flex items-center gap-4 p-4 rounded-lg border bg-card hover:shadow-md transition-all duration-300 hover:-translate-y-1"
                        >
                          <Avatar className="h-14 w-14 border-2 border-primary/30">
                            <AvatarImage src={profile.avatar_url || undefined} />
                            <AvatarFallback className="bg-gradient-to-br from-primary/20 to-accent/20">
                              <User className="h-6 w-6 text-primary" />
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold truncate">{profile.full_name}</p>
                            <p className="text-sm text-muted-foreground">
                              {profile.birth_date && format(parse(profile.birth_date, 'yyyy-MM-dd', new Date()), "dd 'de' MMMM", { locale: ptBR })}
                            </p>
                            {profile.position && (
                              <Badge variant="outline" className="mt-1 text-xs">
                                {getPositionLabel(profile.position)}
                              </Badge>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      </div>
    </Layout>
  );
}