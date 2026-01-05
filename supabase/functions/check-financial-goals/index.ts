import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log("Verificando metas financeiras...");

    const hoje = new Date();
    const mesAtual = hoje.getMonth() + 1;
    const anoAtual = hoje.getFullYear();
    const dataHoje = hoje.toISOString().split('T')[0];

    // Buscar metas do mês atual
    const { data: metas, error: metasError } = await supabase
      .from('fin_metas')
      .select(`
        *,
        categoria:fin_categorias(nome, cor)
      `)
      .eq('mes', mesAtual)
      .eq('ano', anoAtual);

    if (metasError) throw metasError;

    if (!metas || metas.length === 0) {
      console.log("Nenhuma meta encontrada para o mês atual");
      return new Response(
        JSON.stringify({ success: true, message: "Nenhuma meta para verificar" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Calcular primeiro e último dia do mês
    const primeiroDia = new Date(anoAtual, mesAtual - 1, 1).toISOString().split('T')[0];
    const ultimoDia = new Date(anoAtual, mesAtual, 0).toISOString().split('T')[0];

    // Buscar lançamentos do mês
    const { data: lancamentos, error: lancError } = await supabase
      .from('fin_lancamentos')
      .select('tipo, categoria_id, valor')
      .gte('data_lancamento', primeiroDia)
      .lte('data_lancamento', ultimoDia)
      .eq('status', 'pago')
      .is('deleted_at', null);

    if (lancError) throw lancError;

    const alertasGerados: string[] = [];

    for (const meta of metas) {
      // Calcular valor realizado
      let valorRealizado = 0;
      
      if (meta.categoria_id) {
        valorRealizado = lancamentos
          ?.filter(l => l.tipo === meta.tipo && l.categoria_id === meta.categoria_id)
          .reduce((acc, l) => acc + Number(l.valor), 0) || 0;
      } else {
        valorRealizado = lancamentos
          ?.filter(l => l.tipo === meta.tipo)
          .reduce((acc, l) => acc + Number(l.valor), 0) || 0;
      }

      const progresso = (valorRealizado / meta.valor_meta) * 100;
      const categoria = meta.categoria?.nome || 'Geral';

      // Verificar se já existe alerta para esta meta hoje
      const { data: alertaExistente } = await supabase
        .from('fin_alertas')
        .select('id')
        .eq('data_alerta', dataHoje)
        .ilike('mensagem', `%meta de ${meta.tipo}%${categoria}%`)
        .maybeSingle();

      if (alertaExistente) continue;

      let alertaMensagem = '';
      let alertaTipo = '';

      if (meta.tipo === 'receita' || meta.tipo === 'economia') {
        // Para receita/economia, queremos atingir a meta
        if (progresso >= 100) {
          alertaMensagem = `🎉 Meta de ${meta.tipo} atingida! ${categoria}: R$ ${valorRealizado.toLocaleString('pt-BR')} (${progresso.toFixed(1)}% da meta de R$ ${meta.valor_meta.toLocaleString('pt-BR')})`;
          alertaTipo = 'meta_atingida';
        } else if (progresso >= 80) {
          alertaMensagem = `📈 Meta de ${meta.tipo} quase atingida! ${categoria}: ${progresso.toFixed(1)}% (faltam R$ ${(meta.valor_meta - valorRealizado).toLocaleString('pt-BR')})`;
          alertaTipo = 'meta_proxima';
        } else if (progresso < 50 && hoje.getDate() > 15) {
          alertaMensagem = `⚠️ Meta de ${meta.tipo} em risco! ${categoria}: apenas ${progresso.toFixed(1)}% atingido na metade do mês`;
          alertaTipo = 'meta_risco';
        }
      } else if (meta.tipo === 'despesa') {
        // Para despesa, queremos ficar abaixo da meta
        if (progresso > 100) {
          alertaMensagem = `🚨 Meta de despesa ultrapassada! ${categoria}: R$ ${valorRealizado.toLocaleString('pt-BR')} (${progresso.toFixed(1)}% do limite de R$ ${meta.valor_meta.toLocaleString('pt-BR')})`;
          alertaTipo = 'meta_ultrapassada';
        } else if (progresso > 80) {
          alertaMensagem = `⚠️ Despesas próximas do limite! ${categoria}: ${progresso.toFixed(1)}% do orçamento utilizado`;
          alertaTipo = 'meta_alerta';
        }
      }

      if (alertaMensagem) {
        await supabase
          .from('fin_alertas')
          .insert({
            tipo: alertaTipo,
            mensagem: alertaMensagem,
            data_alerta: dataHoje
          });
        alertasGerados.push(alertaMensagem);
      }
    }

    console.log(`${alertasGerados.length} alertas de metas gerados`);

    return new Response(
      JSON.stringify({
        success: true,
        metasVerificadas: metas.length,
        alertasGerados: alertasGerados.length,
        alertas: alertasGerados
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("Erro ao verificar metas:", error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
