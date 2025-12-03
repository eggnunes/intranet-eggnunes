import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { Lightbulb, Plus, X, Search, Loader2 } from "lucide-react";

interface TaskRule {
  id: string;
  name: string;
  trigger_type: string;
  trigger_value: string;
  task_type_id: number;
  task_title_template: string;
  task_description_template: string | null;
  days_to_deadline: number;
  responsible_user_id: string | null;
}

interface Item {
  id: string | number;
  title: string;
  type?: string;
  process_number?: string;
  lawsuit_id?: number;
}

interface Suggestion {
  rule: TaskRule;
  item: Item;
  suggestedTitle: string;
}

interface TaskSuggestionsPanelProps {
  items: Item[];
  onCreateTask: (suggestion: Suggestion) => void;
  className?: string;
}

export function TaskSuggestionsPanel({ items, onCreateTask, className }: TaskSuggestionsPanelProps) {
  const [rules, setRules] = useState<TaskRule[]>([]);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [dismissedSuggestions, setDismissedSuggestions] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchRules();
  }, []);

  const fetchRules = async () => {
    try {
      const { data, error } = await supabase
        .from('task_auto_rules')
        .select('*')
        .eq('is_active', true);

      if (error) throw error;
      setRules(data || []);
    } catch (error) {
      console.error('Error fetching rules:', error);
    }
  };

  const checkPatterns = () => {
    setLoading(true);
    const newSuggestions: Suggestion[] = [];

    for (const item of items) {
      for (const rule of rules) {
        let matches = false;
        
        if (rule.trigger_type === 'keyword') {
          const keywords = rule.trigger_value.toLowerCase().split(',').map(k => k.trim());
          matches = keywords.some(kw => item.title?.toLowerCase().includes(kw));
        } else if (rule.trigger_type === 'movement_type' || rule.trigger_type === 'publication_type') {
          matches = item.type?.toLowerCase() === rule.trigger_value.toLowerCase() ||
                    item.title?.toLowerCase().includes(rule.trigger_value.toLowerCase());
        }

        if (matches) {
          const suggestionKey = `${rule.id}-${item.id}`;
          if (!dismissedSuggestions.has(suggestionKey)) {
            const suggestedTitle = rule.task_title_template
              .replace('{processo}', item.process_number || 'N/A')
              .replace('{titulo}', item.title || '');
            
            newSuggestions.push({
              rule,
              item,
              suggestedTitle,
            });
          }
        }
      }
    }

    setSuggestions(newSuggestions);
    setIsOpen(true);
    setLoading(false);

    if (newSuggestions.length === 0) {
      toast.info('Nenhum padrão encontrado nas movimentações atuais.');
    } else {
      toast.success(`${newSuggestions.length} sugestão(ões) encontrada(s)!`);
    }
  };

  const dismissSuggestion = (suggestion: Suggestion) => {
    const key = `${suggestion.rule.id}-${suggestion.item.id}`;
    setDismissedSuggestions(prev => new Set([...prev, key]));
    setSuggestions(prev => prev.filter(s => `${s.rule.id}-${s.item.id}` !== key));
  };

  const handleCreateTask = (suggestion: Suggestion) => {
    onCreateTask(suggestion);
    dismissSuggestion(suggestion);
  };

  if (rules.length === 0) {
    return null; // Não mostra nada se não houver regras configuradas
  }

  return (
    <div className={className}>
      <Button
        variant="outline"
        onClick={checkPatterns}
        disabled={loading || items.length === 0}
        className="gap-2"
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Search className="h-4 w-4" />
        )}
        Verificar Padrões
        {suggestions.length > 0 && (
          <Badge variant="secondary" className="ml-1">
            {suggestions.length}
          </Badge>
        )}
      </Button>

      {isOpen && suggestions.length > 0 && (
        <Card className="mt-4">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Lightbulb className="h-5 w-5 text-yellow-500" />
                <CardTitle className="text-lg">Sugestões de Tarefas</CardTitle>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setIsOpen(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <CardDescription>
              Tarefas sugeridas com base nas regras configuradas
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="max-h-[400px]">
              <div className="space-y-3">
                {suggestions.map((suggestion, index) => (
                  <div
                    key={`${suggestion.rule.id}-${suggestion.item.id}-${index}`}
                    className="flex items-start justify-between p-3 rounded-lg border bg-muted/30"
                  >
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          {suggestion.rule.name}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          Prazo: {suggestion.rule.days_to_deadline} dias
                        </span>
                      </div>
                      <p className="font-medium text-sm">{suggestion.suggestedTitle}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {suggestion.item.title} • {suggestion.item.process_number || 'Sem processo'}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 ml-2">
                      <Button
                        size="sm"
                        variant="default"
                        onClick={() => handleCreateTask(suggestion)}
                        className="gap-1"
                      >
                        <Plus className="h-3 w-3" />
                        Criar
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => dismissSuggestion(suggestion)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
