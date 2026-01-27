import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Star } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { maskPhone } from '@/lib/masks';

interface Parceiro {
  id: string;
  nome_completo: string;
  nome_escritorio: string | null;
  telefone: string | null;
  email: string | null;
  observacoes: string | null;
  ranking: number;
  tipo: string;
  ativo: boolean;
  areas: { id: string; nome: string }[];
}

interface AreaAtuacao {
  id: string;
  nome: string;
  ativo: boolean;
}

interface ParceiroDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  parceiro: Parceiro | null;
  onSuccess: () => void;
}

export function ParceiroDialog({ open, onOpenChange, parceiro, onSuccess }: ParceiroDialogProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [areas, setAreas] = useState<AreaAtuacao[]>([]);
  const [formData, setFormData] = useState({
    nome_completo: '',
    nome_escritorio: '',
    telefone: '',
    email: '',
    observacoes: '',
    ranking: 0,
    tipo: 'indicamos',
    areasIds: [] as string[]
  });

  useEffect(() => {
    if (open) {
      fetchAreas();
      if (parceiro) {
        setFormData({
          nome_completo: parceiro.nome_completo,
          nome_escritorio: parceiro.nome_escritorio || '',
          telefone: parceiro.telefone || '',
          email: parceiro.email || '',
          observacoes: parceiro.observacoes || '',
          ranking: parceiro.ranking,
          tipo: parceiro.tipo as string,
          areasIds: parceiro.areas.map(a => a.id)
        });
      } else {
        setFormData({
          nome_completo: '',
          nome_escritorio: '',
          telefone: '',
          email: '',
          observacoes: '',
          ranking: 0,
          tipo: 'indicamos',
          areasIds: []
        });
      }
    }
  }, [open, parceiro]);

  const fetchAreas = async () => {
    const { data, error } = await supabase
      .from('parceiros_areas_atuacao')
      .select('*')
      .eq('ativo', true)
      .order('nome');

    if (error) {
      console.error('Erro ao carregar áreas:', error);
      return;
    }
    setAreas(data || []);
  };

  const handleSave = async () => {
    if (!formData.nome_completo.trim()) {
      toast.error('Nome completo é obrigatório');
      return;
    }

    setLoading(true);
    try {
      if (parceiro) {
        // Atualizar parceiro
        const { error } = await supabase
          .from('parceiros')
          .update({
            nome_completo: formData.nome_completo,
            nome_escritorio: formData.nome_escritorio || null,
            telefone: formData.telefone || null,
            email: formData.email || null,
            observacoes: formData.observacoes || null,
            ranking: formData.ranking,
            tipo: formData.tipo
          })
          .eq('id', parceiro.id);

        if (error) throw error;

        // Atualizar áreas
        await supabase.from('parceiros_areas').delete().eq('parceiro_id', parceiro.id);
        
        if (formData.areasIds.length > 0) {
          const areasInsert = formData.areasIds.map(areaId => ({
            parceiro_id: parceiro.id,
            area_id: areaId
          }));
          await supabase.from('parceiros_areas').insert(areasInsert);
        }

        toast.success('Parceiro atualizado com sucesso!');
      } else {
        // Criar novo parceiro
        const { data: newParceiro, error } = await supabase
          .from('parceiros')
          .insert({
            nome_completo: formData.nome_completo,
            nome_escritorio: formData.nome_escritorio || null,
            telefone: formData.telefone || null,
            email: formData.email || null,
            observacoes: formData.observacoes || null,
            ranking: formData.ranking,
            tipo: formData.tipo,
            created_by: user?.id
          })
          .select()
          .single();

        if (error) throw error;

        // Inserir áreas
        if (formData.areasIds.length > 0 && newParceiro) {
          const areasInsert = formData.areasIds.map(areaId => ({
            parceiro_id: newParceiro.id,
            area_id: areaId
          }));
          await supabase.from('parceiros_areas').insert(areasInsert);
        }

        toast.success('Parceiro cadastrado com sucesso!');
      }

      onOpenChange(false);
      onSuccess();
    } catch (error) {
      console.error('Erro ao salvar parceiro:', error);
      toast.error('Erro ao salvar parceiro');
    } finally {
      setLoading(false);
    }
  };

  const handleAreaToggle = (areaId: string) => {
    setFormData(prev => ({
      ...prev,
      areasIds: prev.areasIds.includes(areaId)
        ? prev.areasIds.filter(id => id !== areaId)
        : [...prev.areasIds, areaId]
    }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>{parceiro ? 'Editar Parceiro' : 'Novo Parceiro'}</DialogTitle>
          <DialogDescription>
            {parceiro ? 'Atualize os dados do parceiro' : 'Cadastre um novo parceiro de indicação'}
          </DialogDescription>
        </DialogHeader>
        
        <ScrollArea className="max-h-[60vh] pr-4">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label htmlFor="nome">Nome Completo *</Label>
                <Input
                  id="nome"
                  value={formData.nome_completo}
                  onChange={(e) => setFormData({ ...formData, nome_completo: e.target.value })}
                  placeholder="Nome completo do parceiro"
                />
              </div>
              
              <div>
                <Label htmlFor="escritorio">Nome do Escritório</Label>
                <Input
                  id="escritorio"
                  value={formData.nome_escritorio}
                  onChange={(e) => setFormData({ ...formData, nome_escritorio: e.target.value })}
                  placeholder="Nome do escritório"
                />
              </div>
              
              <div>
                <Label htmlFor="tipo">Tipo de Parceria *</Label>
                <Select value={formData.tipo} onValueChange={(v: any) => setFormData({ ...formData, tipo: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="indicamos">Indicamos para ele</SelectItem>
                    <SelectItem value="nos_indicam">Nos indica clientes</SelectItem>
                    <SelectItem value="ambos">Ambos (indicamos e recebemos)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label htmlFor="telefone">Telefone</Label>
                <Input
                  id="telefone"
                  value={formData.telefone}
                  onChange={(e) => setFormData({ ...formData, telefone: maskPhone(e.target.value) })}
                  placeholder="(XX) XXXXX-XXXX"
                  maxLength={15}
                />
              </div>
              
              <div>
                <Label htmlFor="email">E-mail</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="email@exemplo.com"
                />
              </div>
            </div>

            <div>
              <Label>Ranking</Label>
              <div className="flex items-center gap-2 mt-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setFormData({ ...formData, ranking: star === formData.ranking ? 0 : star })}
                    className="focus:outline-none"
                  >
                    <Star
                      className={`h-6 w-6 cursor-pointer transition-colors ${
                        star <= formData.ranking ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300 hover:text-yellow-200'
                      }`}
                    />
                  </button>
                ))}
                <span className="text-sm text-muted-foreground ml-2">
                  {formData.ranking === 0 ? 'Sem avaliação' : `${formData.ranking} estrela(s)`}
                </span>
              </div>
            </div>

            <div>
              <Label>Áreas de Atuação</Label>
              <div className="grid grid-cols-2 gap-2 mt-2 p-3 border rounded-md bg-muted/30">
                {areas.map((area) => (
                  <div key={area.id} className="flex items-center gap-2">
                    <Checkbox
                      id={`area-${area.id}`}
                      checked={formData.areasIds.includes(area.id)}
                      onCheckedChange={() => handleAreaToggle(area.id)}
                    />
                    <Label htmlFor={`area-${area.id}`} className="text-sm font-normal cursor-pointer">
                      {area.nome}
                    </Label>
                  </div>
                ))}
                {areas.length === 0 && (
                  <p className="text-sm text-muted-foreground col-span-2">
                    Nenhuma área cadastrada
                  </p>
                )}
              </div>
            </div>

            <div>
              <Label htmlFor="observacoes">Observações</Label>
              <Textarea
                id="observacoes"
                value={formData.observacoes}
                onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                placeholder="Observações sobre o parceiro..."
                rows={4}
              />
            </div>
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={loading}>
            {loading ? 'Salvando...' : 'Salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
