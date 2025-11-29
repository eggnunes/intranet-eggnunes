import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { Plus, X, Tag } from "lucide-react";

interface SuggestionTagManagerProps {
  suggestionId: string;
  isAdmin?: boolean;
}

export function SuggestionTagManager({ suggestionId, isAdmin = false }: SuggestionTagManagerProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState("#3b82f6");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

  // Buscar todas as tags disponíveis
  const { data: allTags } = useQuery({
    queryKey: ["all-tags"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("suggestion_tags")
        .select("*")
        .order("name");

      if (error) throw error;
      return data;
    },
  });

  // Buscar tags associadas a esta sugestão
  const { data: suggestionTags } = useQuery({
    queryKey: ["suggestion-tags", suggestionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("suggestion_tag_relations")
        .select(`
          id,
          tag_id,
          suggestion_tags (
            id,
            name,
            color
          )
        `)
        .eq("suggestion_id", suggestionId);

      if (error) throw error;
      return data;
    },
  });

  // Criar nova tag
  const createTagMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase
        .from("suggestion_tags")
        .insert({
          name: newTagName,
          color: newTagColor,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["all-tags"] });
      setNewTagName("");
      setNewTagColor("#3b82f6");
      setIsCreateDialogOpen(false);
      toast({
        title: "Tag criada",
        description: "A tag foi criada com sucesso",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao criar tag",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Adicionar tag à sugestão
  const addTagMutation = useMutation({
    mutationFn: async (tagId: string) => {
      const { error } = await supabase
        .from("suggestion_tag_relations")
        .insert({
          suggestion_id: suggestionId,
          tag_id: tagId,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["suggestion-tags", suggestionId] });
      queryClient.invalidateQueries({ queryKey: ["all-suggestions"] });
      toast({
        title: "Tag adicionada",
        description: "A tag foi adicionada à sugestão",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao adicionar tag",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Remover tag da sugestão
  const removeTagMutation = useMutation({
    mutationFn: async (relationId: string) => {
      const { error } = await supabase
        .from("suggestion_tag_relations")
        .delete()
        .eq("id", relationId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["suggestion-tags", suggestionId] });
      queryClient.invalidateQueries({ queryKey: ["all-suggestions"] });
      toast({
        title: "Tag removida",
        description: "A tag foi removida da sugestão",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao remover tag",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const currentTagIds = new Set(
    suggestionTags?.map((st: any) => st.suggestion_tags.id) || []
  );

  const availableTags = allTags?.filter((tag) => !currentTagIds.has(tag.id)) || [];

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {suggestionTags?.map((relation: any) => (
        <Badge
          key={relation.id}
          style={{ backgroundColor: relation.suggestion_tags.color }}
          className="gap-1"
        >
          {relation.suggestion_tags.name}
          {isAdmin && (
            <button
              onClick={() => removeTagMutation.mutate(relation.id)}
              className="ml-1 hover:bg-white/20 rounded-full p-0.5"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </Badge>
      ))}

      {isAdmin && (
        <>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-6 gap-1">
                <Plus className="h-3 w-3" />
                Tag
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-56 p-2">
              <div className="space-y-2">
                {availableTags.length > 0 ? (
                  availableTags.map((tag) => (
                    <button
                      key={tag.id}
                      onClick={() => addTagMutation.mutate(tag.id)}
                      className="w-full text-left p-2 hover:bg-muted rounded flex items-center gap-2"
                    >
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: tag.color }}
                      />
                      <span className="text-sm">{tag.name}</span>
                    </button>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-2">
                    Todas as tags já foram adicionadas
                  </p>
                )}
                <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm" className="w-full gap-2">
                      <Tag className="h-4 w-4" />
                      Criar Nova Tag
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Criar Nova Tag</DialogTitle>
                      <DialogDescription>
                        Crie uma nova tag para organizar as sugestões
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <label className="text-sm font-medium">Nome da Tag</label>
                        <Input
                          value={newTagName}
                          onChange={(e) => setNewTagName(e.target.value)}
                          placeholder="Ex: Urgente"
                          maxLength={30}
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium">Cor</label>
                        <div className="flex gap-2">
                          <Input
                            type="color"
                            value={newTagColor}
                            onChange={(e) => setNewTagColor(e.target.value)}
                            className="w-20 h-10"
                          />
                          <Input
                            value={newTagColor}
                            onChange={(e) => setNewTagColor(e.target.value)}
                            placeholder="#3b82f6"
                          />
                        </div>
                      </div>
                      <Button
                        onClick={() => createTagMutation.mutate()}
                        disabled={!newTagName.trim() || createTagMutation.isPending}
                        className="w-full"
                      >
                        {createTagMutation.isPending ? "Criando..." : "Criar Tag"}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </PopoverContent>
          </Popover>
        </>
      )}
    </div>
  );
}
