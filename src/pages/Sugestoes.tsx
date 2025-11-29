import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Send, Lightbulb, MessageSquare } from "lucide-react";
import { SuggestionComments } from "@/components/SuggestionComments";
import { SuggestionVotes } from "@/components/SuggestionVotes";

const suggestionSchema = z.object({
  title: z
    .string()
    .trim()
    .min(5, "O título deve ter no mínimo 5 caracteres")
    .max(100, "O título deve ter no máximo 100 caracteres"),
  description: z
    .string()
    .trim()
    .min(10, "A descrição deve ter no mínimo 10 caracteres")
    .max(1000, "A descrição deve ter no máximo 1000 caracteres"),
  category: z.string().min(1, "Selecione uma categoria"),
});

type SuggestionForm = z.infer<typeof suggestionSchema>;

const categories = [
  { value: "melhoria", label: "Melhoria de Ferramenta" },
  { value: "nova_ferramenta", label: "Nova Ferramenta" },
  { value: "bug", label: "Reportar Problema" },
  { value: "geral", label: "Sugestão Geral" },
];

const statusMap = {
  pending: { label: "Pendente", variant: "secondary" as const },
  em_analise: { label: "Em Análise", variant: "default" as const },
  concluida: { label: "Concluída", variant: "default" as const },
  rejeitada: { label: "Rejeitada", variant: "destructive" as const },
};

export default function Sugestoes() {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedSuggestion, setSelectedSuggestion] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterCategory, setFilterCategory] = useState<string>("all");

  const form = useForm<SuggestionForm>({
    resolver: zodResolver(suggestionSchema),
    defaultValues: {
      title: "",
      description: "",
      category: "",
    },
  });

  const { data: allSuggestions, refetch: refetchAll } = useQuery({
    queryKey: ["all-suggestions", filterStatus, filterCategory],
    queryFn: async () => {
      let query = supabase
        .from("suggestions")
        .select("*")
        .order("created_at", { ascending: false });

      if (filterStatus !== "all") {
        query = query.eq("status", filterStatus);
      }

      if (filterCategory !== "all") {
        query = query.eq("category", filterCategory);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Buscar contagem de votos
      const suggestionIds = data.map((s) => s.id);
      const { data: votesData } = await supabase
        .from("suggestion_votes")
        .select("suggestion_id")
        .in("suggestion_id", suggestionIds);

      const votesCount = votesData?.reduce((acc, vote) => {
        acc[vote.suggestion_id] = (acc[vote.suggestion_id] || 0) + 1;
        return acc;
      }, {} as Record<string, number>) || {};

      // Buscar contagem de comentários
      const { data: commentsData } = await supabase
        .from("suggestion_comments")
        .select("suggestion_id")
        .in("suggestion_id", suggestionIds);

      const commentsCount = commentsData?.reduce((acc, comment) => {
        acc[comment.suggestion_id] = (acc[comment.suggestion_id] || 0) + 1;
        return acc;
      }, {} as Record<string, number>) || {};

      return data.map((suggestion) => ({
        ...suggestion,
        votes: votesCount[suggestion.id] || 0,
        comments: commentsCount[suggestion.id] || 0,
      }));
    },
  });

  const { data: mySuggestions, refetch: refetchMine } = useQuery({
    queryKey: ["my-suggestions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("suggestions")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  const onSubmit = async (values: SuggestionForm) => {
    setIsSubmitting(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        toast({
          title: "Erro de autenticação",
          description: "Você precisa estar logado para enviar sugestões.",
          variant: "destructive",
        });
        return;
      }

      const { error } = await supabase.from("suggestions").insert({
        title: values.title,
        description: values.description,
        category: values.category,
        user_id: user.id,
        status: "pending",
      });

      if (error) throw error;

      toast({
        title: "Sugestão enviada!",
        description: "Sua sugestão foi enviada e será analisada pela equipe.",
      });

      form.reset();
      refetchMine();
      refetchAll();
    } catch (error: any) {
      toast({
        title: "Erro ao enviar sugestão",
        description: error.message || "Ocorreu um erro. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Layout>
      <div className="container mx-auto p-6 max-w-7xl">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Sugestões e Melhorias</h1>
          <p className="text-muted-foreground">
            Contribua com ideias para melhorar nossa intranet
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Formulário de Nova Sugestão */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lightbulb className="h-5 w-5" />
                Nova Sugestão
              </CardTitle>
              <CardDescription>
                Compartilhe suas ideias
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form
                  onSubmit={form.handleSubmit(onSubmit)}
                  className="space-y-4"
                >
                  <FormField
                    control={form.control}
                    name="title"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Título</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Título da sua sugestão"
                            {...field}
                            maxLength={100}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="category"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Categoria</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          value={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione uma categoria" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {categories.map((cat) => (
                              <SelectItem key={cat.value} value={cat.value}>
                                {cat.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Descrição</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Descreva sua sugestão em detalhes..."
                            className="min-h-[120px]"
                            {...field}
                            maxLength={1000}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Button
                    type="submit"
                    className="w-full"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Enviando...
                      </>
                    ) : (
                      <>
                        <Send className="mr-2 h-4 w-4" />
                        Enviar Sugestão
                      </>
                    )}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>

          {/* Todas as Sugestões */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Todas as Sugestões</CardTitle>
              <CardDescription>
                Veja e vote nas sugestões da comunidade
              </CardDescription>
              <div className="flex gap-2 pt-2">
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os status</SelectItem>
                    {Object.entries(statusMap).map(([key, { label }]) => (
                      <SelectItem key={key} value={key}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={filterCategory} onValueChange={setFilterCategory}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as categorias</SelectItem>
                    {categories.map((cat) => (
                      <SelectItem key={cat.value} value={cat.value}>
                        {cat.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {!allSuggestions || allSuggestions.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    Nenhuma sugestão encontrada.
                  </p>
                ) : (
                  allSuggestions.map((suggestion: any) => (
                    <div
                      key={suggestion.id}
                      className="border rounded-lg p-4 space-y-3 hover:bg-muted/50 transition-colors cursor-pointer"
                      onClick={() => setSelectedSuggestion(suggestion.id)}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-semibold text-sm flex-1">
                          {suggestion.title}
                        </h3>
                        <Badge
                          variant={
                            statusMap[
                              suggestion.status as keyof typeof statusMap
                            ]?.variant
                          }
                        >
                          {
                            statusMap[
                              suggestion.status as keyof typeof statusMap
                            ]?.label
                          }
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {categories.find(
                          (c) => c.value === suggestion.category
                        )?.label || suggestion.category}
                      </p>
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {suggestion.description}
                      </p>
                      <div className="flex items-center gap-3">
                        <SuggestionVotes suggestionId={suggestion.id} />
                        <Button variant="ghost" size="sm" className="gap-2">
                          <MessageSquare className="h-4 w-4" />
                          {suggestion.comments}
                        </Button>
                        <p className="text-xs text-muted-foreground ml-auto">
                          {new Date(suggestion.created_at).toLocaleDateString(
                            "pt-BR"
                          )}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Dialog de Comentários */}
        <Dialog
          open={!!selectedSuggestion}
          onOpenChange={() => setSelectedSuggestion(null)}
        >
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {allSuggestions?.find((s: any) => s.id === selectedSuggestion)?.title}
              </DialogTitle>
              <DialogDescription>
                {allSuggestions?.find((s: any) => s.id === selectedSuggestion)?.description}
              </DialogDescription>
            </DialogHeader>
            {selectedSuggestion && (
              <SuggestionComments suggestionId={selectedSuggestion} />
            )}
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
