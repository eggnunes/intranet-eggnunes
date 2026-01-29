import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ADVBOX_API_BASE = 'https://app.advbox.com.br/api/v1';
const MAX_EXECUTION_TIME = 50000; // 50 seconds - leave margin before Edge Function timeout

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
  bank_account_id?: number | string;
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

interface ContaBancaria {
  id: string;
  nome: string;
}

interface SyncStatus {
  id: string;
  status: string;
  last_offset: number;
  total_processed: number;
  total_created: number;
  total_updated: number;
  total_skipped: number;
  months: number;
  start_date: string | null;
  end_date: string | null;
  error_message: string | null;
  last_run_at: string | null;
  completed_at: string | null;
}

function getValidTransactionId(tx: AdvboxTransaction): string | null {
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
  
  const response = await fetch(endpoint, {
    headers: {
      'Authorization': `Bearer ${advboxToken}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
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
  
  const validItems = (Array.isArray(items) ? items : []).filter(
    (tx: AdvboxTransaction) => getValidTransactionId(tx) !== null
  );
  
  console.log(`Fetched ${validItems.length} valid transactions (offset ${offset})`);
  
  return {
    items: validItems,
    hasMore: Array.isArray(items) && items.length >= limit
  };
}

async function processTransactionsBatch(
  supabase: SupabaseClient,
  transactions: AdvboxTransaction[],
  categoriaMap: Map<string, { id: string; tipo: string }>,
  categorias: Categoria[] | null,
  contasMap: Map<string, string>,
  systemUserId: string
): Promise<{ created: number; updated: number; skipped: number }> {
  let created = 0;
  let updated = 0;
  let skipped = 0;

  const advboxIds = transactions
    .map(tx => getValidTransactionId(tx))
    .filter((id): id is string => id !== null);
  
  if (advboxIds.length === 0) {
    return { created: 0, updated: 0, skipped: 0 };
  }

  // Check existing records in fin_lancamentos
  const { data: existingRecords } = await supabase
    .from('fin_lancamentos')
    .select('id, advbox_transaction_id, updated_at')
    .in('advbox_transaction_id', advboxIds);

  const existingMap = new Map<string, ExistingRecord>(
    ((existingRecords as ExistingRecord[] | null) || []).map(r => [r.advbox_transaction_id, r])
  );

  // Also check existing in advbox_financial_sync
  const { data: existingSyncRecords } = await supabase
    .from('advbox_financial_sync')
    .select('advbox_transaction_id')
    .in('advbox_transaction_id', advboxIds);

  const existingSyncSet = new Set<string>(
    ((existingSyncRecords as Array<{ advbox_transaction_id: string }> | null) || []).map(r => r.advbox_transaction_id)
  );

  for (const tx of transactions) {
    const advboxId = getValidTransactionId(tx);
    if (!advboxId) {
      skipped++;
      continue;
    }

    // Check if already exists in fin_lancamentos
    const existing = existingMap.get(advboxId);
    if (existing) {
      // Still save to advbox_financial_sync if not there yet (for backup)
      if (!existingSyncSet.has(advboxId)) {
        await supabase.from('advbox_financial_sync').upsert({
          advbox_transaction_id: advboxId,
          advbox_data: tx,
          lancamento_id: existing.id,
          last_updated: new Date().toISOString()
        }, { onConflict: 'advbox_transaction_id' });
      }
      skipped++;
      continue;
    }

    const amount = Number(tx.amount) || 0;
    const tipo = amount >= 0 ? 'receita' : 'despesa';
    
    // Find category
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

    // Find bank account - ONLY if ADVBox provides bank_account info
    let contaOrigemId: string | null = null;
    if (tx.bank_account && tx.bank_account.trim() !== '') {
      // Try to match by name (case insensitive)
      const bankAccountLower = tx.bank_account.toLowerCase().trim();
      for (const [nome, id] of contasMap.entries()) {
        if (nome.toLowerCase().includes(bankAccountLower) || bankAccountLower.includes(nome.toLowerCase())) {
          contaOrigemId = id;
          break;
        }
      }
      if (!contaOrigemId) {
        console.log(`Conta bancária do ADVBox não mapeada: "${tx.bank_account}"`);
      }
    }
    // If ADVBox doesn't provide bank_account, contaOrigemId stays null

    // Determine status based on date_payment (if has payment date, it's paid)
    const isPaid = !!(tx.date_payment && tx.date_payment.trim() !== '');
    
    // Determine tipo based on category name or amount
    let tipoFinal = tipo;
    const categoryLower = (tx.category || '').toLowerCase();
    if (categoryLower.includes('receita') || categoryLower.includes('honorário') || categoryLower.includes('honorario')) {
      tipoFinal = 'receita';
    } else if (categoryLower.includes('gasto') || categoryLower.includes('despesa') || categoryLower.includes('repasse')) {
      tipoFinal = 'despesa';
    }

    const lancamentoData = {
      tipo: tipoFinal,
      categoria_id: categoriaId,
      conta_origem_id: contaOrigemId, // Can be null if ADVBox doesn't provide bank_account
      valor: Math.abs(amount),
      descricao: tx.name || tx.description || tx.identification || `ADVBox #${advboxId}`,
      data_lancamento: tx.date_due?.split('T')[0] || new Date().toISOString().split('T')[0],
      data_vencimento: tx.date_due?.split('T')[0] || null,
      data_pagamento: tx.date_payment?.split('T')[0] || null,
      status: isPaid ? 'pago' : 'pendente',
      origem: 'advbox',
      observacoes: [
        tx.customer_name ? `Cliente: ${tx.customer_name}` : null,
        tx.lawsuit_title ? `Processo: ${tx.lawsuit_title}` : null,
        tx.bank_account ? `Conta ADVBox: ${tx.bank_account}` : null,
        tx.notes ? `Notas: ${tx.notes}` : null,
        tx.category ? `Categoria ADVBox: ${tx.category}` : null,
        `Importado do ADVBox em ${new Date().toLocaleString('pt-BR')}`
      ].filter(Boolean).join('\n'),
      advbox_transaction_id: advboxId,
      created_by: systemUserId,
    };

    const { data: insertedData, error: insertError } = await supabase
      .from('fin_lancamentos')
      .insert(lancamentoData as never)
      .select('id')
      .single();
    
    if (insertError) {
      if (insertError.code === '23505') {
        skipped++;
      } else {
        console.error(`Insert error for ${advboxId}:`, insertError.message);
        skipped++;
      }
    } else {
      // Save full ADVBox data to advbox_financial_sync for backup
      await supabase.from('advbox_financial_sync').upsert({
        advbox_transaction_id: advboxId,
        advbox_data: tx,
        lancamento_id: insertedData?.id || null,
        last_updated: new Date().toISOString()
      }, { onConflict: 'advbox_transaction_id' });
      
      created++;
    }
  }

  return { created, updated, skipped };
}

async function updateSyncStatus(
  supabase: SupabaseClient,
  updates: Partial<SyncStatus>
) {
  await supabase
    .from('advbox_sync_status')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('sync_type', 'financial');
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

    // Check for authorization - allow both authenticated users and cron jobs
    const authHeader = req.headers.get('Authorization');
    let userId: string | null = null;
    
    if (authHeader && authHeader !== 'Bearer YOUR_ANON_KEY') {
      const token = authHeader.replace('Bearer ', '');
      const { data: { user } } = await supabase.auth.getUser(token);
      userId = user?.id || null;
      
      if (userId) {
        const { data: permission } = await supabase.rpc('get_admin_permission', {
          _user_id: userId,
          _feature: 'financial'
        });

        if (permission !== 'edit') {
          return new Response(
            JSON.stringify({ success: false, message: "Permissão negada" }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }
    }

    if (!advboxToken) {
      return new Response(
        JSON.stringify({ success: false, message: "Token ADVBOX não configurado" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get or create sync status
    const { data: syncStatusData } = await supabase
      .from('advbox_sync_status')
      .select('*')
      .eq('sync_type', 'financial')
      .single();

    let syncStatus = syncStatusData as SyncStatus | null;

    // Parse request body
    const body = await req.json().catch(() => ({}));
    const requestedMonths = body.months || 60; // Default to 5 years
    const forceRestart = body.force_restart || false;
    const isAutoMode = body.auto_mode || false;

    // If force restart or first run, reset everything
    if (forceRestart || !syncStatus || syncStatus.status === 'idle') {
      const now = new Date();
      const startDate = new Date(now);
      startDate.setMonth(startDate.getMonth() - requestedMonths);
      
      await supabase
        .from('advbox_sync_status')
        .upsert({
          sync_type: 'financial',
          status: 'running',
          last_offset: 0,
          total_processed: 0,
          total_created: 0,
          total_updated: 0,
          total_skipped: 0,
          months: requestedMonths,
          start_date: startDate.toISOString().split('T')[0],
          end_date: now.toISOString().split('T')[0],
          started_at: new Date().toISOString(),
          last_run_at: new Date().toISOString(),
          completed_at: null,
          error_message: null,
          updated_at: new Date().toISOString()
        }, { onConflict: 'sync_type' });

      syncStatus = {
        id: syncStatus?.id || '',
        status: 'running',
        last_offset: 0,
        total_processed: 0,
        total_created: 0,
        total_updated: 0,
        total_skipped: 0,
        months: requestedMonths,
        start_date: startDate.toISOString().split('T')[0],
        end_date: now.toISOString().split('T')[0],
        error_message: null,
        last_run_at: new Date().toISOString(),
        completed_at: null
      };
    } else if (syncStatus.status === 'completed') {
      // Already completed, nothing to do unless force restart
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Sincronização já foi concluída',
          total_processed: syncStatus.total_processed,
          total_created: syncStatus.total_created,
          status: 'completed'
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } else if (syncStatus.status === 'running' && !isAutoMode) {
      // Continue from where we left off
      await updateSyncStatus(supabase, { last_run_at: new Date().toISOString() });
    }

    const startDateStr = syncStatus!.start_date!;
    const endDateStr = syncStatus!.end_date!;
    let offset = syncStatus!.last_offset;
    let totalProcessed = syncStatus!.total_processed;
    let totalCreated = syncStatus!.total_created;
    let totalUpdated = syncStatus!.total_updated;
    let totalSkipped = syncStatus!.total_skipped;

    console.log(`Continuing sync from offset ${offset}, period: ${startDateStr} to ${endDateStr}`);

    // Get categories and accounts
    const { data: categoriasData } = await supabase
      .from('fin_categorias')
      .select('id, nome, tipo')
      .eq('ativa', true);

    const categorias = categoriasData as Categoria[] | null;

    // Get all active accounts to map bank_account from ADVBox
    const { data: contas } = await supabase
      .from('fin_contas')
      .select('id, nome')
      .eq('ativa', true);

    // Build a map of account names to IDs for matching
    const contasMap = new Map<string, string>();
    (contas as ContaBancaria[] | null)?.forEach(c => {
      contasMap.set(c.nome.toLowerCase(), c.id);
    });
    
    console.log(`Loaded ${contasMap.size} active bank accounts for mapping`);
    
    // Get a system user for created_by field (first admin user found from user_roles table)
    const { data: systemUserData } = await supabase
      .from('user_roles')
      .select('user_id')
      .eq('role', 'admin')
      .limit(1);
    
    const systemUserId = (systemUserData as Array<{ user_id: string }> | null)?.[0]?.user_id;
    
    if (!systemUserId) {
      console.error('No system user found for created_by field');
      return new Response(
        JSON.stringify({ success: false, message: 'Nenhum usuário administrador encontrado para atribuir os lançamentos' }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    const categoriaMap = new Map<string, { id: string; tipo: string }>();
    categorias?.forEach(c => {
      categoriaMap.set(c.nome.toLowerCase(), { id: c.id, tipo: c.tipo });
    });

    // Process batches until timeout or completion
    const fetchLimit = 100;
    let hasMore = true;
    let batchCount = 0;

    while (hasMore) {
      // Check timeout
      if (Date.now() - startTime > MAX_EXECUTION_TIME) {
        console.log(`Timeout reached after ${batchCount} batches, saving progress at offset ${offset}`);
        
        await updateSyncStatus(supabase, {
          status: 'running',
          last_offset: offset,
          total_processed: totalProcessed,
          total_created: totalCreated,
          total_updated: totalUpdated,
          total_skipped: totalSkipped,
          last_run_at: new Date().toISOString()
        });

        return new Response(
          JSON.stringify({
            success: true,
            status: 'running',
            message: `Sincronização em andamento: ${totalProcessed} registros processados, ${totalCreated} criados. Continuará automaticamente...`,
            total_processed: totalProcessed,
            total_created: totalCreated,
            total_updated: totalUpdated,
            total_skipped: totalSkipped,
            current_offset: offset,
            batches_this_run: batchCount
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (batchCount > 0) {
        await sleep(500); // Small delay between batches
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

        const { created, updated, skipped } = await processTransactionsBatch(
          supabase,
          items,
          categoriaMap,
          categorias,
          contasMap,
          systemUserId
        );

        totalCreated += created;
        totalUpdated += updated;
        totalSkipped += skipped;
        totalProcessed += items.length;
        offset += fetchLimit;
        hasMore = more;
        batchCount++;

        console.log(`Batch ${batchCount}: ${items.length} items (${created}c, ${skipped}s), total: ${totalProcessed}`);

        // Update progress every 5 batches
        if (batchCount % 5 === 0) {
          await updateSyncStatus(supabase, {
            last_offset: offset,
            total_processed: totalProcessed,
            total_created: totalCreated,
            total_updated: totalUpdated,
            total_skipped: totalSkipped
          });
        }

      } catch (batchError) {
        console.error(`Batch error:`, batchError);
        
        await updateSyncStatus(supabase, {
          status: 'error',
          error_message: batchError instanceof Error ? batchError.message : 'Erro desconhecido',
          last_offset: offset,
          total_processed: totalProcessed,
          total_created: totalCreated,
          total_updated: totalUpdated,
          total_skipped: totalSkipped
        });

        return new Response(
          JSON.stringify({
            success: false,
            error: batchError instanceof Error ? batchError.message : 'Erro',
            total_processed: totalProcessed,
            total_created: totalCreated,
            current_offset: offset
          }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Sync completed!
    await updateSyncStatus(supabase, {
      status: 'completed',
      last_offset: offset,
      total_processed: totalProcessed,
      total_created: totalCreated,
      total_updated: totalUpdated,
      total_skipped: totalSkipped,
      completed_at: new Date().toISOString()
    });

    // Log completion
    if (userId) {
      await supabase
        .from('audit_log')
        .insert({
          tabela: 'fin_lancamentos',
          acao: 'sync_advbox_complete',
          descricao: `Sincronização ADVBox completa: ${totalCreated} criados, ${totalSkipped} ignorados`,
          usuario_id: userId,
          dados_novos: {
            total: totalProcessed,
            created: totalCreated,
            updated: totalUpdated,
            skipped: totalSkipped,
            period: { start: startDateStr, end: endDateStr }
          }
        } as never);
    }

    console.log(`Sync completed: ${totalCreated} created, ${totalSkipped} skipped`);

    return new Response(
      JSON.stringify({
        success: true,
        status: 'completed',
        message: `Sincronização concluída: ${totalCreated} registros criados, ${totalSkipped} já existentes`,
        total_processed: totalProcessed,
        total_created: totalCreated,
        total_updated: totalUpdated,
        total_skipped: totalSkipped
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
