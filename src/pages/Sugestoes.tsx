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
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Send, Lightbulb } from "lucide-react";

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

  const form = useForm<SuggestionForm>({
    resolver: zodResolver(suggestionSchema),
    defaultValues: {
      title: "",
      description: "",
      category: "",
    },
  });

  const { data: mySuggestions, refetch } = useQuery({
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
      refetch();
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
      <div className="container mx-auto p-6 max-w-6xl">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Sugestões e Melhorias</h1>
          <p className="text-muted-foreground">
            Contribua com ideias para melhorar nossa intranet
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Formulário de Nova Sugestão */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lightbulb className="h-5 w-5" />
                Nova Sugestão
              </CardTitle>
              <CardDescription>
                Compartilhe suas ideias para tornar nosso ambiente de trabalho
                ainda melhor
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

          {/* Minhas Sugestões */}
          <Card>
            <CardHeader>
              <CardTitle>Minhas Sugestões</CardTitle>
              <CardDescription>
                Acompanhe o status das suas sugestões enviadas
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {!mySuggestions || mySuggestions.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    Você ainda não enviou nenhuma sugestão.
                  </p>
                ) : (
                  mySuggestions.map((suggestion) => (
                    <div
                      key={suggestion.id}
                      className="border rounded-lg p-4 space-y-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-semibold text-sm">
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
                      <p className="text-xs text-muted-foreground">
                        {new Date(suggestion.created_at).toLocaleDateString(
                          "pt-BR"
                        )}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
