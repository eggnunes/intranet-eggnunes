import { useState, useEffect, useMemo } from 'react';
import { Layout } from '@/components/Layout';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Search, History, Bookmark, Loader2, Trash2, Download, Save, Filter, X } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface SearchHistory {
  id: string;
  query: string;
  response: string;
  created_at: string;
}

interface SavedJurisprudence {
  id: string;
  title: string;
  content: string;
  source: string | null;
  notes: string | null;
  court: string | null;
  category: string | null;
  created_at: string;
}

interface JurisprudenciaItem {
  tribunal: string;
  numero_processo: string;
  relator: string;
  orgao_julgador?: string;
  data_julgamento: string;
  ementa: string;
  resumo: string;
  area_direito: string;
  assunto?: string;
  tese_firmada?: string;
  palavras_chave?: string[];
  sumulas_relacionadas?: string;
}

interface ParsedResult {
  jurisprudencias: JurisprudenciaItem[];
  observacoes_gerais?: string;
}

export default function PesquisaJurisprudencia() {
  const { user } = useAuth();
  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResult, setSearchResult] = useState<string | null>(null);
  const [parsedResult, setParsedResult] = useState<ParsedResult | null>(null);
  const [searchHistory, setSearchHistory] = useState<SearchHistory[]>([]);
  const [savedJurisprudence, setSavedJurisprudence] = useState<SavedJurisprudence[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [loadingSaved, setLoadingSaved] = useState(true);
  const [activeTab, setActiveTab] = useState('search');
  
  // Filtros para jurisprudências salvas
  const [filterCourt, setFilterCourt] = useState<string>('todos');
  const [filterCategory, setFilterCategory] = useState<string>('todos');
  const [filterSearch, setFilterSearch] = useState('');
  
  // Dialog para salvar jurisprudência
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [saveTitle, setSaveTitle] = useState('');
  const [saveContent, setSaveContent] = useState('');
  const [saveSource, setSaveSource] = useState('');
  const [saveNotes, setSaveNotes] = useState('');
  const [saveCourt, setSaveCourt] = useState('');
  const [saveCategory, setSaveCategory] = useState('');
  const [currentSearchId, setCurrentSearchId] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      fetchHistory();
      fetchSaved();
    }
  }, [user]);

  const fetchHistory = async () => {
    try {
      const { data, error } = await supabase
        .from('jurisprudence_searches')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setSearchHistory(data || []);
    } catch (error) {
      console.error('Erro ao carregar histórico:', error);
    } finally {
      setLoadingHistory(false);
    }
  };

  const fetchSaved = async () => {
    try {
      const { data, error } = await supabase
        .from('saved_jurisprudence')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setSavedJurisprudence(data || []);
    } catch (error) {
      console.error('Erro ao carregar jurisprudências salvas:', error);
    } finally {
      setLoadingSaved(false);
    }
  };

  const handleSearch = async () => {
    if (!query.trim()) {
      toast.error('Digite uma pesquisa');
      return;
    }

    setIsSearching(true);
    setSearchResult(null);
    setParsedResult(null);

    try {
      const { data, error } = await supabase.functions.invoke('search-jurisprudence', {
        body: { query: query.trim() }
      });

      if (error) throw error;

      if (data.error) {
        throw new Error(data.error);
      }

      const result = data.result;
      const parsed = data.parsed as ParsedResult | null;
      
      setSearchResult(result);
      setParsedResult(parsed);

      // Salvar no histórico
      const { data: savedSearch, error: saveError } = await supabase
        .from('jurisprudence_searches')
        .insert({
          user_id: user?.id,
          query: query.trim(),
          response: result
        })
        .select()
        .single();

      if (saveError) {
        console.error('Erro ao salvar histórico:', saveError);
      } else {
        setCurrentSearchId(savedSearch.id);
        fetchHistory();
      }

      toast.success('Pesquisa concluída');
    } catch (error: any) {
      console.error('Erro na pesquisa:', error);
      toast.error(error.message || 'Erro ao pesquisar jurisprudência');
    } finally {
      setIsSearching(false);
    }
  };

  const openSaveDialog = (content: string, title?: string, searchId?: string, court?: string, category?: string) => {
    setSaveContent(content);
    setSaveTitle(title || '');
    setSaveSource('Pesquisa Perplexity AI');
    setSaveNotes('');
    setSaveCourt(court || '');
    setSaveCategory(category || '');
    setCurrentSearchId(searchId || null);
    setSaveDialogOpen(true);
  };

  const openSaveDialogFromJuris = (juris: JurisprudenciaItem, searchId?: string) => {
    const content = `TRIBUNAL: ${juris.tribunal}
PROCESSO: ${juris.numero_processo}
RELATOR: ${juris.relator || 'Não informado'}
ÓRGÃO JULGADOR: ${juris.orgao_julgador || 'Não informado'}
DATA: ${juris.data_julgamento || 'Não informada'}
ÁREA: ${juris.area_direito || 'Não informada'}
ASSUNTO: ${juris.assunto || 'Não informado'}

EMENTA:
${juris.ementa || 'Não disponível'}

RESUMO:
${juris.resumo || 'Não disponível'}
${juris.tese_firmada ? `\nTESE FIRMADA:\n${juris.tese_firmada}` : ''}
${juris.palavras_chave && juris.palavras_chave.length > 0 ? `\nPALAVRAS-CHAVE: ${juris.palavras_chave.join(', ')}` : ''}`;

    const title = `${juris.tribunal} - ${juris.numero_processo}`;
    openSaveDialog(content, title, searchId, juris.tribunal, juris.area_direito);
  };

  const handleSaveJurisprudence = async () => {
    if (!saveTitle.trim() || !saveContent.trim()) {
      toast.error('Título e conteúdo são obrigatórios');
      return;
    }

    try {
      const { error } = await supabase
        .from('saved_jurisprudence')
        .insert({
          user_id: user?.id,
          title: saveTitle.trim(),
          content: saveContent.trim(),
          source: saveSource.trim() || null,
          notes: saveNotes.trim() || null,
          court: saveCourt.trim() || null,
          category: saveCategory.trim() || null,
          search_id: currentSearchId
        });

      if (error) throw error;

      toast.success('Jurisprudência salva com sucesso');
      setSaveDialogOpen(false);
      fetchSaved();
    } catch (error: any) {
      console.error('Erro ao salvar:', error);
      toast.error('Erro ao salvar jurisprudência');
    }
  };

  const handleDeleteHistory = async (id: string) => {
    try {
      const { error } = await supabase
        .from('jurisprudence_searches')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('Pesquisa removida do histórico');
      fetchHistory();
    } catch (error) {
      console.error('Erro ao deletar:', error);
      toast.error('Erro ao remover pesquisa');
    }
  };

  const handleDeleteSaved = async (id: string) => {
    try {
      const { error } = await supabase
        .from('saved_jurisprudence')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('Jurisprudência removida');
      fetchSaved();
    } catch (error) {
      console.error('Erro ao deletar:', error);
      toast.error('Erro ao remover jurisprudência');
    }
  };

  const downloadJurisprudence = (item: SavedJurisprudence) => {
    const content = `JURISPRUDÊNCIA SALVA
==================

Título: ${item.title}
Data de salvamento: ${format(new Date(item.created_at), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
Fonte: ${item.source || 'Não informada'}

---

${item.content}

${item.notes ? `\n---\nNotas:\n${item.notes}` : ''}
`;

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `jurisprudencia-${item.title.toLowerCase().replace(/\s+/g, '-').slice(0, 30)}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const loadFromHistory = (item: SearchHistory) => {
    setQuery(item.query);
    setSearchResult(item.response);
    setCurrentSearchId(item.id);
    
    // Tentar parsear o resultado do histórico
    try {
      const jsonMatch = item.response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]) as ParsedResult;
        setParsedResult(parsed);
      } else {
        setParsedResult(null);
      }
    } catch {
      setParsedResult(null);
    }
    
    // Mudar para aba de pesquisa para ver resultado
    setActiveTab('search');
  };

  const getAreaLabel = (area: string) => {
    const labels: Record<string, string> = {
      'civil': 'Civil',
      'trabalhista': 'Trabalhista',
      'penal': 'Penal',
      'tributario': 'Tributário',
      'administrativo': 'Administrativo',
      'constitucional': 'Constitucional',
      'previdenciario': 'Previdenciário',
      'consumidor': 'Consumidor',
      'ambiental': 'Ambiental',
      'empresarial': 'Empresarial',
      'familia': 'Família',
      'outro': 'Outro'
    };
    return labels[area?.toLowerCase()] || area;
  };

  // Extrair tribunais e categorias únicos das jurisprudências salvas
  const uniqueCourts = useMemo(() => {
    const courts = savedJurisprudence
      .map(j => j.court)
      .filter((c): c is string => !!c);
    return [...new Set(courts)].sort();
  }, [savedJurisprudence]);

  const uniqueCategories = useMemo(() => {
    const categories = savedJurisprudence
      .map(j => j.category)
      .filter((c): c is string => !!c);
    return [...new Set(categories)].sort();
  }, [savedJurisprudence]);

  // Filtrar jurisprudências salvas
  const filteredSavedJurisprudence = useMemo(() => {
    return savedJurisprudence.filter(item => {
      const matchesCourt = filterCourt === 'todos' || item.court === filterCourt;
      const matchesCategory = filterCategory === 'todos' || item.category === filterCategory;
      const matchesSearch = !filterSearch || 
        item.title.toLowerCase().includes(filterSearch.toLowerCase()) ||
        item.content.toLowerCase().includes(filterSearch.toLowerCase()) ||
        (item.notes && item.notes.toLowerCase().includes(filterSearch.toLowerCase()));
      return matchesCourt && matchesCategory && matchesSearch;
    });
  }, [savedJurisprudence, filterCourt, filterCategory, filterSearch]);

  const clearFilters = () => {
    setFilterCourt('todos');
    setFilterCategory('todos');
    setFilterSearch('');
  };

  const hasActiveFilters = filterCourt !== 'todos' || filterCategory !== 'todos' || filterSearch !== '';

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Pesquisa de Jurisprudência</h1>
          <p className="text-muted-foreground">
            Pesquise decisões judiciais dos tribunais brasileiros usando inteligência artificial
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList>
            <TabsTrigger value="search" className="gap-2">
              <Search className="h-4 w-4" />
              Pesquisar
            </TabsTrigger>
            <TabsTrigger value="history" className="gap-2">
              <History className="h-4 w-4" />
              Histórico ({searchHistory.length})
            </TabsTrigger>
            <TabsTrigger value="saved" className="gap-2">
              <Bookmark className="h-4 w-4" />
              Salvos ({savedJurisprudence.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="search" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Nova Pesquisa</CardTitle>
                <CardDescription>
                  Digite o tema ou termos para pesquisar jurisprudência nos tribunais brasileiros
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <Input
                    placeholder="Ex: Dano moral em atraso de voo, Rescisão contratual por inadimplemento..."
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && !isSearching && handleSearch()}
                    disabled={isSearching}
                    className="flex-1"
                  />
                  <Button onClick={handleSearch} disabled={isSearching}>
                    {isSearching ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Search className="h-4 w-4" />
                    )}
                    Pesquisar
                  </Button>
                </div>

                {isSearching && (
                  <div className="flex items-center justify-center py-8">
                    <div className="text-center space-y-2">
                      <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
                      <p className="text-muted-foreground">Pesquisando jurisprudência...</p>
                    </div>
                  </div>
                )}

                {searchResult && !isSearching && (
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <h3 className="font-semibold">Resultado da Pesquisa</h3>
                      {(!parsedResult || !parsedResult.jurisprudencias || parsedResult.jurisprudencias.length === 0) && (
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => openSaveDialog(searchResult, undefined, currentSearchId || undefined)}
                        >
                          <Save className="h-4 w-4 mr-2" />
                          Salvar Resultado
                        </Button>
                      )}
                    </div>
                    
                    {parsedResult && parsedResult.jurisprudencias && parsedResult.jurisprudencias.length > 0 ? (
                      <div className="space-y-4">
                        {parsedResult.jurisprudencias.map((juris, index) => (
                          <Card key={index} className="border-l-4 border-l-primary">
                            <CardHeader className="pb-2">
                              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="bg-primary text-primary-foreground px-2 py-1 rounded text-xs font-semibold">
                                    {juris.tribunal}
                                  </span>
                                  {juris.area_direito && (
                                    <span className="bg-muted px-2 py-1 rounded text-xs">
                                      {getAreaLabel(juris.area_direito)}
                                    </span>
                                  )}
                                  {juris.assunto && (
                                    <span className="bg-secondary text-secondary-foreground px-2 py-1 rounded text-xs">
                                      {juris.assunto}
                                    </span>
                                  )}
                                </div>
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  onClick={() => openSaveDialogFromJuris(juris, currentSearchId || undefined)}
                                  className="gap-1.5"
                                >
                                  <Bookmark className="h-3.5 w-3.5" />
                                  <span className="hidden sm:inline">Salvar</span>
                                </Button>
                              </div>
                              <CardTitle className="text-base">
                                {juris.numero_processo}
                              </CardTitle>
                              <CardDescription className="flex flex-col gap-1">
                                {juris.relator && <span>Relator: {juris.relator}</span>}
                                {juris.orgao_julgador && <span>Órgão Julgador: {juris.orgao_julgador}</span>}
                                {juris.data_julgamento && <span>Data: {juris.data_julgamento}</span>}
                              </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-3">
                              {juris.ementa && (
                                <div>
                                  <h4 className="font-semibold text-sm mb-1">Ementa Completa</h4>
                                  <div className="text-sm bg-muted/50 p-3 rounded whitespace-pre-wrap max-h-96 overflow-y-auto">
                                    {juris.ementa}
                                  </div>
                                </div>
                              )}
                              {juris.resumo && (
                                <div>
                                  <h4 className="font-semibold text-sm mb-1">Resumo</h4>
                                  <p className="text-sm text-muted-foreground">
                                    {juris.resumo}
                                  </p>
                                </div>
                              )}
                              {juris.tese_firmada && (
                                <div>
                                  <h4 className="font-semibold text-sm mb-1">Tese Firmada</h4>
                                  <p className="text-sm text-muted-foreground italic">
                                    {juris.tese_firmada}
                                  </p>
                                </div>
                              )}
                              {juris.palavras_chave && juris.palavras_chave.length > 0 && (
                                <div>
                                  <h4 className="font-semibold text-sm mb-1">Palavras-chave</h4>
                                  <div className="flex flex-wrap gap-1">
                                    {juris.palavras_chave.map((palavra, i) => (
                                      <span key={i} className="bg-muted px-2 py-0.5 rounded text-xs">
                                        {palavra}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </CardContent>
                          </Card>
                        ))}
                        
                        {parsedResult.observacoes_gerais && (
                          <div className="bg-muted/50 rounded-lg p-4">
                            <h4 className="font-semibold text-sm mb-2">Observações Gerais</h4>
                            <p className="text-sm text-muted-foreground">
                              {parsedResult.observacoes_gerais}
                            </p>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="bg-muted/50 rounded-lg p-4 whitespace-pre-wrap text-sm max-h-[600px] overflow-y-auto">
                        {searchResult}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="history" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Histórico de Pesquisas</CardTitle>
                <CardDescription>
                  Suas últimas 50 pesquisas realizadas
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loadingHistory ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                ) : searchHistory.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">
                    Nenhuma pesquisa realizada ainda
                  </p>
                ) : (
                  <div className="space-y-3">
                    {searchHistory.map((item) => (
                      <div 
                        key={item.id} 
                        className="border rounded-lg p-4 hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex justify-between items-start gap-4">
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{item.query}</p>
                            <p className="text-sm text-muted-foreground">
                              {format(new Date(item.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                            </p>
                          </div>
                          <div className="flex gap-2 shrink-0">
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => loadFromHistory(item)}
                            >
                              Ver
                            </Button>
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => openSaveDialog(item.response, item.id)}
                            >
                              <Save className="h-4 w-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => handleDeleteHistory(item.id)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="saved" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Filter className="h-5 w-5" />
                  Jurisprudências Salvas
                </CardTitle>
                <CardDescription>
                  Decisões judiciais salvas para consulta e uso em petições
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Filtros */}
                {savedJurisprudence.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex flex-wrap gap-3">
                      <div className="flex-1 min-w-[200px]">
                        <Input
                          placeholder="Buscar por título, conteúdo ou notas..."
                          value={filterSearch}
                          onChange={(e) => setFilterSearch(e.target.value)}
                          className="w-full"
                        />
                      </div>
                      <div className="w-[180px]">
                        <Select value={filterCourt} onValueChange={setFilterCourt}>
                          <SelectTrigger>
                            <SelectValue placeholder="Tribunal" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="todos">Todos os tribunais</SelectItem>
                            {uniqueCourts.map(court => (
                              <SelectItem key={court} value={court}>{court}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="w-[180px]">
                        <Select value={filterCategory} onValueChange={setFilterCategory}>
                          <SelectTrigger>
                            <SelectValue placeholder="Área do Direito" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="todos">Todas as áreas</SelectItem>
                            {uniqueCategories.map(cat => (
                              <SelectItem key={cat} value={cat}>{getAreaLabel(cat)}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      {hasActiveFilters && (
                        <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1">
                          <X className="h-4 w-4" />
                          Limpar
                        </Button>
                      )}
                    </div>
                    {hasActiveFilters && (
                      <p className="text-sm text-muted-foreground">
                        Mostrando {filteredSavedJurisprudence.length} de {savedJurisprudence.length} jurisprudências
                      </p>
                    )}
                  </div>
                )}

                {loadingSaved ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                ) : savedJurisprudence.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">
                    Nenhuma jurisprudência salva ainda
                  </p>
                ) : filteredSavedJurisprudence.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">
                    Nenhuma jurisprudência encontrada com os filtros selecionados
                  </p>
                ) : (
                  <div className="space-y-3">
                    {filteredSavedJurisprudence.map((item) => (
                      <div 
                        key={item.id} 
                        className="border rounded-lg p-4"
                      >
                        <div className="flex justify-between items-start gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2 mb-1">
                              <p className="font-medium">{item.title}</p>
                              {item.court && (
                                <span className="bg-primary text-primary-foreground px-2 py-0.5 rounded text-xs">
                                  {item.court}
                                </span>
                              )}
                              {item.category && (
                                <span className="bg-muted px-2 py-0.5 rounded text-xs">
                                  {getAreaLabel(item.category)}
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {item.source && `Fonte: ${item.source} • `}
                              {format(new Date(item.created_at), "dd/MM/yyyy", { locale: ptBR })}
                            </p>
                            {item.notes && (
                              <p className="text-sm text-muted-foreground mt-1 italic">
                                {item.notes}
                              </p>
                            )}
                          </div>
                          <div className="flex gap-2 shrink-0">
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => downloadJurisprudence(item)}
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => handleDeleteSaved(item.id)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </div>
                        <div className="mt-3 bg-muted/50 rounded p-3 text-sm max-h-40 overflow-y-auto whitespace-pre-wrap">
                          {item.content.slice(0, 500)}{item.content.length > 500 ? '...' : ''}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Dialog para salvar jurisprudência */}
        <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Salvar Jurisprudência</DialogTitle>
              <DialogDescription>
                Preencha os dados para salvar esta jurisprudência para consulta futura
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="save-title">Título *</Label>
                <Input
                  id="save-title"
                  placeholder="Ex: STJ - Dano moral em atraso de voo"
                  value={saveTitle}
                  onChange={(e) => setSaveTitle(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="save-court">Tribunal</Label>
                  <Input
                    id="save-court"
                    placeholder="Ex: STJ, TJ-SP, TRT-2"
                    value={saveCourt}
                    onChange={(e) => setSaveCourt(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="save-category">Área do Direito</Label>
                  <Select value={saveCategory} onValueChange={setSaveCategory}>
                    <SelectTrigger id="save-category">
                      <SelectValue placeholder="Selecione a área" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="civil">Civil</SelectItem>
                      <SelectItem value="trabalhista">Trabalhista</SelectItem>
                      <SelectItem value="penal">Penal</SelectItem>
                      <SelectItem value="tributario">Tributário</SelectItem>
                      <SelectItem value="administrativo">Administrativo</SelectItem>
                      <SelectItem value="constitucional">Constitucional</SelectItem>
                      <SelectItem value="previdenciario">Previdenciário</SelectItem>
                      <SelectItem value="consumidor">Consumidor</SelectItem>
                      <SelectItem value="ambiental">Ambiental</SelectItem>
                      <SelectItem value="empresarial">Empresarial</SelectItem>
                      <SelectItem value="familia">Família</SelectItem>
                      <SelectItem value="outro">Outro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="save-source">Fonte</Label>
                <Input
                  id="save-source"
                  placeholder="Ex: Pesquisa Perplexity AI"
                  value={saveSource}
                  onChange={(e) => setSaveSource(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="save-content">Conteúdo *</Label>
                <Textarea
                  id="save-content"
                  placeholder="Conteúdo da jurisprudência..."
                  value={saveContent}
                  onChange={(e) => setSaveContent(e.target.value)}
                  rows={8}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="save-notes">Notas (opcional)</Label>
                <Textarea
                  id="save-notes"
                  placeholder="Anotações pessoais sobre esta jurisprudência..."
                  value={saveNotes}
                  onChange={(e) => setSaveNotes(e.target.value)}
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setSaveDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSaveJurisprudence}>
                <Save className="h-4 w-4 mr-2" />
                Salvar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
