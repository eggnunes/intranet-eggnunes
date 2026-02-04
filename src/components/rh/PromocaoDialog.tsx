import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { Award, TrendingUp, Calendar, FileText } from 'lucide-react';
import { format } from 'date-fns';

interface Colaborador {
  id: string;
  full_name: string;
  cargo_id: string | null;
  position: string;
}

interface Cargo {
  id: string;
  nome: string;
  valor_base: number;
}

interface PromocaoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  colaborador?: Colaborador | null;
  onSuccess: () => void;
}

export function PromocaoDialog({ open, onOpenChange, colaborador, onSuccess }: PromocaoDialogProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [cargos, setCargos] = useState<Cargo[]>([]);
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([]);
  
  // Form state
  const [selectedColaboradorId, setSelectedColaboradorId] = useState<string>('');
  const [cargoAnteriorId, setCargoAnteriorId] = useState<string>('');
  const [cargoNovoId, setCargoNovoId] = useState<string>('');
  const [dataPromocao, setDataPromocao] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [observacoes, setObservacoes] = useState<string>('');
  const [atualizarCargoAtual, setAtualizarCargoAtual] = useState<boolean>(true);

  useEffect(() => {
    if (open) {
      fetchData();
      if (colaborador) {
        setSelectedColaboradorId(colaborador.id);
        setCargoAnteriorId(colaborador.cargo_id || '');
      }
    }
  }, [open, colaborador]);

  const fetchData = async () => {
    try {
      const [cargosRes, colabRes] = await Promise.all([
        supabase
          .from('rh_cargos')
          .select('id, nome, valor_base')
          .eq('is_active', true)
          .order('nome'),
        supabase
          .from('profiles')
          .select('id, full_name, cargo_id, position')
          .eq('approval_status', 'approved')
          .eq('is_active', true)
          .order('full_name')
      ]);

      if (cargosRes.error) throw cargosRes.error;
      if (colabRes.error) throw colabRes.error;

      setCargos(cargosRes.data || []);
      setColaboradores(colabRes.data as Colaborador[] || []);
    } catch (error: any) {
      toast.error('Erro ao carregar dados: ' + error.message);
    }
  };

  const handleColaboradorChange = (colabId: string) => {
    setSelectedColaboradorId(colabId);
    const colab = colaboradores.find(c => c.id === colabId);
    if (colab) {
      setCargoAnteriorId(colab.cargo_id || '');
    }
  };

  const handleSubmit = async () => {
    if (!selectedColaboradorId || !cargoNovoId) {
      toast.error('Selecione o colaborador e o novo cargo');
      return;
    }

    if (cargoAnteriorId === cargoNovoId) {
      toast.error('O cargo novo deve ser diferente do anterior');
      return;
    }

    setLoading(true);
    try {
      const cargoAnterior = cargos.find(c => c.id === cargoAnteriorId);
      const cargoNovo = cargos.find(c => c.id === cargoNovoId);

      // Registrar promoção
      const { error: promocaoError } = await supabase
        .from('rh_promocoes')
        .insert({
          colaborador_id: selectedColaboradorId,
          cargo_anterior_id: cargoAnteriorId || null,
          cargo_anterior_nome: cargoAnterior?.nome || 'Sem cargo definido',
          cargo_novo_id: cargoNovoId,
          cargo_novo_nome: cargoNovo?.nome || '',
          data_promocao: dataPromocao,
          observacoes: observacoes || null,
          registrado_por: user?.id
        });

      if (promocaoError) throw promocaoError;

      // Atualizar cargo atual do colaborador se marcado
      if (atualizarCargoAtual) {
        const { error: updateError } = await supabase
          .from('profiles')
          .update({ cargo_id: cargoNovoId })
          .eq('id', selectedColaboradorId);

        if (updateError) throw updateError;
      }

      // Registrar no histórico de salário (se houver mudança de valor)
      if (cargoAnterior && cargoNovo && cargoAnterior.valor_base !== cargoNovo.valor_base) {
        await supabase
          .from('rh_historico_salario')
          .insert({
            colaborador_id: selectedColaboradorId,
            salario_anterior: cargoAnterior.valor_base,
            salario_novo: cargoNovo.valor_base,
            data_alteracao: dataPromocao,
            observacao: `Promoção: ${cargoAnterior.nome} → ${cargoNovo.nome}`
          });
      }

      toast.success('Promoção registrada com sucesso!');
      resetForm();
      onOpenChange(false);
      onSuccess();
    } catch (error: any) {
      toast.error('Erro ao registrar promoção: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setSelectedColaboradorId('');
    setCargoAnteriorId('');
    setCargoNovoId('');
    setDataPromocao(format(new Date(), 'yyyy-MM-dd'));
    setObservacoes('');
    setAtualizarCargoAtual(true);
  };

  const formatCurrency = (value: number) => {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const selectedColab = colaboradores.find(c => c.id === selectedColaboradorId);
  const cargoAnterior = cargos.find(c => c.id === cargoAnteriorId);
  const cargoNovo = cargos.find(c => c.id === cargoNovoId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Award className="h-5 w-5 text-green-500" />
            Registrar Promoção
          </DialogTitle>
          <DialogDescription>
            Registre uma promoção de cargo, incluindo datas retroativas.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Colaborador */}
          <div className="space-y-2">
            <Label htmlFor="colaborador">Colaborador</Label>
            <Select 
              value={selectedColaboradorId} 
              onValueChange={handleColaboradorChange}
              disabled={!!colaborador}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione o colaborador" />
              </SelectTrigger>
              <SelectContent>
                {colaboradores.map(colab => (
                  <SelectItem key={colab.id} value={colab.id}>
                    {colab.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Cargo Anterior */}
          <div className="space-y-2">
            <Label htmlFor="cargoAnterior">Cargo Anterior</Label>
            <Select value={cargoAnteriorId} onValueChange={setCargoAnteriorId}>
              <SelectTrigger>
                <SelectValue placeholder="Cargo anterior (opcional)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sem cargo definido</SelectItem>
                {cargos.map(cargo => (
                  <SelectItem key={cargo.id} value={cargo.id}>
                    {cargo.nome} - {formatCurrency(cargo.valor_base)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Cargo Novo */}
          <div className="space-y-2">
            <Label htmlFor="cargoNovo">Novo Cargo *</Label>
            <Select value={cargoNovoId} onValueChange={setCargoNovoId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o novo cargo" />
              </SelectTrigger>
              <SelectContent>
                {cargos.map(cargo => (
                  <SelectItem key={cargo.id} value={cargo.id}>
                    {cargo.nome} - {formatCurrency(cargo.valor_base)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Preview da mudança */}
          {cargoNovo && (
            <div className="bg-muted/50 rounded-lg p-3 flex items-center gap-3">
              <TrendingUp className="h-5 w-5 text-green-500" />
              <div className="flex-1">
                <p className="text-sm font-medium">
                  {cargoAnterior?.nome || 'Sem cargo'} → {cargoNovo.nome}
                </p>
                {cargoAnterior && (
                  <p className="text-xs text-muted-foreground">
                    Ajuste: {formatCurrency(cargoNovo.valor_base - cargoAnterior.valor_base)} 
                    ({cargoNovo.valor_base > cargoAnterior.valor_base ? '+' : ''}{Math.round(((cargoNovo.valor_base - cargoAnterior.valor_base) / cargoAnterior.valor_base) * 100)}%)
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Data da Promoção */}
          <div className="space-y-2">
            <Label htmlFor="dataPromocao" className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Data da Promoção
            </Label>
            <Input
              id="dataPromocao"
              type="date"
              value={dataPromocao}
              onChange={(e) => setDataPromocao(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Pode ser uma data retroativa para promoções já ocorridas.
            </p>
          </div>

          {/* Observações */}
          <div className="space-y-2">
            <Label htmlFor="observacoes" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Observações
            </Label>
            <Textarea
              id="observacoes"
              placeholder="Motivo ou detalhes da promoção..."
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              rows={3}
            />
          </div>

          {/* Atualizar cargo atual */}
          <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
            <div>
              <Label htmlFor="atualizarCargo" className="font-medium">
                Atualizar cargo atual do colaborador
              </Label>
              <p className="text-xs text-muted-foreground">
                O cargo no cadastro será atualizado automaticamente
              </p>
            </div>
            <Switch
              id="atualizarCargo"
              checked={atualizarCargoAtual}
              onCheckedChange={setAtualizarCargoAtual}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={loading || !selectedColaboradorId || !cargoNovoId}>
            {loading ? 'Salvando...' : 'Registrar Promoção'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
