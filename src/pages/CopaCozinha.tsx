import { useState, useEffect, useCallback } from 'react';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { useAdminPermissions } from '@/hooks/useAdminPermissions';
import { supabase } from '@/integrations/supabase/client';
import { 
  Coffee, Plus, ShoppingCart, Check, RefreshCw, Sparkles, Users, 
  FileSpreadsheet, FileText, Trophy, CheckCircle2, XCircle, Clock,
  Apple, GlassWater, Cookie, Sandwich, Edit2, Trash2, Wand2, Lock
} from 'lucide-react';
import { format, startOfWeek, endOfWeek } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface FoodItem {
  id: string;
  name: string;
  normalized_name: string;
  category: string;
}

interface FoodSuggestion {
  id: string;
  food_item_id: string;
  user_id: string;
  week_start: string;
  created_at: string;
  food_items?: { id: string; name: string; normalized_name: string; category: string } | null;
  user_name?: string;
}

interface PurchaseStatus {
  id: string;
  food_item_id: string;
  week_start: string;
  status: string;
  decided_by: string | null;
  notes: string | null;
}

interface SuggestionCount {
  food_item_id: string;
  food_name: string;
  count: number;
  users: string[];
  purchase_status?: string;
}

interface AllTimeRanking {
  food_item_id: string;
  food_name: string;
  total_suggestions: number;
  category: string;
}

const CATEGORIES = [
  { value: 'bebidas', label: 'Bebidas', icon: GlassWater },
  { value: 'snacks', label: 'Snacks', icon: Cookie },
  { value: 'frutas', label: 'Frutas', icon: Apple },
  { value: 'lanches', label: 'Lanches', icon: Sandwich },
  { value: 'outros', label: 'Outros', icon: Coffee },
];

