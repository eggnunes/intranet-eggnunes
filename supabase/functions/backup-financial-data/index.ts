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

    console.log("Iniciando backup financeiro automático...");

    const hoje = new Date().toISOString().split('T')[0];
    const tabelas = [
      'fin_lancamentos',
      'fin_categorias', 
      'fin_contas',
      'fin_clientes',
      'fin_setores',
      'fin_recorrencias',
      'fin_metas',
      'fin_orcamentos',
      'fin_contratos'
    ];

    // Criar registro de backup
    const { data: backupRecord, error: insertError } = await supabase
      .from('fin_backups')
      .insert({
        tipo: 'automatico',
        status: 'processando',
        tabelas_incluidas: tabelas
      })
      .select()
      .single();

    if (insertError) throw insertError;

    const backupId = backupRecord.id;
    const backupData: Record<string, unknown[]> = {};
    let totalRegistros = 0;

    // Coletar dados de cada tabela
    for (const tabela of tabelas) {
      try {
        const { data, error } = await supabase
          .from(tabela)
          .select('*');

        if (error) {
          console.warn(`Erro ao buscar ${tabela}:`, error.message);
          backupData[tabela] = [];
        } else {
          backupData[tabela] = data || [];
          totalRegistros += (data?.length || 0);
        }
      } catch (err) {
        console.warn(`Erro ao processar ${tabela}:`, err);
        backupData[tabela] = [];
      }
    }

    // Criar arquivo JSON do backup
    const backupContent = JSON.stringify({
      createdAt: new Date().toISOString(),
      tabelas: tabelas,
      totalRegistros: totalRegistros,
      dados: backupData
    }, null, 2);

    const backupBlob = new Blob([backupContent], { type: 'application/json' });
    const fileName = `backup_financeiro_${hoje}_${Date.now()}.json`;

    // Upload para storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('documents')
      .upload(`backups/${fileName}`, backupBlob, {
        contentType: 'application/json',
        upsert: true
      });

    if (uploadError) {
      console.error('Erro no upload:', uploadError);
      // Atualizar status como erro
      await supabase
        .from('fin_backups')
        .update({
          status: 'erro',
          erro_mensagem: uploadError.message
        })
        .eq('id', backupId);
      throw uploadError;
    }

    // Obter URL do arquivo
    const { data: urlData } = supabase.storage
      .from('documents')
      .getPublicUrl(`backups/${fileName}`);

    // Atualizar registro com sucesso
    await supabase
      .from('fin_backups')
      .update({
        status: 'concluido',
        arquivo_url: urlData?.publicUrl || `backups/${fileName}`,
        tamanho_bytes: backupBlob.size
      })
      .eq('id', backupId);

    // Criar alerta de sucesso
    await supabase
      .from('fin_alertas')
      .insert({
        tipo: 'backup_sucesso',
        mensagem: `Backup automático concluído com ${totalRegistros} registros`,
        data_alerta: hoje
      });

    // Limpar backups antigos (manter últimos 30 dias)
    const dataLimite = new Date();
    dataLimite.setDate(dataLimite.getDate() - 30);

    const { data: backupsAntigos } = await supabase
      .from('fin_backups')
      .select('id, arquivo_url')
      .lt('created_at', dataLimite.toISOString())
      .eq('status', 'concluido');

    if (backupsAntigos && backupsAntigos.length > 0) {
      for (const backup of backupsAntigos) {
        // Deletar arquivo do storage
        if (backup.arquivo_url?.includes('backups/')) {
          const filePath = backup.arquivo_url.split('backups/')[1];
          await supabase.storage.from('documents').remove([`backups/${filePath}`]);
        }
        // Deletar registro
        await supabase.from('fin_backups').delete().eq('id', backup.id);
      }
      console.log(`${backupsAntigos.length} backups antigos removidos`);
    }

    console.log(`Backup concluído: ${totalRegistros} registros em ${tabelas.length} tabelas`);

    return new Response(
      JSON.stringify({
        success: true,
        backupId,
        totalRegistros,
        tabelas: tabelas.length,
        fileName
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("Erro no backup:", error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
