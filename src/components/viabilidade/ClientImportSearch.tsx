import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Search, Database, Users, Megaphone, Loader2 } from 'lucide-react';

interface ClientData {
  nome: string;
  cpf: string;
  telefone: string;
  email: string;
  cidade?: string;
  estado?: string;
}

interface Props {
  onSelect: (data: ClientData) => void;
}

export function ClientImportSearch({ onSelect }: Props) {
  const [tab, setTab] = useState('advbox');
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const doSearch = useCallback(async (term: string, source: string) => {
    if (term.length < 2) { setResults([]); return; }
    setLoading(true);
    try {
      if (source === 'advbox') {
        const { data } = await supabase.from('advbox_customers').select('name, cpf, tax_id, email, phone').ilike('name', `%${term}%`).limit(10);
        setResults(data || []);
      } else if (source === 'crm') {
        const { data } = await supabase.from('crm_contacts').select('name, email, phone, company, city, state').ilike('name', `%${term}%`).limit(10);
        setResults(data || []);
      } else {
        const { data } = await supabase.from('captured_leads').select('name, email, phone').ilike('name', `%${term}%`).limit(10);
        setResults(data || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => doSearch(search, tab), 300);
    return () => clearTimeout(timer);
  }, [search, tab, doSearch]);

  const handleSelect = (item: any) => {
    if (tab === 'advbox') {
      onSelect({
        nome: item.name || '',
        cpf: item.cpf || item.tax_id || '',
        telefone: item.phone || '',
        email: item.email || '',
      });
    } else if (tab === 'crm') {
      onSelect({
        nome: item.name || '',
        cpf: '',
        telefone: item.phone || '',
        email: item.email || '',
        cidade: item.city || '',
        estado: item.state || '',
      });
    } else {
      onSelect({
        nome: item.name || '',
        cpf: '',
        telefone: item.phone || '',
        email: item.email || '',
      });
    }
    setSearch('');
    setResults([]);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Search className="h-5 w-5" />
          Importar Dados do Cliente
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <Tabs value={tab} onValueChange={v => { setTab(v); setSearch(''); setResults([]); }}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="advbox" className="gap-1.5 text-xs sm:text-sm">
              <Database className="h-3.5 w-3.5" /> ADVBox
            </TabsTrigger>
            <TabsTrigger value="crm" className="gap-1.5 text-xs sm:text-sm">
              <Users className="h-3.5 w-3.5" /> CRM
            </TabsTrigger>
            <TabsTrigger value="leads" className="gap-1.5 text-xs sm:text-sm">
              <Megaphone className="h-3.5 w-3.5" /> Leads
            </TabsTrigger>
          </TabsList>

          {['advbox', 'crm', 'leads'].map(src => (
            <TabsContent key={src} value={src} className="mt-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder={`Buscar ${src === 'advbox' ? 'no ADVBox' : src === 'crm' ? 'no CRM' : 'nos Leads'}...`}
                  className="pl-9"
                />
              </div>
            </TabsContent>
          ))}
        </Tabs>

        {loading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Buscando...
          </div>
        )}

        {results.length > 0 && (
          <div className="border rounded-md divide-y max-h-48 overflow-y-auto">
            {results.map((item, i) => (
              <button
                key={i}
                type="button"
                onClick={() => handleSelect(item)}
                className="w-full text-left px-3 py-2.5 hover:bg-accent/50 transition-colors"
              >
                <p className="text-sm font-medium text-foreground">{item.name}</p>
                <p className="text-xs text-muted-foreground">
                  {[item.email, item.phone, item.cpf || item.tax_id].filter(Boolean).join(' · ')}
                </p>
              </button>
            ))}
          </div>
        )}

        {search.length >= 2 && !loading && results.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-2">Nenhum resultado encontrado</p>
        )}
      </CardContent>
    </Card>
  );
}
