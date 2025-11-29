import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { ThumbsUp } from "lucide-react";

interface SuggestionVotesProps {
  suggestionId: string;
}

export function SuggestionVotes({ suggestionId }: SuggestionVotesProps) {
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

  const { data: votesData } = useQuery({
    queryKey: ["suggestion-votes", suggestionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("suggestion_votes")
        .select("*")
        .eq("suggestion_id", suggestionId);

      if (error) throw error;

      return {
        count: data.length,
        userHasVoted: data.some((vote) => vote.user_id === currentUserId),
        userVoteId: data.find((vote) => vote.user_id === currentUserId)?.id,
      };
    },
    enabled: !!currentUserId,
  });

  const toggleVoteMutation = useMutation({
    mutationFn: async () => {
      if (!currentUserId) throw new Error("Usuário não autenticado");

      if (votesData?.userHasVoted && votesData?.userVoteId) {
        // Remove vote
        const { error } = await supabase
          .from("suggestion_votes")
          .delete()
          .eq("id", votesData.userVoteId);

        if (error) throw error;
      } else {
        // Add vote
        const { error } = await supabase.from("suggestion_votes").insert({
          suggestion_id: suggestionId,
          user_id: currentUserId,
        });

        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["suggestion-votes", suggestionId] });
      queryClient.invalidateQueries({ queryKey: ["my-suggestions"] });
      queryClient.invalidateQueries({ queryKey: ["all-suggestions"] });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao votar",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return (
    <Button
      variant={votesData?.userHasVoted ? "default" : "outline"}
      size="sm"
      onClick={() => toggleVoteMutation.mutate()}
      disabled={toggleVoteMutation.isPending}
      className="gap-2"
    >
      <ThumbsUp className="h-4 w-4" />
      {votesData?.count || 0}
    </Button>
  );
}
