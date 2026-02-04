import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Wallet, ArrowUpCircle, Clock, RefreshCcw, HelpCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface InformalVacationSummaryProps {
  colaboradorId: string;
}

interface InformalVacation {
  id: string;
  tipo: string;
  dias: number;
  data_inicio: string | null;
  data_fim: string | null;
  descricao: string | null;
  observacoes: string | null;
  created_at: string;
}

const TIPOS_FERIAS = [
  { value: 'adiantamento', label: 'Adiantamento', icon: ArrowUpCircle, color: 'text-blue-500' },
  { value: 'informal', label: 'Informal', icon: Clock, color: 'text-orange-500' },
  { value: 'compensacao', label: 'Compensação', icon: RefreshCcw, color: 'text-green-500' },
  { value: 'outro', label: 'Outro', icon: HelpCircle, color: 'text-gray-500' },
];

export function InformalVacationSummary({ colaboradorId }: InformalVacationSummaryProps) {
  const [records, setRecords] = useState<InformalVacation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRecords();
  }, [colaboradorId]);

  const fetchRecords = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('informal_vacation_records')
        .select('id, tipo, dias, data_inicio, data_fim, descricao, observacoes, created_at')
        .eq('colaborador_id', colaboradorId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setRecords(data || []);
    } catch (error: any) {
      toast.error('Erro ao carregar registros: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const getTipoConfig = (tipo: string) => {
    return TIPOS_FERIAS.find(t => t.value === tipo) || TIPOS_FERIAS[3];
  };

  const calculateBalance = () => {
    return records.reduce((sum, r) => {
      if (r.tipo === 'adiantamento' || r.tipo === 'informal') {
        return sum - r.dias;
      } else if (r.tipo === 'compensacao') {
        return sum + r.dias;
      }
      return sum;
    }, 0);
  };

  const balance = calculateBalance();

  if (loading) {
    return <div className="text-center py-4 text-muted-foreground">Carregando...</div>;
  }

  if (records.length === 0) {
    return (
      <div className="text-center py-4 text-muted-foreground">
        Nenhum registro de férias informal encontrado.
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Wallet className="h-4 w-4" />
              Férias Informais / Adiantadas
            </CardTitle>
            <CardDescription>
              Registros de adiantamentos e compensações
            </CardDescription>
          </div>
          <Badge variant={balance < 0 ? 'destructive' : balance > 0 ? 'default' : 'secondary'} className="text-lg px-3 py-1">
            {balance > 0 ? '+' : ''}{balance} dias
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[200px]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tipo</TableHead>
                <TableHead>Dias</TableHead>
                <TableHead>Período</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Data Registro</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {records.map((record) => {
                const tipoConfig = getTipoConfig(record.tipo);
                const TipoIcon = tipoConfig.icon;
                return (
                  <TableRow key={record.id}>
                    <TableCell>
                      <Badge variant="outline" className="gap-1">
                        <TipoIcon className={cn("h-3 w-3", tipoConfig.color)} />
                        {tipoConfig.label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={record.tipo === 'compensacao' ? 'default' : 'secondary'}>
                        {record.tipo === 'compensacao' ? '+' : '-'}{record.dias}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {record.data_inicio ? (
                        <span className="text-sm">
                          {format(parseISO(record.data_inicio), 'dd/MM/yyyy')}
                          {record.data_fim && ` - ${format(parseISO(record.data_fim), 'dd/MM/yyyy')}`}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">{record.descricao || '-'}</span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">
                        {format(parseISO(record.created_at), 'dd/MM/yyyy', { locale: ptBR })}
                      </span>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
