import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { Filter, X, Calendar as CalendarIcon, Search, RotateCcw } from 'lucide-react';
import { format, startOfMonth, endOfMonth, subMonths, startOfYear, endOfYear } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

export interface FiltrosAvancadosValues {
  busca: string;
  tipo: string;
  status: string;
  categoriaId: string;
  clienteId: string;
  setorId: string;
  contaId: string;
  dataInicio: Date | undefined;
  dataFim: Date | undefined;
  aReembolsar: string;
}

interface FiltrosAvancadosProps {
  valores: FiltrosAvancadosValues;
  onChange: (valores: FiltrosAvancadosValues) => void;
  onApply: () => void;
  onReset: () => void;
}

interface SelectOption {
  id: string;
  nome: string;
}

export function FiltrosAvancados({ valores, onChange, onApply, onReset }: FiltrosAvancadosProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [categorias, setCategorias] = useState<SelectOption[]>([]);
  const [clientes, setClientes] = useState<SelectOption[]>([]);
  const [setores, setSetores] = useState<SelectOption[]>([]);
  const [contas, setContas] = useState<SelectOption[]>([]);

  useEffect(() => {
    fetchOptions();
  }, []);

  const fetchOptions = async () => {
    const [catRes, cliRes, setRes, contRes] = await Promise.all([
      supabase.from('fin_categorias').select('id, nome').eq('ativa', true).order('nome'),
      supabase.from('fin_clientes').select('id, nome').eq('ativo', true).order('nome'),
      supabase.from('fin_setores').select('id, nome').eq('ativo', true).order('nome'),
      supabase.from('fin_contas').select('id, nome').eq('ativa', true).order('nome'),
    ]);

    setCategorias(catRes.data || []);
    setClientes(cliRes.data || []);
    setSetores(setRes.data || []);
    setContas(contRes.data || []);
  };

  const handleChange = (key: keyof FiltrosAvancadosValues, value: any) => {
    onChange({ ...valores, [key]: value });
  };

  const handlePeriodoPreset = (preset: string) => {
    const hoje = new Date();
    let inicio: Date;
    let fim: Date;

    switch (preset) {
      case 'mes_atual':
        inicio = startOfMonth(hoje);
        fim = endOfMonth(hoje);
        break;
      case 'mes_anterior':
        inicio = startOfMonth(subMonths(hoje, 1));
        fim = endOfMonth(subMonths(hoje, 1));
        break;
      case 'trimestre':
        inicio = startOfMonth(subMonths(hoje, 2));
        fim = endOfMonth(hoje);
        break;
      case 'semestre':
        inicio = startOfMonth(subMonths(hoje, 5));
        fim = endOfMonth(hoje);
        break;
      case 'ano_atual':
        inicio = startOfYear(hoje);
        fim = endOfYear(hoje);
        break;
      default:
        return;
    }

    onChange({ ...valores, dataInicio: inicio, dataFim: fim });
  };

  const activeFiltersCount = [
    valores.tipo !== 'todos',
    valores.status !== 'todos',
    valores.categoriaId,
    valores.clienteId,
    valores.setorId,
    valores.contaId,
    valores.dataInicio,
    valores.dataFim,
    valores.aReembolsar !== 'todos',
    valores.busca,
  ].filter(Boolean).length;

  return (
    <div className="space-y-4">
      {/* Barra principal de filtros */}
      <div className="flex flex-wrap gap-3 items-center">
        {/* Busca */}
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por descrição, cliente, nº documento..."
            value={valores.busca}
            onChange={(e) => handleChange('busca', e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Tipo */}
        <Select value={valores.tipo} onValueChange={(v) => handleChange('tipo', v)}>
          <SelectTrigger className="w-[130px]">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos tipos</SelectItem>
            <SelectItem value="receita">Receitas</SelectItem>
            <SelectItem value="despesa">Despesas</SelectItem>
            <SelectItem value="transferencia">Transferências</SelectItem>
          </SelectContent>
        </Select>

        {/* Status */}
        <Select value={valores.status} onValueChange={(v) => handleChange('status', v)}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos status</SelectItem>
            <SelectItem value="pago">Pago</SelectItem>
            <SelectItem value="pendente">Pendente</SelectItem>
            <SelectItem value="agendado">Agendado</SelectItem>
            <SelectItem value="cancelado">Cancelado</SelectItem>
          </SelectContent>
        </Select>

        {/* Período Presets */}
        <Select onValueChange={handlePeriodoPreset}>
          <SelectTrigger className="w-[150px]">
            <CalendarIcon className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Período" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="mes_atual">Mês Atual</SelectItem>
            <SelectItem value="mes_anterior">Mês Anterior</SelectItem>
            <SelectItem value="trimestre">Último Trimestre</SelectItem>
            <SelectItem value="semestre">Último Semestre</SelectItem>
            <SelectItem value="ano_atual">Ano Atual</SelectItem>
          </SelectContent>
        </Select>

        {/* Botão Mais Filtros */}
        <Popover open={isOpen} onOpenChange={setIsOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" className="relative">
              <Filter className="h-4 w-4 mr-2" />
              Mais Filtros
              {activeFiltersCount > 0 && (
                <Badge className="ml-2 h-5 w-5 p-0 flex items-center justify-center text-xs">
                  {activeFiltersCount}
                </Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-96 p-4" align="end">
            <div className="space-y-4">
              <h4 className="font-medium">Filtros Avançados</h4>
              
              <div className="grid grid-cols-2 gap-3">
                {/* Categoria */}
                <div className="space-y-1.5">
                  <Label className="text-xs">Categoria</Label>
                  <Select value={valores.categoriaId} onValueChange={(v) => handleChange('categoriaId', v)}>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Todas" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Todas</SelectItem>
                      {categorias.map(c => (
                        <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Cliente */}
                <div className="space-y-1.5">
                  <Label className="text-xs">Cliente</Label>
                  <Select value={valores.clienteId} onValueChange={(v) => handleChange('clienteId', v)}>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Todos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Todos</SelectItem>
                      {clientes.map(c => (
                        <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Setor */}
                <div className="space-y-1.5">
                  <Label className="text-xs">Setor</Label>
                  <Select value={valores.setorId} onValueChange={(v) => handleChange('setorId', v)}>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Todos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Todos</SelectItem>
                      {setores.map(s => (
                        <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Conta */}
                <div className="space-y-1.5">
                  <Label className="text-xs">Conta</Label>
                  <Select value={valores.contaId} onValueChange={(v) => handleChange('contaId', v)}>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Todas" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Todas</SelectItem>
                      {contas.map(c => (
                        <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Reembolso */}
                <div className="space-y-1.5 col-span-2">
                  <Label className="text-xs">Reembolso</Label>
                  <Select value={valores.aReembolsar} onValueChange={(v) => handleChange('aReembolsar', v)}>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Todos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos</SelectItem>
                      <SelectItem value="a_reembolsar">A Reembolsar</SelectItem>
                      <SelectItem value="reembolsada">Reembolsada</SelectItem>
                      <SelectItem value="nao_reembolsavel">Não Reembolsável</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Datas */}
                <div className="space-y-1.5">
                  <Label className="text-xs">Data Início</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full h-9 justify-start text-left font-normal",
                          !valores.dataInicio && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {valores.dataInicio ? format(valores.dataInicio, "dd/MM/yyyy") : "Selecionar"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={valores.dataInicio}
                        onSelect={(date) => handleChange('dataInicio', date)}
                        initialFocus
                        locale={ptBR}
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Data Fim</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full h-9 justify-start text-left font-normal",
                          !valores.dataFim && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {valores.dataFim ? format(valores.dataFim, "dd/MM/yyyy") : "Selecionar"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={valores.dataFim}
                        onSelect={(date) => handleChange('dataFim', date)}
                        initialFocus
                        locale={ptBR}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <Button variant="outline" className="flex-1" onClick={() => { onReset(); setIsOpen(false); }}>
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Limpar
                </Button>
                <Button className="flex-1" onClick={() => { onApply(); setIsOpen(false); }}>
                  Aplicar Filtros
                </Button>
              </div>
            </div>
          </PopoverContent>
        </Popover>

        {/* Limpar Filtros */}
        {activeFiltersCount > 0 && (
          <Button variant="ghost" size="sm" onClick={onReset}>
            <X className="h-4 w-4 mr-1" />
            Limpar ({activeFiltersCount})
          </Button>
        )}
      </div>

      {/* Tags de filtros ativos */}
      {activeFiltersCount > 0 && (
        <div className="flex flex-wrap gap-2">
          {valores.busca && (
            <Badge variant="secondary" className="gap-1">
              Busca: {valores.busca}
              <X className="h-3 w-3 cursor-pointer" onClick={() => handleChange('busca', '')} />
            </Badge>
          )}
          {valores.tipo !== 'todos' && (
            <Badge variant="secondary" className="gap-1">
              Tipo: {valores.tipo}
              <X className="h-3 w-3 cursor-pointer" onClick={() => handleChange('tipo', 'todos')} />
            </Badge>
          )}
          {valores.status !== 'todos' && (
            <Badge variant="secondary" className="gap-1">
              Status: {valores.status}
              <X className="h-3 w-3 cursor-pointer" onClick={() => handleChange('status', 'todos')} />
            </Badge>
          )}
          {valores.dataInicio && valores.dataFim && (
            <Badge variant="secondary" className="gap-1">
              {format(valores.dataInicio, 'dd/MM')} - {format(valores.dataFim, 'dd/MM/yyyy')}
              <X className="h-3 w-3 cursor-pointer" onClick={() => { handleChange('dataInicio', undefined); handleChange('dataFim', undefined); }} />
            </Badge>
          )}
        </div>
      )}
    </div>
  );
}

// Hook para valores padrão dos filtros
export function useDefaultFiltros(): FiltrosAvancadosValues {
  const hoje = new Date();
  return {
    busca: '',
    tipo: 'todos',
    status: 'todos',
    categoriaId: '',
    clienteId: '',
    setorId: '',
    contaId: '',
    dataInicio: startOfMonth(hoje),
    dataFim: endOfMonth(hoje),
    aReembolsar: 'todos',
  };
}
