import { useState, useEffect, useMemo } from 'react';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Search, Sparkles, Save, Check, Loader2, Languages } from 'lucide-react';

const MOVEMENTS_CACHE_KEY = 'advbox-movements-full-cache';

interface Translation {
  id?: string;
  original_title: string;
  translated_text: string | null;
  suggested_by_ai: boolean;
}

export default function TraducaoAndamentos() {
  const [translations, setTranslations] = useState<Map<string, Translation>>(new Map());
  const [uniqueTitles, setUniqueTitles] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [savingTitle, setSavingTitle] = useState<string | null>(null);
  const [suggestingTitle, setSuggestingTitle] = useState<string | null>(null);
  const [suggestingAll, setSuggestingAll] = useState(false);
  const [editValues, setEditValues] = useState<Map<string, string>>(new Map());
  const [filterStatus, setFilterStatus] = useState<'all' | 'translated' | 'pending'>('all');
  const { toast } = useToast();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      // Load movements from cache
      const cached = localStorage.getItem(MOVEMENTS_CACHE_KEY);
      let titles: string[] = [];
      if (cached) {
        const movements = JSON.parse(cached);
        const titleSet = new Set<string>();
        movements.forEach((m: any) => {
          if (m.title && m.title.trim()) titleSet.add(m.title.trim());
        });
        titles = Array.from(titleSet).sort((a, b) => a.localeCompare(b, 'pt-BR'));
      }
      setUniqueTitles(titles);

      // Load existing translations
      const { data, error } = await supabase
        .from('movement_translations')
        .select('*');

      if (error) throw error;

      const map = new Map<string, Translation>();
      (data || []).forEach((t: any) => {
        map.set(t.original_title, {
          id: t.id,
          original_title: t.original_title,
          translated_text: t.translated_text,
          suggested_by_ai: t.suggested_by_ai,
        });
      });

      // Initialize edit values
      const edits = new Map<string, string>();
      titles.forEach(title => {
        const existing = map.get(title);
        edits.set(title, existing?.translated_text || '');
      });
      setEditValues(edits);
      setTranslations(map);
    } catch (error: any) {
      console.error('Error loading data:', error);
      toast({ title: 'Erro ao carregar dados', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (title: string) => {
    const text = editValues.get(title) || '';
    if (!text.trim()) return;

    setSavingTitle(title);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from('movement_translations')
        .upsert({
          original_title: title,
          translated_text: text.trim(),
          suggested_by_ai: false,
          updated_by: user?.id,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'original_title' });

      if (error) throw error;

      setTranslations(prev => {
        const next = new Map(prev);
        next.set(title, {
          ...prev.get(title),
          original_title: title,
          translated_text: text.trim(),
          suggested_by_ai: false,
        });
        return next;
      });

      toast({ title: 'Tradução salva com sucesso' });
    } catch (error: any) {
      toast({ title: 'Erro ao salvar', description: error.message, variant: 'destructive' });
    } finally {
      setSavingTitle(null);
    }
  };

  const handleSuggestAI = async (title: string) => {
    setSuggestingTitle(title);
    try {
      const { data, error } = await supabase.functions.invoke('translate-movement', {
        body: { title },
      });

      if (error) throw error;

      const translated = data?.translations?.[0]?.translated || '';
      if (translated) {
        setEditValues(prev => {
          const next = new Map(prev);
          next.set(title, translated);
          return next;
        });

        // Auto-save
        const { data: { user } } = await supabase.auth.getUser();
        await supabase
          .from('movement_translations')
          .upsert({
            original_title: title,
            translated_text: translated,
            suggested_by_ai: true,
            updated_by: user?.id,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'original_title' });

        setTranslations(prev => {
          const next = new Map(prev);
          next.set(title, {
            ...prev.get(title),
            original_title: title,
            translated_text: translated,
            suggested_by_ai: true,
          });
          return next;
        });

        toast({ title: 'Tradução sugerida pela IA' });
      }
    } catch (error: any) {
      toast({ title: 'Erro ao sugerir tradução', description: error.message, variant: 'destructive' });
    } finally {
      setSuggestingTitle(null);
    }
  };

  const handleSuggestAll = async () => {
    const pending = filteredTitles.filter(t => !translations.get(t)?.translated_text);
    if (pending.length === 0) {
      toast({ title: 'Todos já possuem tradução' });
      return;
    }

    setSuggestingAll(true);
    try {
      // Process in chunks of 10
      const chunkSize = 10;
      let processed = 0;

      for (let i = 0; i < pending.length; i += chunkSize) {
        const chunk = pending.slice(i, i + chunkSize);
        
        const { data, error } = await supabase.functions.invoke('translate-movement', {
          body: { titles: chunk },
        });

        if (error) throw error;

        const results = data?.translations || [];
        const { data: { user } } = await supabase.auth.getUser();

        for (const result of results) {
          if (result.translated) {
            setEditValues(prev => {
              const next = new Map(prev);
              next.set(result.original, result.translated);
              return next;
            });

            await supabase
              .from('movement_translations')
              .upsert({
                original_title: result.original,
                translated_text: result.translated,
                suggested_by_ai: true,
                updated_by: user?.id,
                updated_at: new Date().toISOString(),
              }, { onConflict: 'original_title' });

            setTranslations(prev => {
              const next = new Map(prev);
              next.set(result.original, {
                original_title: result.original,
                translated_text: result.translated,
                suggested_by_ai: true,
              });
              return next;
            });

            processed++;
          }
        }
      }

      toast({ title: `${processed} traduções geradas com IA` });
    } catch (error: any) {
      toast({ title: 'Erro ao sugerir traduções', description: error.message, variant: 'destructive' });
    } finally {
      setSuggestingAll(false);
    }
  };

  const filteredTitles = useMemo(() => {
    let result = uniqueTitles;

    if (searchTerm) {
      const lower = searchTerm.toLowerCase();
      result = result.filter(t => 
        t.toLowerCase().includes(lower) || 
        (translations.get(t)?.translated_text || '').toLowerCase().includes(lower)
      );
    }

    if (filterStatus === 'translated') {
      result = result.filter(t => translations.get(t)?.translated_text);
    } else if (filterStatus === 'pending') {
      result = result.filter(t => !translations.get(t)?.translated_text);
    }

    return result;
  }, [uniqueTitles, searchTerm, filterStatus, translations]);

  const translatedCount = uniqueTitles.filter(t => translations.get(t)?.translated_text).length;
  const pendingCount = uniqueTitles.length - translatedCount;

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Languages className="h-6 w-6 text-primary" />
              Tradução de Andamentos
            </h1>
            <p className="text-muted-foreground mt-1">
              Traduza andamentos processuais para linguagem simples
            </p>
          </div>
          <Button 
            onClick={handleSuggestAll} 
            disabled={suggestingAll || pendingCount === 0}
            className="gap-2"
          >
            {suggestingAll ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Sugerir todas com IA ({pendingCount} pendentes)
          </Button>
        </div>

        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Buscar andamento ou tradução..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex gap-2">
            <Badge 
              variant={filterStatus === 'all' ? 'default' : 'outline'} 
              className="cursor-pointer px-3 py-1.5"
              onClick={() => setFilterStatus('all')}
            >
              Todos ({uniqueTitles.length})
            </Badge>
            <Badge 
              variant={filterStatus === 'translated' ? 'default' : 'outline'} 
              className="cursor-pointer px-3 py-1.5"
              onClick={() => setFilterStatus('translated')}
            >
              <Check className="h-3 w-3 mr-1" />
              Traduzidos ({translatedCount})
            </Badge>
            <Badge 
              variant={filterStatus === 'pending' ? 'default' : 'outline'} 
              className="cursor-pointer px-3 py-1.5"
              onClick={() => setFilterStatus('pending')}
            >
              Pendentes ({pendingCount})
            </Badge>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              Andamentos ({filteredTitles.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : uniqueTitles.length === 0 ? (
              <p className="text-center text-muted-foreground py-12">
                Nenhum andamento encontrado no cache. Acesse a página de Movimentações ADVBox primeiro para sincronizar os dados.
              </p>
            ) : (
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[35%]">Andamento Original</TableHead>
                      <TableHead className="w-[45%]">Tradução Humanizada</TableHead>
                      <TableHead className="w-[20%]">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredTitles.map((title) => {
                      const existing = translations.get(title);
                      const editValue = editValues.get(title) || '';
                      const hasChanged = editValue !== (existing?.translated_text || '');
                      const isSaving = savingTitle === title;
                      const isSuggesting = suggestingTitle === title;

                      return (
                        <TableRow key={title}>
                          <TableCell className="align-top">
                            <div className="flex items-start gap-2">
                              <span className="text-sm font-medium">{title}</span>
                              {existing?.suggested_by_ai && (
                                <Badge variant="secondary" className="text-xs shrink-0">
                                  <Sparkles className="h-3 w-3 mr-1" />
                                  IA
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="align-top">
                            <Textarea
                              value={editValue}
                              onChange={(e) => {
                                setEditValues(prev => {
                                  const next = new Map(prev);
                                  next.set(title, e.target.value);
                                  return next;
                                });
                              }}
                              placeholder="Digite a tradução humanizada..."
                              className="min-h-[60px] text-sm"
                              rows={2}
                            />
                          </TableCell>
                          <TableCell className="align-top">
                            <div className="flex flex-col gap-1.5">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleSuggestAI(title)}
                                disabled={isSuggesting || suggestingAll}
                                className="gap-1 text-xs"
                              >
                                {isSuggesting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                                Sugerir IA
                              </Button>
                              {hasChanged && editValue.trim() && (
                                <Button
                                  size="sm"
                                  onClick={() => handleSave(title)}
                                  disabled={isSaving}
                                  className="gap-1 text-xs"
                                >
                                  {isSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                                  Salvar
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
