import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ADVBOX_API_BASE = 'https://app.advbox.com.br/api/v1';
const MAX_EXECUTION_TIME = 55000; // 55 seconds - leave margin before Edge Function timeout (60s)

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

interface AdvboxTransaction {
  id?: number | string;
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

interface ExistingRecord {
  id: string;
  advbox_transaction_id: string;
  updated_at: string;
}

interface Categoria {
  id: string;
  nome: string;
  tipo: string;
}

function getValidTransactionId(tx: AdvboxTransaction): string | null {
  // Try multiple fields that could contain a valid ID
  if (tx.id !== undefined && tx.id !== null && String(tx.id).trim() !== '' && String(tx.id) !== 'undefined') {
    return String(tx.id);
  }
  if (tx.identification && String(tx.identification).trim() !== '') {
    return String(tx.identification);
  }
  return null;
}

async function fetchTransactionsBatch(
  advboxToken: string, 
  startDate: string, 
  endDate: string, 
  offset: number, 
  limit: number
): Promise<{ items: AdvboxTransaction[]; hasMore: boolean }> {
  const endpoint = `${ADVBOX_API_BASE}/transactions?limit=${limit}&offset=${offset}&date_due_start=${startDate}&date_due_end=${endDate}`;
  
  console.log(`Fetching: offset=${offset}, limit=${limit}`);
  
  try {
    const response = await fetch(endpoint, {
      headers: {
        'Authorization': `Bearer ${advboxToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const responseText = await response.text();
      console.error(`ADVBox API error: status=${response.status}`);
      
      if (response.status === 429) {
        console.log('Rate limited, waiting 5 seconds...');
        await sleep(5000);
        return fetchTransactionsBatch(advboxToken, startDate, endDate, offset, limit);
      }
      
      if (response.status === 401) {
        throw new Error(`Token ADVBOX inválido ou expirado`);
      }
      
      throw new Error(`Erro na API ADVBox: ${response.status}`);
    }

    const data = await response.json();
    const items = data.data || data || [];
    
    // Filter out items without valid IDs
    const validItems = (Array.isArray(items) ? items : []).filter(
      (tx: AdvboxTransaction) => getValidTransactionId(tx) !== null
    );
    
    const skippedCount = (Array.isArray(items) ? items.length : 0) - validItems.length;
    if (skippedCount > 0) {
      console.log(`Skipped ${skippedCount} transactions without valid ID`);
    }
    
    console.log(`Fetched ${validItems.length} valid transactions`);
    
    return {
      items: validItems,
      hasMore: Array.isArray(items) && items.length >= limit
    };
  } catch (error) {
    console.error('Error fetching:', error);
    throw error;
  }
}

async function processTransactionsBatch(
  supabase: SupabaseClient,
  transactions: AdvboxTransaction[],
  categoriaMap: Map<string, { id: string; tipo: string }>,
  categorias: Categoria[] | null,
  contaPadraoId: string | null,
  userId: string,
  forceUpdate: boolean
): Promise<{ created: number; updated: number; skipped: number; errors: string[] }> {
  let created = 0;
  let updated = 0;
  let skipped = 0;
  const errors: string[] = [];

  // Get all valid advbox IDs
  const advboxIds = transactions
    .map(tx => getValidTransactionId(tx))
    .filter((id): id is string => id !== null);
  
  if (advboxIds.length === 0) {
    return { created: 0, updated: 0, skipped: 0, errors: [] };
  }

  const { data: existingRecords } = await supabase
    .from('fin_lancamentos')
    .select('id, advbox_transaction_id, updated_at')
    .in('advbox_transaction_id', advboxIds);

  const existingMap = new Map<string, ExistingRecord>(
    ((existingRecords as ExistingRecord[] | null) || []).map(r => [r.advbox_transaction_id, r])
  );

  // Prepare records for upsert
  const toUpsert: Record<string, unknown>[] = [];
  const syncRecords: Record<string, unknown>[] = [];

  for (const tx of transactions) {
    try {
      const advboxId = getValidTransactionId(tx);
      if (!advboxId) {
        skipped++;
        continue;
      }

      const existing = existingMap.get(advboxId);

      if (existing && !forceUpdate) {
        skipped++;
        continue;
      }

      const amount = Number(tx.amount) || 0;
      const tipo = amount >= 0 ? 'receita' : 'despesa';
      
      let categoriaId: string | null = null;
      if (tx.category) {
        const cat = categoriaMap.get(tx.category.toLowerCase());
        if (cat) {
          categoriaId = cat.id;
        }
      }

      if (!categoriaId) {
        const defaultCat = tipo === 'receita' 
          ? categorias?.find(c => c.tipo === 'receita')
          : categorias?.find(c => c.tipo === 'despesa');
        categoriaId = defaultCat?.id || null;
      }

      const lancamentoData: Record<string, unknown> = {
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
        updated_at: new Date().toISOString(),
      };

      if (existing) {
        // Update existing record
        lancamentoData.updated_by = userId;
        lancamentoData.id = existing.id;
        toUpsert.push(lancamentoData);
        updated++;
      } else {
        // New record
        lancamentoData.created_by = userId;
        toUpsert.push(lancamentoData);
        created++;
      }

      syncRecords.push({
        advbox_transaction_id: advboxId,
        advbox_data: tx,
        last_updated: new Date().toISOString(),
      });

    } catch (err) {
      console.error(`Error processing tx:`, err);
      errors.push(`${err instanceof Error ? err.message : 'Erro'}`);
    }
  }

  // Process one by one to avoid batch errors
  for (const record of toUpsert) {
    try {
      const advboxId = record.advbox_transaction_id as string;
      const existing = existingMap.get(advboxId);
      
      if (existing) {
        const { error: updateError } = await supabase
          .from('fin_lancamentos')
          .update(record as never)
          .eq('id', existing.id);
        
        if (updateError) {
          console.error(`Update error for ${advboxId}:`, updateError.message);
        }
      } else {
        // Try insert, if fails due to duplicate, try update
        const { error: insertError } = await supabase
          .from('fin_lancamentos')
          .insert(record as never);
        
        if (insertError) {
          if (insertError.code === '23505') {
            // Duplicate - try to update instead
            const { error: updateError } = await supabase
              .from('fin_lancamentos')
              .update(record as never)
              .eq('advbox_transaction_id', advboxId);
            
            if (updateError) {
              console.error(`Update after dup for ${advboxId}:`, updateError.message);
            }
          } else {
            console.error(`Insert error for ${advboxId}:`, insertError.message);
          }
        }
      }
    } catch (err) {
      console.error(`Record processing error:`, err);
    }
  }

  // Upsert sync records
  if (syncRecords.length > 0) {
    await supabase
      .from('advbox_financial_sync')
      .upsert(syncRecords as never[], { onConflict: 'advbox_transaction_id' });
  }

  return { created, updated, skipped, errors };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const advboxToken = Deno.env.get("ADVBOX_API_TOKEN");
    const supabase = createClient(supabaseUrl, supabaseKey);

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

    const { data: permission } = await supabase.rpc('get_admin_permission', {
      _user_id: user.id,
      _feature: 'financial'
    });

    if (permission !== 'edit') {
      return new Response(
        JSON.stringify({ success: false, message: "Permissão negada" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!advboxToken) {
      return new Response(
        JSON.stringify({ success: false, message: "Token ADVBOX não configurado" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json().catch(() => ({}));
    const months = body.months || 12;
    const forceUpdate = body.force_update || false;

    console.log(`Syncing ${months} months...`);

    const now = new Date();
    const startDate = new Date(now);
    startDate.setMonth(startDate.getMonth() - months);
    const startDateStr = startDate.toISOString().split('T')[0];
    const endDateStr = now.toISOString().split('T')[0];

    // Get categories and accounts
    const { data: categoriasData } = await supabase
      .from('fin_categorias')
      .select('id, nome, tipo')
      .eq('ativa', true);

    const categorias = categoriasData as Categoria[] | null;

    const { data: contas } = await supabase
      .from('fin_contas')
      .select('id, nome')
      .eq('ativa', true)
      .limit(1);

    const contaPadraoId = (contas as Array<{ id: string; nome: string }> | null)?.[0]?.id || null;
    const categoriaMap = new Map<string, { id: string; tipo: string }>();
    categorias?.forEach(c => {
      categoriaMap.set(c.nome.toLowerCase(), { id: c.id, tipo: c.tipo });
    });

    // Process in batches with time limit
    let offset = 0;
    let totalProcessed = 0;
    let totalCreated = 0;
    let totalUpdated = 0;
    let totalSkipped = 0;
    const allErrors: string[] = [];
    let hasMore = true;
    const fetchLimit = 50; // Smaller batches
    const maxIterations = 500;
    let iterations = 0;
    let lastOffset = 0;
    let timedOut = false;

    console.log(`Processing from ${startDateStr} to ${endDateStr}`);

    while (hasMore && iterations < maxIterations) {
      // Check if we're approaching timeout
      const elapsedTime = Date.now() - startTime;
      if (elapsedTime > MAX_EXECUTION_TIME) {
        console.log(`Approaching timeout after ${iterations} batches, saving progress...`);
        timedOut = true;
        break;
      }

      iterations++;
      
      if (offset > 0) {
        await sleep(800); // Reduced delay
      }

      try {
        const { items, hasMore: more } = await fetchTransactionsBatch(
          advboxToken, 
          startDateStr, 
          endDateStr, 
          offset, 
          fetchLimit
        );

        if (items.length === 0) {
          hasMore = false;
          break;
        }

        const { created, updated, skipped, errors } = await processTransactionsBatch(
          supabase,
          items,
          categoriaMap,
          categorias,
          contaPadraoId,
          user.id,
          forceUpdate
        );

        totalCreated += created;
        totalUpdated += updated;
        totalSkipped += skipped;
        totalProcessed += items.length;
        allErrors.push(...errors);

        console.log(`Batch ${iterations}: ${items.length} tx (${created}c, ${updated}u, ${skipped}s)`);

        lastOffset = offset;
        offset += fetchLimit;
        hasMore = more;
      } catch (batchError) {
        console.error(`Batch ${iterations} error:`, batchError);
        allErrors.push(`Batch ${iterations}: ${batchError instanceof Error ? batchError.message : 'Error'}`);
        // Continue with next batch
        offset += fetchLimit;
      }
    }

    // Log sync action
    await supabase
      .from('audit_log')
      .insert({
        tabela: 'fin_lancamentos',
        acao: 'sync_advbox',
        descricao: `Sincronização ADVBox: ${totalCreated} criados, ${totalUpdated} atualizados, ${totalSkipped} ignorados${timedOut ? ' (parcial - timeout)' : ''}`,
        usuario_id: user.id,
        dados_novos: {
          total: totalProcessed,
          created: totalCreated,
          updated: totalUpdated,
          skipped: totalSkipped,
          errors: allErrors.length,
          period: { start: startDateStr, end: endDateStr },
          batches: iterations,
          lastOffset,
          timedOut
        }
      } as never);

    const message = timedOut 
      ? `Sincronização parcial: ${totalCreated} criados, ${totalUpdated} atualizados. Execute novamente para continuar.`
      : `Sincronização concluída: ${totalCreated} criados, ${totalUpdated} atualizados, ${totalSkipped} ignorados`;

    console.log(message);

    return new Response(
      JSON.stringify({
        success: true,
        total: totalProcessed,
        created: totalCreated,
        updated: totalUpdated,
        skipped: totalSkipped,
        errors: allErrors.length,
        errorDetails: allErrors.slice(0, 5),
        period: { start: startDateStr, end: endDateStr },
        batches: iterations,
        partial: timedOut,
        message
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("Sync error:", error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage,
        message: `Erro: ${errorMessage}`
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
