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

    const hoje = new Date().toISOString().split('T')[0];

    // Buscar recorrências ativas que precisam ser processadas
    const { data: recorrencias, error: recError } = await supabase
      .from('fin_recorrencias')
      .select('*')
      .eq('ativo', true)
      .lte('proxima_geracao', hoje);

    if (recError) throw recError;

    console.log(`Encontradas ${recorrencias?.length || 0} recorrências para processar`);

    const processadas: string[] = [];
    const erros: string[] = [];

    for (const rec of recorrencias || []) {
      try {
        // Verificar se data_fim foi atingida
        if (rec.data_fim && rec.data_fim < hoje) {
          // Desativar recorrência
          await supabase
            .from('fin_recorrencias')
            .update({ ativo: false })
            .eq('id', rec.id);
          continue;
        }

        // Criar lançamento
        const lancamento = {
          tipo: rec.tipo,
          categoria_id: rec.categoria_id,
          conta_origem_id: rec.conta_id,
          cliente_id: rec.cliente_id,
          setor_id: rec.setor_id,
          valor: rec.valor,
          descricao: `[REC] ${rec.descricao}`,
          data_lancamento: rec.proxima_geracao || hoje,
          data_vencimento: rec.proxima_geracao,
          status: 'pendente',
          recorrencia_id: rec.id,
          origem: 'escritorio',
          created_by: rec.created_by
        };

        const { error: lancError } = await supabase
          .from('fin_lancamentos')
          .insert(lancamento);

        if (lancError) throw lancError;

        // Calcular próxima geração
        const proximaData = new Date(rec.proxima_geracao || hoje);
        
        switch (rec.frequencia) {
          case 'semanal':
            proximaData.setDate(proximaData.getDate() + 7);
            break;
          case 'quinzenal':
            proximaData.setDate(proximaData.getDate() + 15);
            break;
          case 'mensal':
            proximaData.setMonth(proximaData.getMonth() + 1);
            break;
          case 'bimestral':
            proximaData.setMonth(proximaData.getMonth() + 2);
            break;
          case 'trimestral':
            proximaData.setMonth(proximaData.getMonth() + 3);
            break;
          case 'semestral':
            proximaData.setMonth(proximaData.getMonth() + 6);
            break;
          case 'anual':
            proximaData.setFullYear(proximaData.getFullYear() + 1);
            break;
        }

        // Atualizar próxima geração
        await supabase
          .from('fin_recorrencias')
          .update({ proxima_geracao: proximaData.toISOString().split('T')[0] })
          .eq('id', rec.id);

        processadas.push(rec.descricao);
        console.log(`Processada recorrência: ${rec.descricao}`);

      } catch (err) {
        console.error(`Erro ao processar recorrência ${rec.id}:`, err);
        erros.push(rec.descricao);
      }
    }

    // Criar alerta se houve processamentos
    if (processadas.length > 0) {
      await supabase
        .from('fin_alertas')
        .insert({
          tipo: 'recorrencia_processada',
          mensagem: `${processadas.length} lançamento(s) recorrente(s) gerado(s) automaticamente: ${processadas.slice(0, 3).join(', ')}${processadas.length > 3 ? '...' : ''}`,
          data_alerta: hoje
        });
    }

    return new Response(
      JSON.stringify({
        success: true,
        processadas: processadas.length,
        erros: erros.length,
        detalhes: { processadas, erros }
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("Erro no processamento:", error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
