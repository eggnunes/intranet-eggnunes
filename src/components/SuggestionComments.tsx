import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Send, Trash2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Comment {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
  profiles?: {
    full_name: string;
    email: string;
  };
}

interface SuggestionCommentsProps {
  suggestionId: string;
  isAdmin?: boolean;
}

export function SuggestionComments({ suggestionId, isAdmin = false }: SuggestionCommentsProps) {
  const [newComment, setNewComment] = useState("");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  useEffect(() => {
    const fetchCurrentUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUserId(user?.id || null);
    };
    fetchCurrentUser();
  }, []);

  const { data: comments, isLoading } = useQuery({
    queryKey: ["suggestion-comments", suggestionId],
    queryFn: async () => {
      const { data: commentsData, error } = await supabase
        .from("suggestion_comments")
        .select("*")
        .eq("suggestion_id", suggestionId)
        .order("created_at", { ascending: true });

      if (error) throw error;

      // Buscar perfis dos usuários
      const userIds = [...new Set(commentsData.map((c) => c.user_id))];
      const { data: profilesData } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", userIds);

      const profilesMap = new Map(profilesData?.map((p) => [p.id, p]) || []);

      return commentsData.map((comment) => ({
        ...comment,
        profiles: profilesMap.get(comment.user_id) || {
          full_name: "Desconhecido",
          email: "",
        },
      }));
    },
  });

  const addCommentMutation = useMutation({
    mutationFn: async (content: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const { error } = await supabase.from("suggestion_comments").insert({
        suggestion_id: suggestionId,
        user_id: user.id,
        content,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["suggestion-comments", suggestionId] });
      setNewComment("");
      toast({
        title: "Comentário adicionado",
        description: "Seu comentário foi publicado com sucesso",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao adicionar comentário",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteCommentMutation = useMutation({
    mutationFn: async (commentId: string) => {
      const { error } = await supabase
        .from("suggestion_comments")
        .delete()
        .eq("id", commentId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["suggestion-comments", suggestionId] });
      toast({
        title: "Comentário removido",
        description: "O comentário foi removido com sucesso",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao remover comentário",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmitComment = () => {
    if (!newComment.trim()) return;
    addCommentMutation.mutate(newComment.trim());
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-4">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Lista de comentários */}
      <div className="space-y-3">
        {comments && comments.length > 0 ? (
          comments.map((comment: Comment) => (
            <div
              key={comment.id}
              className="flex gap-3 p-3 rounded-lg bg-muted/50"
            >
              <Avatar className="h-8 w-8">
                <AvatarFallback className="text-xs">
                  {getInitials(comment.profiles?.full_name || "?")}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 space-y-1">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">
                      {comment.profiles?.full_name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(comment.created_at), {
                        addSuffix: true,
                        locale: ptBR,
                      })}
                    </p>
                  </div>
                  {(isAdmin || comment.user_id === currentUserId) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteCommentMutation.mutate(comment.id)}
                      disabled={deleteCommentMutation.isPending}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </div>
                <p className="text-sm">{comment.content}</p>
              </div>
            </div>
          ))
        ) : (
          <p className="text-sm text-muted-foreground text-center py-4">
            Nenhum comentário ainda. Seja o primeiro a comentar!
          </p>
        )}
      </div>

      {/* Formulário de novo comentário */}
      <div className="space-y-2">
        <Textarea
          placeholder="Adicione um comentário..."
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          className="min-h-[80px]"
          maxLength={500}
        />
        <div className="flex justify-between items-center">
          <span className="text-xs text-muted-foreground">
            {newComment.length}/500
          </span>
          <Button
            onClick={handleSubmitComment}
            disabled={!newComment.trim() || addCommentMutation.isPending}
            size="sm"
          >
            {addCommentMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Enviando...
              </>
            ) : (
              <>
                <Send className="mr-2 h-4 w-4" />
                Comentar
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
