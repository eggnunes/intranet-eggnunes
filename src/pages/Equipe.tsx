import { useState, useEffect } from 'react';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { Users, User, Briefcase, GraduationCap, Building2, UserCog, Mail, IdCard, Cake, CalendarCheck } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { format, parse, differenceInMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface TeamMember {
  id: string;
  full_name: string;
  email: string;
  avatar_url: string | null;
  position: string | null;
  oab_number: string | null;
  oab_state: string | null;
  birth_date: string | null;
  join_date: string | null;
}

interface GroupedTeam {
  socio: TeamMember[];
  advogado: TeamMember[];
  estagiario: TeamMember[];
  comercial: TeamMember[];
  administrativo: TeamMember[];
}

export default function Equipe() {
  const [team, setTeam] = useState<GroupedTeam>({
    socio: [],
    advogado: [],
    estagiario: [],
    comercial: [],
    administrativo: [],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTeam();

    // Configurar real-time updates para mudanças nos perfis
    const channel = supabase
      .channel('team-profile-changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
        },
        () => {
          // Quando qualquer perfil for atualizado, recarregar a equipe
          fetchTeam();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'profiles',
        },
        () => {
          fetchTeam();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchTeam = async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, email, avatar_url, position, oab_number, oab_state, birth_date, join_date')
      .eq('approval_status', 'approved')
      .order('full_name');

    if (!error && data) {
      const grouped: GroupedTeam = {
        socio: [],
        advogado: [],
        estagiario: [],
        comercial: [],
        administrativo: [],
      };

      data.forEach((member: TeamMember) => {
        if (member.position && member.position in grouped) {
          grouped[member.position as keyof GroupedTeam].push(member);
        }
      });

      setTeam(grouped);
    }
    setLoading(false);
  };

  const calculateTenure = (joinDate: string | null) => {
    if (!joinDate) return null;
    const join = parse(joinDate, 'yyyy-MM-dd', new Date());
    const totalMonths = differenceInMonths(new Date(), join);
    const years = Math.floor(totalMonths / 12);
    const months = totalMonths % 12;
    
    if (years === 0 && months === 0) return 'Menos de 1 mês';
    if (years === 0) return `${months} ${months === 1 ? 'mês' : 'meses'}`;
    if (months === 0) return `${years} ${years === 1 ? 'ano' : 'anos'}`;
    return `${years} ${years === 1 ? 'ano' : 'anos'} e ${months} ${months === 1 ? 'mês' : 'meses'}`;
  };

  const getPositionInfo = (position: keyof GroupedTeam) => {
    const info = {
      socio: {
        title: 'Sócios',
        icon: Briefcase,
        color: 'from-purple-500 to-violet-600',
        bgColor: 'bg-purple-50 dark:bg-purple-950/20',
        borderColor: 'border-purple-200 dark:border-purple-800',
      },
      advogado: {
        title: 'Advogados',
        icon: User,
        color: 'from-blue-500 to-cyan-600',
        bgColor: 'bg-blue-50 dark:bg-blue-950/20',
        borderColor: 'border-blue-200 dark:border-blue-800',
      },
      estagiario: {
        title: 'Estagiários',
        icon: GraduationCap,
        color: 'from-emerald-500 to-teal-600',
        bgColor: 'bg-emerald-50 dark:bg-emerald-950/20',
        borderColor: 'border-emerald-200 dark:border-emerald-800',
      },
      comercial: {
        title: 'Comercial',
        icon: Building2,
        color: 'from-orange-500 to-red-600',
        bgColor: 'bg-orange-50 dark:bg-orange-950/20',
        borderColor: 'border-orange-200 dark:border-orange-800',
      },
      administrativo: {
        title: 'Administrativo',
        icon: UserCog,
        color: 'from-pink-500 to-rose-600',
        bgColor: 'bg-pink-50 dark:bg-pink-950/20',
        borderColor: 'border-pink-200 dark:border-pink-800',
      },
    };
    return info[position];
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-muted-foreground">Carregando equipe...</div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-lg bg-gradient-to-br from-primary/20 to-accent/20">
            <Users className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">Nossa Equipe</h1>
            <p className="text-muted-foreground">Conheça os membros da Egg Nunes Advogados</p>
          </div>
        </div>

        {/* Team Sections */}
        {(Object.keys(team) as Array<keyof GroupedTeam>).map((position) => {
          const members = team[position];
          if (members.length === 0) return null;

          const positionInfo = getPositionInfo(position);
          const Icon = positionInfo.icon;

          return (
            <section key={position} className="space-y-4">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg bg-gradient-to-br ${positionInfo.color}`}>
                  <Icon className="h-5 w-5 text-white" />
                </div>
                <h2 className="text-2xl font-bold">{positionInfo.title}</h2>
                <Badge variant="secondary" className="ml-2">
                  {members.length} {members.length === 1 ? 'membro' : 'membros'}
                </Badge>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {members.map((member) => (
                  <Card
                    key={member.id}
                    className={`${positionInfo.bgColor} ${positionInfo.borderColor} border-2 hover:shadow-lg transition-all duration-300 hover:-translate-y-1`}
                  >
                    <CardHeader>
                      <div className="flex items-start gap-4">
                        <Avatar className="h-16 w-16 border-2 border-primary/30">
                          <AvatarImage src={member.avatar_url || undefined} />
                          <AvatarFallback className="bg-gradient-to-br from-primary/20 to-accent/20 text-primary text-lg">
                            {member.full_name
                              .split(' ')
                              .map((n) => n[0])
                              .join('')
                              .toUpperCase()
                              .slice(0, 2)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <CardTitle className="text-lg mb-2 truncate">
                            {member.full_name}
                          </CardTitle>
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Mail className="h-3 w-3 flex-shrink-0" />
                              <span className="truncate">{member.email}</span>
                            </div>
                            {member.birth_date && (
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Cake className="h-3 w-3 flex-shrink-0" />
                                <span>
                                  {format(parse(member.birth_date, 'yyyy-MM-dd', new Date()), "dd 'de' MMMM", { locale: ptBR })}
                                </span>
                              </div>
                            )}
                            {member.join_date && (
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <CalendarCheck className="h-3 w-3 flex-shrink-0" />
                                <span>
                                  Desde {format(parse(member.join_date, 'yyyy-MM-dd', new Date()), "MMMM 'de' yyyy", { locale: ptBR })}
                                  {' '}({calculateTenure(member.join_date)})
                                </span>
                              </div>
                            )}
                            {(member.oab_number || member.oab_state) && (
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <IdCard className="h-3 w-3 flex-shrink-0" />
                                <span>
                                  OAB {member.oab_state && `${member.oab_state}/`}
                                  {member.oab_number}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardHeader>
                  </Card>
                ))}
              </div>
              <Separator className="my-6" />
            </section>
          );
        })}

        {Object.values(team).every((members) => members.length === 0) && (
          <Card>
            <CardContent className="py-12 text-center">
              <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">Nenhum membro cadastrado ainda.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
}