const CopaCozinha = () => {
  const [foodItems, setFoodItems] = useState<FoodItem[]>([]);
  const [suggestions, setSuggestions] = useState<FoodSuggestion[]>([]);
  const [purchaseStatuses, setPurchaseStatuses] = useState<PurchaseStatus[]>([]);
  const [allTimeRanking, setAllTimeRanking] = useState<AllTimeRanking[]>([]);
  const [newFoodName, setNewFoodName] = useState('');
  const [newFoodCategory, setNewFoodCategory] = useState('outros');
  const [isAdding, setIsAdding] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [userSuggestions, setUserSuggestions] = useState<Set<string>>(new Set());
  const [editingFood, setEditingFood] = useState<FoodItem | null>(null);
  const [editName, setEditName] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [isSuggestingCategory, setIsSuggestingCategory] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();
  const { isAdmin, loading: roleLoading } = useUserRole();
  const { canView, loading: permLoading } = useAdminPermissions();

  const hasCopaCozinhaAccess = canView('copa_cozinha');

  const currentWeekStart = format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd');
  const weekEnd = endOfWeek(new Date(), { weekStartsOn: 1 });
  const weekLabel = `${format(startOfWeek(new Date(), { weekStartsOn: 1 }), "dd/MM", { locale: ptBR })} - ${format(weekEnd, "dd/MM", { locale: ptBR })}`;

  // AI category suggestion with debounce
  const suggestCategory = useCallback(async (foodName: string) => {
    if (foodName.trim().length < 3) return;
    
    setIsSuggestingCategory(true);
    try {
      const { data, error } = await supabase.functions.invoke('suggest-food-category', {
        body: { foodName: foodName.trim() }
      });

      if (error) throw error;
      
      if (data?.category) {
        const categoryMap: Record<string, string> = {
          'Bebidas': 'bebidas',
          'Snacks': 'snacks',
          'Frutas': 'frutas',
          'Lanches': 'lanches',
          'Outros': 'outros',
        };
        const normalizedCategory = categoryMap[data.category] || 'outros';
        setNewFoodCategory(normalizedCategory);
      }
    } catch (error) {
      console.error('Error suggesting category:', error);
    } finally {
      setIsSuggestingCategory(false);
    }
  }, []);

  // Debounced food name change handler
  useEffect(() => {
    const timer = setTimeout(() => {
      if (newFoodName.trim().length >= 3) {
        suggestCategory(newFoodName);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [newFoodName, suggestCategory]);

  useEffect(() => {
    fetchFoodItems();
    fetchSuggestions();
    fetchPurchaseStatuses();
    fetchAllTimeRanking();
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
        food_items (id, name, normalized_name, category)
      `)
      .eq('week_start', currentWeekStart);

    if (error) {
      console.error('Error fetching suggestions:', error);
      return;
    }

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
    
    const userSuggestedItems = new Set(
      suggestionsWithNames
        .filter((s) => s.user_id === user?.id)
        .map((s) => s.food_item_id)
    );
    setUserSuggestions(userSuggestedItems);
  };

  const fetchPurchaseStatuses = async () => {
    const { data, error } = await supabase
      .from('food_purchase_status')
      .select('*')
      .eq('week_start', currentWeekStart);

    if (error) {
      console.error('Error fetching purchase statuses:', error);
      return;
    }

    setPurchaseStatuses(data || []);
  };

  const fetchAllTimeRanking = async () => {
    const { data, error } = await supabase
      .from('food_suggestions')
      .select(`
        food_item_id,
        food_items (id, name, category)
      `);

    if (error) {
      console.error('Error fetching all time ranking:', error);
      return;
    }

    const counts: Record<string, AllTimeRanking> = {};
    (data || []).forEach((s: any) => {
      const foodId = s.food_item_id;
      const foodName = s.food_items?.name || 'Desconhecido';
      const category = s.food_items?.category || 'outros';

      if (!counts[foodId]) {
        counts[foodId] = {
          food_item_id: foodId,
          food_name: foodName,
          total_suggestions: 0,
          category: category,
        };
      }
      counts[foodId].total_suggestions++;
    });

    const ranking = Object.values(counts).sort((a, b) => b.total_suggestions - a.total_suggestions);
    setAllTimeRanking(ranking);
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
          category: newFoodCategory,
        })
        .select()
        .single();

      if (error) throw error;

      toast({
        title: 'Alimento cadastrado',
        description: `"${trimmedName}" foi adicionado à lista.`,
      });

      setNewFoodName('');
      setNewFoodCategory('outros');
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
      fetchAllTimeRanking();
    } catch (error: any) {
      console.error('Error toggling suggestion:', error);
      toast({
        title: 'Erro',
        description: error.message || 'Não foi possível processar sua sugestão.',
        variant: 'destructive',
      });
    }
  };

  const handleUpdatePurchaseStatus = async (foodItemId: string, status: string) => {
    try {
      const existingStatus = purchaseStatuses.find(
        ps => ps.food_item_id === foodItemId && ps.week_start === currentWeekStart
      );

      if (existingStatus) {
        const { error } = await supabase
          .from('food_purchase_status')
          .update({
            status,
            decided_by: user?.id,
            decided_at: new Date().toISOString(),
          })
          .eq('id', existingStatus.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('food_purchase_status')
          .insert({
            food_item_id: foodItemId,
            week_start: currentWeekStart,
            status,
            decided_by: user?.id,
            decided_at: new Date().toISOString(),
          });

        if (error) throw error;
      }

      toast({
        title: 'Status atualizado',
        description: `Status de compra atualizado para "${status === 'accepted' ? 'Aprovado' : status === 'rejected' ? 'Rejeitado' : 'Pendente'}".`,
      });

      fetchPurchaseStatuses();
    } catch (error: any) {
      console.error('Error updating purchase status:', error);
      toast({
        title: 'Erro',
        description: error.message || 'Não foi possível atualizar o status.',
        variant: 'destructive',
      });
    }
  };

  const handleEditFood = async () => {
    if (!editingFood || !editName.trim()) return;

    try {
      const { error } = await supabase
        .from('food_items')
        .update({
          name: editName.trim(),
          normalized_name: normalizeText(editName.trim()),
          category: editCategory,
        })
        .eq('id', editingFood.id);

      if (error) throw error;

      toast({
        title: 'Alimento atualizado',
        description: `"${editName.trim()}" foi atualizado.`,
      });

      setEditingFood(null);
      fetchFoodItems();
      fetchAllTimeRanking();
    } catch (error: any) {
      console.error('Error updating food:', error);
      toast({
        title: 'Erro',
        description: error.message || 'Não foi possível atualizar.',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteFood = async (foodItem: FoodItem) => {
    if (!confirm(`Tem certeza que deseja excluir "${foodItem.name}"?`)) return;

    try {
      const { error } = await supabase
        .from('food_items')
        .delete()
        .eq('id', foodItem.id);

      if (error) throw error;

      toast({
        title: 'Alimento excluído',
        description: `"${foodItem.name}" foi removido.`,
      });

      fetchFoodItems();
      fetchSuggestions();
      fetchAllTimeRanking();
    } catch (error: any) {
      console.error('Error deleting food:', error);
      toast({
        title: 'Erro',
        description: error.message || 'Não foi possível excluir.',
        variant: 'destructive',
      });
    }
  };

  const getSuggestionCounts = (): SuggestionCount[] => {
    const counts: Record<string, SuggestionCount> = {};

    suggestions.forEach(suggestion => {
      const foodId = suggestion.food_item_id;
      const foodName = suggestion.food_items?.name || 'Desconhecido';
      const userName = suggestion.user_name || 'Usuário';

      if (!counts[foodId]) {
        const purchaseStatus = purchaseStatuses.find(
          ps => ps.food_item_id === foodId && ps.week_start === currentWeekStart
        );
        counts[foodId] = {
          food_item_id: foodId,
          food_name: foodName,
          count: 0,
          users: [],
          purchase_status: purchaseStatus?.status || 'pending',
        };
      }
      counts[foodId].count++;
      counts[foodId].users.push(userName);
    });

    return Object.values(counts).sort((a, b) => b.count - a.count);
  };

  const exportToExcel = () => {
    const data = suggestionCounts.map(item => ({
      'Alimento': item.food_name,
      'Votos': item.count,
      'Status': item.purchase_status === 'accepted' ? 'Aprovado' : item.purchase_status === 'rejected' ? 'Rejeitado' : 'Pendente',
      'Solicitantes': item.users.join(', ')
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Sugestões Copa');
    
    ws['!cols'] = [
      { wch: 30 },
      { wch: 10 },
      { wch: 12 },
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
    
    doc.setFontSize(18);
    doc.text('Lista de Compras - Copa/Cozinha', 14, 22);
    
    doc.setFontSize(12);
    doc.text(`Semana: ${weekLabel}`, 14, 32);
    doc.text(`Gerado em: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`, 14, 40);

    const tableData = suggestionCounts.map(item => [
      item.food_name,
      item.count.toString(),
      item.purchase_status === 'accepted' ? 'Aprovado' : item.purchase_status === 'rejected' ? 'Rejeitado' : 'Pendente',
      item.users.join(', ')
    ]);

    autoTable(doc, {
      head: [['Alimento', 'Votos', 'Status', 'Solicitantes']],
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

  const getCategoryIcon = (category: string) => {
    const cat = CATEGORIES.find(c => c.value === category);
    return cat?.icon || Coffee;
  };

  const filteredFoodItems = foodItems.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || item.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const suggestionCounts = getSuggestionCounts();

  const getPurchaseStatusBadge = (status: string) => {
    switch (status) {
      case 'accepted':
        return <Badge className="bg-green-500 text-white"><CheckCircle2 className="h-3 w-3 mr-1" />Aprovado</Badge>;
      case 'rejected':
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Rejeitado</Badge>;
      default:
        return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Pendente</Badge>;
    }
  };

  if (roleLoading || permLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[400px]">
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      </Layout>
    );
  }

  if (!hasCopaCozinhaAccess) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
          <Lock className="h-16 w-16 text-muted-foreground" />
          <h2 className="text-xl font-semibold">Acesso Restrito</h2>
          <p className="text-muted-foreground text-center max-w-md">
            Você não tem permissão para acessar a Copa/Cozinha.
          </p>
        </div>
      </Layout>
    );
  }

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

        <Tabs defaultValue="suggestions" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="suggestions">Sugestões da Semana</TabsTrigger>
            <TabsTrigger value="ranking" className="flex items-center gap-2">
              <Trophy className="h-4 w-4" />
              Ranking Geral
            </TabsTrigger>
          </TabsList>

          <TabsContent value="suggestions" className="space-y-6">
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
                  <div className="space-y-2">
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
                    <div className="flex gap-2 items-center">
                      <Select value={newFoodCategory} onValueChange={setNewFoodCategory}>
                        <SelectTrigger className="flex-1">
                          <SelectValue placeholder="Categoria" />
                        </SelectTrigger>
                        <SelectContent>
                          {CATEGORIES.map(cat => (
                            <SelectItem key={cat.value} value={cat.value}>
                              <div className="flex items-center gap-2">
                                <cat.icon className="h-4 w-4" />
                                {cat.label}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {isSuggestingCategory && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Wand2 className="h-3 w-3 animate-pulse" />
                          <span>IA sugerindo...</span>
                        </div>
                      )}
                    </div>
                    {newFoodName.trim().length >= 3 && !isSuggestingCategory && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Wand2 className="h-3 w-3" />
                        Categoria sugerida pela IA (você pode alterar)
                      </p>
                    )}
                  </div>

                  {/* Filtros */}
                  <div className="flex gap-2">
                    <Input
                      placeholder="Buscar alimento..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="flex-1"
                    />
                    <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                      <SelectTrigger className="w-[140px]">
                        <SelectValue placeholder="Categoria" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todas</SelectItem>
                        {CATEGORIES.map(cat => (
                          <SelectItem key={cat.value} value={cat.value}>
                            {cat.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Lista de alimentos */}
                  <div className="max-h-96 overflow-y-auto space-y-2">
                    {filteredFoodItems.length === 0 ? (
                      <p className="text-center text-muted-foreground py-4">
                        Nenhum alimento encontrado.
                      </p>
                    ) : (
                      filteredFoodItems.map((item) => {
                        const isSuggested = userSuggestions.has(item.id);
                        const CategoryIcon = getCategoryIcon(item.category);
                        
                        if (editingFood?.id === item.id) {
                          return (
                            <div key={item.id} className="p-3 rounded-lg border bg-muted/50 space-y-2">
                              <Input
                                value={editName}
                                onChange={(e) => setEditName(e.target.value)}
                                placeholder="Nome do alimento"
                              />
                              <Select value={editCategory} onValueChange={setEditCategory}>
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {CATEGORIES.map(cat => (
                                    <SelectItem key={cat.value} value={cat.value}>
                                      {cat.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <div className="flex gap-2">
                                <Button size="sm" onClick={handleEditFood}>Salvar</Button>
                                <Button size="sm" variant="outline" onClick={() => setEditingFood(null)}>Cancelar</Button>
                              </div>
                            </div>
                          );
                        }
                        
                        return (
                          <div
                            key={item.id}
                            className={`flex items-center justify-between p-3 rounded-lg border transition-all ${
                              isSuggested
                                ? 'bg-primary/10 border-primary'
                                : 'bg-card border-border hover:border-primary/50 hover:bg-muted/50'
                            }`}
                          >
                            <button
                              onClick={() => handleToggleSuggestion(item)}
                              className="flex items-center gap-2 flex-1 text-left"
                            >
                              <CategoryIcon className="h-4 w-4 text-muted-foreground" />
                              <span className={`font-medium ${isSuggested ? 'text-primary' : 'text-foreground'}`}>
                                {item.name}
                              </span>
                              <Badge variant="outline" className="text-xs">
                                {CATEGORIES.find(c => c.value === item.category)?.label || 'Outros'}
                              </Badge>
                              {isSuggested && <Check className="h-4 w-4 text-primary ml-auto" />}
                            </button>
                            {isAdmin && (
                              <div className="flex gap-1 ml-2">
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-8 w-8"
                                  onClick={() => {
                                    setEditingFood(item);
                                    setEditName(item.name);
                                    setEditCategory(item.category);
                                  }}
                                >
                                  <Edit2 className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-8 w-8 text-destructive"
                                  onClick={() => handleDeleteFood(item)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            )}
                          </div>
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
                          className="p-3 rounded-lg bg-muted/50 border border-border"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <p className="font-medium text-foreground">{item.food_name}</p>
                            <div className="flex items-center gap-2">
                              {getPurchaseStatusBadge(item.purchase_status || 'pending')}
                              <Badge 
                                variant={item.count >= 3 ? 'default' : 'secondary'}
                              >
                                {item.count} {item.count === 1 ? 'voto' : 'votos'}
                              </Badge>
                            </div>
                          </div>
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <Users className="h-3 w-3" />
                            {item.users.join(', ')}
                          </p>
                          {isAdmin && (
                            <div className="flex gap-2 mt-3 pt-3 border-t border-border">
                              <Button
                                size="sm"
                                variant={item.purchase_status === 'accepted' ? 'default' : 'outline'}
                                className={item.purchase_status === 'accepted' ? 'bg-green-500 hover:bg-green-600' : ''}
                                onClick={() => handleUpdatePurchaseStatus(item.food_item_id, 'accepted')}
                              >
                                <CheckCircle2 className="h-4 w-4 mr-1" />
                                Aprovar
                              </Button>
                              <Button
                                size="sm"
                                variant={item.purchase_status === 'rejected' ? 'destructive' : 'outline'}
                                onClick={() => handleUpdatePurchaseStatus(item.food_item_id, 'rejected')}
                              >
                                <XCircle className="h-4 w-4 mr-1" />
                                Rejeitar
                              </Button>
                              {item.purchase_status !== 'pending' && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleUpdatePurchaseStatus(item.food_item_id, 'pending')}
                                >
                                  Resetar
                                </Button>
                              )}
                            </div>
                          )}
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
          </TabsContent>

          <TabsContent value="ranking" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Trophy className="h-5 w-5 text-yellow-500" />
                  Ranking de Popularidade
                </CardTitle>
                <CardDescription>
                  Alimentos mais sugeridos ao longo do tempo
                </CardDescription>
              </CardHeader>
              <CardContent>
                {allTimeRanking.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Trophy className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Nenhuma sugestão registrada ainda.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {allTimeRanking.slice(0, 20).map((item, index) => {
                      const CategoryIcon = getCategoryIcon(item.category);
                      return (
                        <div
                          key={item.food_item_id}
                          className={`flex items-center justify-between p-3 rounded-lg border ${
                            index === 0 ? 'bg-yellow-500/10 border-yellow-500/30' :
                            index === 1 ? 'bg-gray-300/10 border-gray-400/30' :
                            index === 2 ? 'bg-amber-600/10 border-amber-600/30' :
                            'bg-muted/50 border-border'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <span className={`font-bold text-lg w-8 ${
                              index === 0 ? 'text-yellow-500' :
                              index === 1 ? 'text-gray-400' :
                              index === 2 ? 'text-amber-600' :
                              'text-muted-foreground'
                            }`}>
                              #{index + 1}
                            </span>
                            <CategoryIcon className="h-5 w-5 text-muted-foreground" />
                            <div>
                              <p className="font-medium text-foreground">{item.food_name}</p>
                              <Badge variant="outline" className="text-xs mt-1">
                                {CATEGORIES.find(c => c.value === item.category)?.label || 'Outros'}
                              </Badge>
                            </div>
                          </div>
                          <Badge variant="default" className="text-sm">
                            {item.total_suggestions} {item.total_suggestions === 1 ? 'sugestão' : 'sugestões'}
                          </Badge>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

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
                  <li>• A auxiliar administrativo verá os alimentos mais votados e verificará a possibilidade de compra</li>
                  <li className="text-xs italic mt-2">* As sugestões servem como referência para a equipe administrativa. A compra dos itens depende da disponibilidade e aprovação do setor responsável.</li>
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
