import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Plus, CalendarIcon, Pencil, Trash2, Clock, ArrowUpCircle, ArrowDownCircle, RefreshCcw, HelpCircle, User, Wallet } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';

interface Profile {
  id: string;
  full_name: string;
  avatar_url: string | null;
  position: string | null;
}

interface InformalVacation {
  id: string;
  colaborador_id: string;
  tipo: string;
  dias: number;
  data_inicio: string | null;
  data_fim: string | null;
  descricao: string | null;
  observacoes: string | null;
  created_by: string;
  created_at: string;
}

interface InformalVacationWithProfile extends InformalVacation {
  profiles?: Profile;
  creator?: { full_name: string };
}

const TIPOS_FERIAS = [
  { value: 'adiantamento', label: 'Adiantamento de Férias', icon: ArrowUpCircle, color: 'text-blue-500' },
  { value: 'informal', label: 'Férias Informais', icon: Clock, color: 'text-orange-500' },
  { value: 'compensacao', label: 'Compensação', icon: RefreshCcw, color: 'text-green-500' },
  { value: 'outro', label: 'Outro', icon: HelpCircle, color: 'text-gray-500' },
];

export function InformalVacationManager() {
  const { user } = useAuth();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [records, setRecords] = useState<InformalVacationWithProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<InformalVacationWithProfile | null>(null);
  const [selectedColaborador, setSelectedColaborador] = useState<string>('');
  const [filterColaborador, setFilterColaborador] = useState<string>('all');

  // Form states
  const [formColaborador, setFormColaborador] = useState<string>('');
  const [formTipo, setFormTipo] = useState<string>('');
  const [formDias, setFormDias] = useState<string>('');
  const [formDataInicio, setFormDataInicio] = useState<Date | undefined>();
  const [formDataFim, setFormDataFim] = useState<Date | undefined>();
  const [formDescricao, setFormDescricao] = useState<string>('');
  const [formObservacoes, setFormObservacoes] = useState<string>('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [profilesRes, recordsRes] = await Promise.all([
        supabase
          .from('profiles')
          .select('id, full_name, avatar_url, position')
          .eq('approval_status', 'approved')
          .order('full_name'),
        supabase
          .from('informal_vacation_records')
          .select('*')
          .order('created_at', { ascending: false })
      ]);

      if (profilesRes.error) throw profilesRes.error;
      if (recordsRes.error) throw recordsRes.error;

      setProfiles(profilesRes.data || []);

      // Enrich records with profile data
      const enrichedRecords = (recordsRes.data || []).map(record => {
        const profile = profilesRes.data?.find(p => p.id === record.colaborador_id);
        const creator = profilesRes.data?.find(p => p.id === record.created_by);
        return {
          ...record,
          profiles: profile,
          creator: creator ? { full_name: creator.full_name } : undefined
        };
      });

      setRecords(enrichedRecords);
    } catch (error: any) {
      toast.error('Erro ao carregar dados: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormColaborador('');
    setFormTipo('');
    setFormDias('');
    setFormDataInicio(undefined);
    setFormDataFim(undefined);
    setFormDescricao('');
    setFormObservacoes('');
    setEditingRecord(null);
  };

  const openEditDialog = (record: InformalVacationWithProfile) => {
    setEditingRecord(record);
    setFormColaborador(record.colaborador_id);
    setFormTipo(record.tipo);
    setFormDias(record.dias.toString());
    setFormDataInicio(record.data_inicio ? parseISO(record.data_inicio) : undefined);
    setFormDataFim(record.data_fim ? parseISO(record.data_fim) : undefined);
    setFormDescricao(record.descricao || '');
    setFormObservacoes(record.observacoes || '');
    setIsDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!formColaborador || !formTipo || !formDias) {
      toast.error('Preencha os campos obrigatórios');
      return;
    }

    const dias = parseInt(formDias);
    if (isNaN(dias) || dias <= 0) {
      toast.error('Quantidade de dias deve ser um número positivo');
      return;
    }

    try {
      const data = {
        colaborador_id: formColaborador,
        tipo: formTipo,
        dias,
        data_inicio: formDataInicio ? format(formDataInicio, 'yyyy-MM-dd') : null,
        data_fim: formDataFim ? format(formDataFim, 'yyyy-MM-dd') : null,
        descricao: formDescricao || null,
        observacoes: formObservacoes || null,
        created_by: user!.id,
      };

      if (editingRecord) {
        const { error } = await supabase
          .from('informal_vacation_records')
          .update({
            ...data,
            updated_at: new Date().toISOString()
          })
          .eq('id', editingRecord.id);

        if (error) throw error;
        toast.success('Registro atualizado com sucesso');
      } else {
        const { error } = await supabase
          .from('informal_vacation_records')
          .insert(data);

        if (error) throw error;
        toast.success('Registro criado com sucesso');
      }

      setIsDialogOpen(false);
      resetForm();
      fetchData();
    } catch (error: any) {
      toast.error('Erro ao salvar: ' + error.message);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from('informal_vacation_records')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('Registro excluído');
      fetchData();
    } catch (error: any) {
      toast.error('Erro ao excluir: ' + error.message);
    }
  };

  const getTipoConfig = (tipo: string) => {
    return TIPOS_FERIAS.find(t => t.value === tipo) || TIPOS_FERIAS[3];
  };

  // Calculate balance per collaborator
  const calculateBalance = (colaboradorId: string) => {
    const colaboradorRecords = records.filter(r => r.colaborador_id === colaboradorId);
    const total = colaboradorRecords.reduce((sum, r) => {
      // Adiantamentos são negativos (dias usados antecipadamente)
      // Compensações são positivas (dias a restituir)
      if (r.tipo === 'adiantamento' || r.tipo === 'informal') {
        return sum - r.dias;
      } else if (r.tipo === 'compensacao') {
        return sum + r.dias;
      }
      return sum;
    }, 0);
    return total;
  };

  const filteredRecords = filterColaborador === 'all' 
    ? records 
    : records.filter(r => r.colaborador_id === filterColaborador);

  // Group by collaborator for summary view
  const collaboratorSummaries = profiles
    .filter(p => records.some(r => r.colaborador_id === p.id))
    .map(p => ({
      ...p,
      balance: calculateBalance(p.id),
      recordCount: records.filter(r => r.colaborador_id === p.id).length
    }))
    .sort((a, b) => a.full_name.localeCompare(b.full_name));

  if (loading) {
    return <div className="text-center py-8">Carregando...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total de Registros</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{records.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Colaboradores com Registros</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{collaboratorSummaries.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Com Saldo Negativo</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-500">
              {collaboratorSummaries.filter(c => c.balance < 0).length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Wallet className="h-5 w-5" />
              Controle de Férias Informais / Adiantadas
            </CardTitle>
            <CardDescription>
              Gerencie adiantamentos, compensações e férias informais dos colaboradores
            </CardDescription>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Novo Registro
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>{editingRecord ? 'Editar Registro' : 'Novo Registro de Férias Informal'}</DialogTitle>
                <DialogDescription>
                  Registre adiantamentos, férias informais ou compensações
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Colaborador *</Label>
                  <Select value={formColaborador} onValueChange={setFormColaborador}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o colaborador" />
                    </SelectTrigger>
                    <SelectContent>
                      {profiles.map((profile) => (
                        <SelectItem key={profile.id} value={profile.id}>
                          {profile.full_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Tipo *</Label>
                  <Select value={formTipo} onValueChange={setFormTipo}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      {TIPOS_FERIAS.map((tipo) => {
                        const Icon = tipo.icon;
                        return (
                          <SelectItem key={tipo.value} value={tipo.value}>
                            <div className="flex items-center gap-2">
                              <Icon className={cn("h-4 w-4", tipo.color)} />
                              {tipo.label}
                            </div>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Quantidade de Dias *</Label>
                  <Input
                    type="number"
                    min="1"
                    value={formDias}
                    onChange={(e) => setFormDias(e.target.value)}
                    placeholder="Ex: 5"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Data Início (opcional)</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !formDataInicio && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {formDataInicio ? format(formDataInicio, 'dd/MM/yyyy') : 'Selecione'}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={formDataInicio}
                          onSelect={setFormDataInicio}
                          initialFocus
                          className="pointer-events-auto"
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div>
                    <Label>Data Fim (opcional)</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !formDataFim && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {formDataFim ? format(formDataFim, 'dd/MM/yyyy') : 'Selecione'}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={formDataFim}
                          onSelect={setFormDataFim}
                          initialFocus
                          className="pointer-events-auto"
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>

                <div>
                  <Label>Descrição</Label>
                  <Input
                    value={formDescricao}
                    onChange={(e) => setFormDescricao(e.target.value)}
                    placeholder="Ex: Férias antecipadas para viagem"
                  />
                </div>

                <div>
                  <Label>Observações</Label>
                  <Textarea
                    value={formObservacoes}
                    onChange={(e) => setFormObservacoes(e.target.value)}
                    placeholder="Observações adicionais..."
                    rows={3}
                  />
                </div>

                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setIsDialogOpen(false)} className="flex-1">
                    Cancelar
                  </Button>
                  <Button onClick={handleSubmit} className="flex-1">
                    {editingRecord ? 'Salvar Alterações' : 'Criar Registro'}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Collaborator Summary */}
          {collaboratorSummaries.length > 0 && (
            <div className="space-y-3">
              <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Resumo por Colaborador</h4>
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {collaboratorSummaries.map((collab) => (
                  <Card key={collab.id} className={cn(
                    "cursor-pointer hover:border-primary transition-colors",
                    filterColaborador === collab.id && "border-primary"
                  )} onClick={() => setFilterColaborador(filterColaborador === collab.id ? 'all' : collab.id)}>
                    <CardContent className="pt-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-10 w-10">
                            <AvatarImage src={collab.avatar_url || ''} />
                            <AvatarFallback>
                              {collab.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium">{collab.full_name}</p>
                            <p className="text-xs text-muted-foreground">{collab.recordCount} registros</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <Badge variant={collab.balance < 0 ? 'destructive' : collab.balance > 0 ? 'default' : 'secondary'}>
                            {collab.balance > 0 ? '+' : ''}{collab.balance} dias
                          </Badge>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
              {filterColaborador !== 'all' && (
                <Button variant="ghost" size="sm" onClick={() => setFilterColaborador('all')}>
                  Limpar filtro
                </Button>
              )}
            </div>
          )}

          {/* Records Table */}
          <div>
            <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide mb-3">Registros</h4>
            {filteredRecords.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                Nenhum registro encontrado
              </p>
            ) : (
              <ScrollArea className="h-[400px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Colaborador</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Dias</TableHead>
                      <TableHead>Período</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead>Cadastrado por</TableHead>
                      <TableHead className="w-[100px]">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRecords.map((record) => {
                      const tipoConfig = getTipoConfig(record.tipo);
                      const TipoIcon = tipoConfig.icon;
                      return (
                        <TableRow key={record.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Avatar className="h-8 w-8">
                                <AvatarImage src={record.profiles?.avatar_url || ''} />
                                <AvatarFallback>
                                  {record.profiles?.full_name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || '??'}
                                </AvatarFallback>
                              </Avatar>
                              <span className="font-medium">{record.profiles?.full_name || 'Desconhecido'}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="gap-1">
                              <TipoIcon className={cn("h-3 w-3", tipoConfig.color)} />
                              {tipoConfig.label}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant={record.tipo === 'compensacao' ? 'default' : 'secondary'}>
                              {record.tipo === 'compensacao' ? '+' : '-'}{record.dias} dias
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {record.data_inicio && record.data_fim ? (
                              <span className="text-sm">
                                {format(parseISO(record.data_inicio), 'dd/MM/yyyy')} - {format(parseISO(record.data_fim), 'dd/MM/yyyy')}
                              </span>
                            ) : record.data_inicio ? (
                              <span className="text-sm">{format(parseISO(record.data_inicio), 'dd/MM/yyyy')}</span>
                            ) : (
                              <span className="text-muted-foreground text-sm">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <span className="text-sm">{record.descricao || '-'}</span>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm text-muted-foreground">
                              {record.creator?.full_name || '-'}
                              <br />
                              <span className="text-xs">{format(parseISO(record.created_at), 'dd/MM/yyyy', { locale: ptBR })}</span>
                            </span>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => openEditDialog(record)}
                                title="Editar"
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="text-destructive hover:text-destructive"
                                    title="Excluir"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Excluir registro?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Esta ação não pode ser desfeita. O registro será permanentemente excluído.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => handleDelete(record.id)}>
                                      Excluir
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </ScrollArea>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
