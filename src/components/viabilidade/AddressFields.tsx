import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Search, Loader2 } from 'lucide-react';
import { maskCEP, fetchAddressByCEP } from '@/lib/masks';
import { toast } from 'sonner';

export interface AddressData {
  cep: string;
  rua: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  estado: string;
}

interface Props {
  address: AddressData;
  onChange: (addr: AddressData) => void;
}

export function buildAddressString(a: AddressData): string {
  const parts: string[] = [];
  if (a.rua) {
    let line = a.rua;
    if (a.numero) line += `, ${a.numero}`;
    if (a.complemento) line += `, ${a.complemento}`;
    parts.push(line);
  }
  if (a.bairro) parts.push(a.bairro);
  const cidadeEstado = [a.cidade, a.estado].filter(Boolean).join('/');
  if (cidadeEstado) parts.push(cidadeEstado);
  if (a.cep) parts.push(`CEP: ${a.cep}`);
  return parts.join(' - ');
}

export function AddressFields({ address, onChange }: Props) {
  const [searching, setSearching] = useState(false);

  const update = (field: keyof AddressData, value: string) => {
    onChange({ ...address, [field]: value });
  };

  const handleCepSearch = async () => {
    const clean = address.cep.replace(/\D/g, '');
    if (clean.length !== 8) {
      toast.error('CEP inválido. Deve ter 8 dígitos.');
      return;
    }
    setSearching(true);
    try {
      const data = await fetchAddressByCEP(clean);
      if (data) {
        onChange({
          ...address,
          rua: data.logradouro || address.rua,
          bairro: data.bairro || address.bairro,
          cidade: data.localidade || address.cidade,
          estado: data.uf || address.estado,
          complemento: data.complemento || address.complemento,
        });
        toast.success('Endereço preenchido pelo CEP!');
      } else {
        toast.error('CEP não encontrado.');
      }
    } catch {
      toast.error('Erro ao buscar CEP.');
    } finally {
      setSearching(false);
    }
  };

  return (
    <div className="space-y-4">
      <Label className="text-sm font-medium">Endereço</Label>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-1">
          <Label className="text-xs text-muted-foreground">CEP</Label>
          <div className="flex gap-2">
            <Input
              value={address.cep}
              onChange={e => update('cep', maskCEP(e.target.value))}
              placeholder="00000-000"
              maxLength={9}
            />
            <Button type="button" size="icon" variant="outline" onClick={handleCepSearch} disabled={searching}>
              {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            </Button>
          </div>
        </div>
        <div className="md:col-span-2">
          <Label className="text-xs text-muted-foreground">Rua</Label>
          <Input value={address.rua} onChange={e => update('rua', e.target.value)} placeholder="Rua / Avenida" />
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div>
          <Label className="text-xs text-muted-foreground">Número</Label>
          <Input value={address.numero} onChange={e => update('numero', e.target.value)} placeholder="Nº" />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Complemento</Label>
          <Input value={address.complemento} onChange={e => update('complemento', e.target.value)} placeholder="Apto, Sala..." />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Bairro</Label>
          <Input value={address.bairro} onChange={e => update('bairro', e.target.value)} placeholder="Bairro" />
        </div>
        <div className="col-span-2 md:col-span-1">
          {/* spacer on mobile */}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-2">
          <Label className="text-xs text-muted-foreground">Cidade</Label>
          <Input value={address.cidade} onChange={e => update('cidade', e.target.value)} placeholder="Cidade" />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Estado (UF)</Label>
          <Input value={address.estado} onChange={e => update('estado', e.target.value)} placeholder="UF" maxLength={2} />
        </div>
      </div>
    </div>
  );
}
