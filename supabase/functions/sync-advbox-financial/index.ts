import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ADVBOX_API_BASE = 'https://app.advbox.com.br/api/v1';

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

interface AdvboxTransaction {
  id: number | string;
  name?: string;
  description?: string;
  identification?: string;
  customer_name?: string;
  amount?: number;
  date_due?: string;
  date_payment?: string;
  status?: string;
  paid?: boolean;
  category?: string;
  type?: string;
  lawsuit_id?: number;
  lawsuit_title?: string;
  bank_account?: string;
  notes?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const advboxToken = Deno.env.get("ADVBOX_API_TOKEN");
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify authorization
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, message: "Não autorizado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, message: "Usuário não autenticado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check financial permission
    const { data: permission } = await supabase.rpc('get_admin_permission', {
      _user_id: user.id,
      _feature: 'financial'
    });

    if (permission !== 'edit') {
      return new Response(
        JSON.stringify({ success: false, message: "Permissão negada. Apenas usuários com permissão de edição financeira podem sincronizar." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!advboxToken) {
      console.log("ADVBOX_API_TOKEN não configurado");
      return new Response(
        JSON.stringify({ success: false, message: "Token ADVBOX não configurado" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse request body
    const body = await req.json().catch(() => ({}));
    const months = body.months || 12;
    const forceUpdate = body.force_update || false;

    console.log(`Sincronizando transações financeiras do ADVBOX (últimos ${months} meses)...`);

    // Calculate date range
    const now = new Date();
    const startDate = new Date(now);
    startDate.setMonth(startDate.getMonth() - months);
    const startDateStr = startDate.toISOString().split('T')[0];
    const endDateStr = now.toISOString().split('T')[0];

    // Fetch all transactions from ADVBox with pagination
    let allTransactions: AdvboxTransaction[] = [];
    let offset = 0;
    const limit = 100;
    let hasMore = true;
    let iterations = 0;
    const maxIterations = 100;

    console.log(`Buscando transações de ${startDateStr} até ${endDateStr}...`);

    while (hasMore && iterations < maxIterations) {
      if (iterations > 0) {
        await sleep(1500); // Rate limit protection
      }

      const endpoint = `${ADVBOX_API_BASE}/transactions?limit=${limit}&offset=${offset}&date_due_start=${startDateStr}&date_due_end=${endDateStr}`;
      
      const response = await fetch(endpoint, {
        headers: {
          'Authorization': `Bearer ${advboxToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        if (response.status === 429) {
          console.log("Rate limit atingido, aguardando...");
          await sleep(5000);
          continue;
        }
        throw new Error(`Erro na API ADVBox: ${response.status}`);
      }

      const data = await response.json();
      const items = data.data || [];

      if (items.length === 0) {
        hasMore = false;
      } else {
        allTransactions = [...allTransactions, ...items];
        offset += limit;
        if (items.length < limit) {
          hasMore = false;
        }
      }

      iterations++;
      console.log(`Carregadas ${allTransactions.length} transações...`);
    }

    console.log(`Total de ${allTransactions.length} transações do ADVBox`);

    // Get default category and account
    const { data: categorias } = await supabase
      .from('fin_categorias')
      .select('id, nome, tipo')
      .eq('ativa', true);

    const { data: contas } = await supabase
      .from('fin_contas')
      .select('id, nome')
      .eq('ativa', true)
      .limit(1);

    const contaPadraoId = contas?.[0]?.id;

    // Map category names to IDs
    const categoriaMap = new Map<string, { id: string; tipo: string }>();
    categorias?.forEach(c => {
      categoriaMap.set(c.nome.toLowerCase(), { id: c.id, tipo: c.tipo });
    });

    // Process transactions
    let created = 0;
    let updated = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const tx of allTransactions) {
      try {
        const advboxId = String(tx.id);

        // Check if already synced
        const { data: existing } = await supabase
          .from('fin_lancamentos')
          .select('id, updated_at')
          .eq('advbox_transaction_id', advboxId)
          .single();

        if (existing && !forceUpdate) {
          skipped++;
          continue;
        }

        // Determine transaction type and category
        const amount = Number(tx.amount) || 0;
        const tipo = amount >= 0 ? 'receita' : 'despesa';
        
        // Try to match category
        let categoriaId: string | null = null;
        if (tx.category) {
          const cat = categoriaMap.get(tx.category.toLowerCase());
          if (cat) {
            categoriaId = cat.id;
          }
        }

        // If no category match, try to find generic category by type
        if (!categoriaId) {
          const defaultCat = tipo === 'receita' 
            ? categorias?.find(c => c.tipo === 'receita')
            : categorias?.find(c => c.tipo === 'despesa');
          categoriaId = defaultCat?.id || null;
        }

        // Build lancamento data
        const lancamentoData = {
          tipo,
          categoria_id: categoriaId,
          conta_origem_id: contaPadraoId,
          valor: Math.abs(amount),
          descricao: tx.name || tx.description || tx.identification || `ADVBox #${advboxId}`,
          data_lancamento: tx.date_due?.split('T')[0] || new Date().toISOString().split('T')[0],
          data_vencimento: tx.date_due?.split('T')[0] || null,
          data_pagamento: tx.date_payment?.split('T')[0] || null,
          status: tx.paid || tx.status === 'paid' ? 'pago' : 'pendente',
          origem: 'cliente',
          observacoes: [
            tx.customer_name ? `Cliente: ${tx.customer_name}` : null,
            tx.lawsuit_title ? `Processo: ${tx.lawsuit_title}` : null,
            tx.notes ? `Notas: ${tx.notes}` : null,
            `Importado do ADVBox em ${new Date().toLocaleString('pt-BR')}`
          ].filter(Boolean).join('\n'),
          advbox_transaction_id: advboxId,
          created_by: user.id,
        };

        if (existing) {
          // Update existing
          const { error: updateError } = await supabase
            .from('fin_lancamentos')
            .update({
              ...lancamentoData,
              updated_by: user.id,
              updated_at: new Date().toISOString(),
            })
            .eq('id', existing.id);

          if (updateError) throw updateError;
          updated++;
        } else {
          // Create new
          const { error: insertError } = await supabase
            .from('fin_lancamentos')
            .insert(lancamentoData);

          if (insertError) throw insertError;
          created++;
        }

        // Store sync record
        await supabase
          .from('advbox_financial_sync')
          .upsert({
            advbox_transaction_id: advboxId,
            advbox_data: tx,
            last_updated: new Date().toISOString(),
          }, {
            onConflict: 'advbox_transaction_id'
          });

      } catch (err) {
        console.error(`Erro ao processar transação ${tx.id}:`, err);
        errors.push(`ID ${tx.id}: ${err instanceof Error ? err.message : 'Erro desconhecido'}`);
      }
    }

    // Log sync action
    await supabase
      .from('audit_log')
      .insert({
        tabela: 'fin_lancamentos',
        acao: 'sync_advbox',
        descricao: `Sincronização ADVBox: ${created} criados, ${updated} atualizados, ${skipped} ignorados`,
        usuario_id: user.id,
        dados_novos: {
          total: allTransactions.length,
          created,
          updated,
          skipped,
          errors: errors.length,
          period: { start: startDateStr, end: endDateStr }
        }
      });

    console.log(`Sincronização concluída: ${created} criados, ${updated} atualizados, ${skipped} ignorados, ${errors.length} erros`);

    return new Response(
      JSON.stringify({
        success: true,
        total: allTransactions.length,
        created,
        updated,
        skipped,
        errors: errors.length,
        errorDetails: errors.slice(0, 10), // First 10 errors
        period: { start: startDateStr, end: endDateStr }
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("Erro na sincronização:", error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
