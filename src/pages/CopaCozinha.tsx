import { useState, useEffect } from 'react';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { supabase } from '@/integrations/supabase/client';
import { Coffee, Plus, ShoppingCart, Check, RefreshCw, Sparkles, Users, Download, FileSpreadsheet, FileText } from 'lucide-react';
import { format, startOfWeek, endOfWeek } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface FoodItem {
  id: string;
  name: string;
  normalized_name: string;
}

interface FoodSuggestion {
  id: string;
  food_item_id: string;
  user_id: string;
  week_start: string;
  created_at: string;
  food_items?: { id: string; name: string; normalized_name: string } | null;
  user_name?: string;
}

interface SuggestionCount {
  food_item_id: string;
  food_name: string;
  count: number;
  users: string[];
}

const CopaCozinha = () => {
  const [foodItems, setFoodItems] = useState<FoodItem[]>([]);
  const [suggestions, setSuggestions] = useState<FoodSuggestion[]>([]);
  const [newFoodName, setNewFoodName] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [userSuggestions, setUserSuggestions] = useState<Set<string>>(new Set());
  const { toast } = useToast();
  const { user } = useAuth();
  const { isAdmin } = useUserRole();

  // Calcular início da semana atual (segunda-feira)
  const currentWeekStart = format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd');
  const weekEnd = endOfWeek(new Date(), { weekStartsOn: 1 });
  const weekLabel = `${format(startOfWeek(new Date(), { weekStartsOn: 1 }), "dd/MM", { locale: ptBR })} - ${format(weekEnd, "dd/MM", { locale: ptBR })}`;

  useEffect(() => {
    fetchFoodItems();
    fetchSuggestions();
  }, []);

  const fetchFoodItems = async () => {
    const { data, error } = await supabase
      .from('food_items')
      .select('*')
      .order('name');

    if (error) {
      console.error('Error fetching food items:', error);
      return;
    }

    setFoodItems(data || []);
  };

  const fetchSuggestions = async () => {
    const { data, error } = await supabase
      .from('food_suggestions')
      .select(`
        *,
        food_items (id, name, normalized_name)
      `)
      .eq('week_start', currentWeekStart);

    if (error) {
      console.error('Error fetching suggestions:', error);
      return;
    }

    // Buscar nomes dos usuários
    const userIds = [...new Set((data || []).map(s => s.user_id))];
    let userNames: Record<string, string> = {};
    
    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', userIds);
      
      profiles?.forEach(p => {
        userNames[p.id] = p.full_name;
      });
    }

    const suggestionsWithNames = (data || []).map(s => ({
      ...s,
      user_name: userNames[s.user_id] || 'Usuário'
    }));

    setSuggestions(suggestionsWithNames);
    
    // Marcar sugestões do usuário atual
    const userSuggestedItems = new Set(
      suggestionsWithNames
        .filter((s) => s.user_id === user?.id)
        .map((s) => s.food_item_id)
    );
    setUserSuggestions(userSuggestedItems);
  };

  const normalizeText = (text: string): string => {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s]/g, '')
      .trim();
  };

  const checkDuplicate = (name: string): FoodItem | undefined => {
    const normalized = normalizeText(name);
    return foodItems.find(item => item.normalized_name === normalized);
  };

  const handleAddFood = async () => {
    if (!newFoodName.trim()) {
      toast({
        title: 'Nome inválido',
        description: 'Digite o nome do alimento.',
        variant: 'destructive',
      });
      return;
    }

    const trimmedName = newFoodName.trim();
    const duplicate = checkDuplicate(trimmedName);

    if (duplicate) {
      toast({
        title: 'Alimento já existe',
        description: `"${duplicate.name}" já está cadastrado. Clique nele para sugerir.`,
        variant: 'destructive',
      });
      return;
    }

    setIsAdding(true);

    try {
      const { data, error } = await supabase
        .from('food_items')
        .insert({
          name: trimmedName,
          normalized_name: normalizeText(trimmedName),
          created_by: user?.id,
        })
        .select()
        .single();

      if (error) throw error;

      toast({
        title: 'Alimento cadastrado',
        description: `"${trimmedName}" foi adicionado à lista.`,
      });

      setNewFoodName('');
      fetchFoodItems();
    } catch (error: any) {
      console.error('Error adding food:', error);
      toast({
        title: 'Erro ao cadastrar',
        description: error.message || 'Não foi possível adicionar o alimento.',
        variant: 'destructive',
      });
    } finally {
      setIsAdding(false);
    }
  };

  const handleToggleSuggestion = async (foodItem: FoodItem) => {
    if (!user) return;

    const isAlreadySuggested = userSuggestions.has(foodItem.id);

    try {
      if (isAlreadySuggested) {
        // Remover sugestão
        const { error } = await supabase
          .from('food_suggestions')
          .delete()
          .eq('food_item_id', foodItem.id)
          .eq('user_id', user.id)
          .eq('week_start', currentWeekStart);

        if (error) throw error;

        setUserSuggestions(prev => {
          const newSet = new Set(prev);
          newSet.delete(foodItem.id);
          return newSet;
        });

        toast({
          title: 'Sugestão removida',
          description: `"${foodItem.name}" foi removido das suas sugestões.`,
        });
      } else {
        // Adicionar sugestão
        const { error } = await supabase
          .from('food_suggestions')
          .insert({
            food_item_id: foodItem.id,
            user_id: user.id,
            week_start: currentWeekStart,
          });

        if (error) throw error;

        setUserSuggestions(prev => new Set([...prev, foodItem.id]));

        toast({
          title: 'Sugestão adicionada',
          description: `"${foodItem.name}" foi sugerido para compra.`,
        });
      }

      fetchSuggestions();
    } catch (error: any) {
      console.error('Error toggling suggestion:', error);
      toast({
        title: 'Erro',
        description: error.message || 'Não foi possível processar sua sugestão.',
        variant: 'destructive',
      });
    }
  };

  // Agrupar sugestões por alimento com contagem
  const getSuggestionCounts = (): SuggestionCount[] => {
    const counts: Record<string, SuggestionCount> = {};

    suggestions.forEach(suggestion => {
      const foodId = suggestion.food_item_id;
      const foodName = suggestion.food_items?.name || 'Desconhecido';
      const userName = suggestion.user_name || 'Usuário';

      if (!counts[foodId]) {
        counts[foodId] = {
          food_item_id: foodId,
          food_name: foodName,
          count: 0,
          users: [],
        };
      }
      counts[foodId].count++;
      counts[foodId].users.push(userName);
    });

    return Object.values(counts).sort((a, b) => b.count - a.count);
  };

  // Funções de exportação
  const exportToExcel = () => {
    const data = suggestionCounts.map(item => ({
      'Alimento': item.food_name,
      'Votos': item.count,
      'Solicitantes': item.users.join(', ')
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Sugestões Copa');
    
    // Ajustar largura das colunas
    ws['!cols'] = [
      { wch: 30 },
      { wch: 10 },
      { wch: 50 }
    ];

    XLSX.writeFile(wb, `sugestoes-copa-${weekLabel.replace(/\//g, '-')}.xlsx`);
    
    toast({
      title: 'Exportado com sucesso',
      description: 'Lista de sugestões exportada para Excel.',
    });
  };

  const exportToPDF = () => {
    const doc = new jsPDF();
    
    // Título
    doc.setFontSize(18);
    doc.text('Lista de Compras - Copa/Cozinha', 14, 22);
    
    // Período
    doc.setFontSize(12);
    doc.text(`Semana: ${weekLabel}`, 14, 32);
    doc.text(`Gerado em: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`, 14, 40);

    // Tabela
    const tableData = suggestionCounts.map(item => [
      item.food_name,
      item.count.toString(),
      item.users.join(', ')
    ]);

    autoTable(doc, {
      head: [['Alimento', 'Votos', 'Solicitantes']],
      body: tableData,
      startY: 50,
      styles: { fontSize: 10 },
      headStyles: { fillColor: [59, 130, 246] },
    });

    doc.save(`sugestoes-copa-${weekLabel.replace(/\//g, '-')}.pdf`);
    
    toast({
      title: 'Exportado com sucesso',
      description: 'Lista de sugestões exportada para PDF.',
    });
  };

  const filteredFoodItems = foodItems.filter(item =>
    item.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const suggestionCounts = getSuggestionCounts();

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
            <Coffee className="h-8 w-8 text-primary" />
            Copa / Cozinha
          </h1>
          <p className="text-muted-foreground mt-2">
            Sugira alimentos para compra da copa do escritório
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Cadastro e Seleção de Alimentos */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Plus className="h-5 w-5" />
                Alimentos Disponíveis
              </CardTitle>
              <CardDescription>
                Cadastre novos alimentos ou clique nos existentes para sugerir
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Formulário de cadastro */}
              <div className="flex gap-2">
                <Input
                  placeholder="Nome do alimento..."
                  value={newFoodName}
                  onChange={(e) => setNewFoodName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddFood()}
                  className="flex-1"
                />
                <Button onClick={handleAddFood} disabled={isAdding}>
                  {isAdding ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="h-4 w-4" />
                  )}
                </Button>
              </div>

              {/* Busca */}
              <Input
                placeholder="Buscar alimento..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />

              {/* Lista de alimentos */}
              <div className="max-h-96 overflow-y-auto space-y-2">
                {filteredFoodItems.length === 0 ? (
                  <p className="text-center text-muted-foreground py-4">
                    Nenhum alimento cadastrado ainda. Seja o primeiro!
                  </p>
                ) : (
                  filteredFoodItems.map((item) => {
                    const isSuggested = userSuggestions.has(item.id);
                    return (
                      <button
                        key={item.id}
                        onClick={() => handleToggleSuggestion(item)}
                        className={`w-full flex items-center justify-between p-3 rounded-lg border transition-all ${
                          isSuggested
                            ? 'bg-primary/10 border-primary text-primary'
                            : 'bg-card border-border hover:border-primary/50 hover:bg-muted/50'
                        }`}
                      >
                        <span className="font-medium">{item.name}</span>
                        {isSuggested && <Check className="h-5 w-5" />}
                      </button>
                    );
                  })
                )}
              </div>
            </CardContent>
          </Card>

          {/* Quadro de Sugestões da Semana */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <ShoppingCart className="h-5 w-5" />
                    Sugestões da Semana
                  </CardTitle>
                  <CardDescription className="flex items-center gap-2 mt-2">
                    <Badge variant="outline" className="font-normal">
                      {weekLabel}
                    </Badge>
                    <span>• Renova toda segunda-feira</span>
                  </CardDescription>
                </div>
                {isAdmin && suggestionCounts.length > 0 && (
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={exportToExcel}>
                      <FileSpreadsheet className="h-4 w-4 mr-1" />
                      Excel
                    </Button>
                    <Button variant="outline" size="sm" onClick={exportToPDF}>
                      <FileText className="h-4 w-4 mr-1" />
                      PDF
                    </Button>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {suggestionCounts.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Sparkles className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Nenhuma sugestão ainda esta semana.</p>
                  <p className="text-sm mt-2">
                    Clique em um alimento ao lado para sugerir!
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {suggestionCounts.map((item) => (
                    <div
                      key={item.food_item_id}
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border border-border"
                    >
                      <div className="flex-1">
                        <p className="font-medium text-foreground">{item.food_name}</p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                          <Users className="h-3 w-3" />
                          {item.users.join(', ')}
                        </p>
                      </div>
                      <Badge 
                        variant={item.count >= 3 ? 'default' : 'secondary'}
                        className="ml-2"
                      >
                        {item.count} {item.count === 1 ? 'voto' : 'votos'}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}

              {suggestionCounts.length > 0 && (
                <div className="mt-4 pt-4 border-t border-border">
                  <p className="text-sm text-muted-foreground">
                    <strong>{suggestionCounts.length}</strong> alimentos sugeridos por{' '}
                    <strong>{new Set(suggestions.map(s => s.user_id)).size}</strong> pessoas
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Informações */}
        <Card className="bg-muted/30">
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <div className="p-2 rounded-full bg-primary/10">
                <Sparkles className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">Como funciona?</h3>
                <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                  <li>• Cadastre novos alimentos que você gostaria de ver na copa</li>
                  <li>• Clique nos alimentos existentes para votar/sugerir sua compra</li>
                  <li>• As sugestões são renovadas toda segunda-feira</li>
                  <li>• A auxiliar administrativa verá os alimentos mais votados para compra</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default CopaCozinha;
