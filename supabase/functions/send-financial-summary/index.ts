import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const FROM_EMAIL = "notificacoes@intraneteggnunes.com.br";

interface SummaryData {
  periodo: string;
  totalReceitas: number;
  totalDespesas: number;
  lucro: number;
  margemLucro: number;
  contasPendentes: number;
  contasVencidas: number;
  totalPendente: number;
  totalVencido: number;
  topDespesas: { categoria: string; valor: number }[];
  topReceitas: { categoria: string; valor: number }[];
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { tipo = 'diario' } = await req.json().catch(() => ({}));
    
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const hoje = new Date();
    let dataInicio: Date;
    let periodoLabel: string;

    switch (tipo) {
      case 'semanal':
        dataInicio = new Date(hoje);
        dataInicio.setDate(hoje.getDate() - 7);
        periodoLabel = 'Última Semana';
        break;
      case 'mensal':
        dataInicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
        periodoLabel = 'Mês Atual';
        break;
      case 'diario':
      default:
        dataInicio = new Date(hoje);
        dataInicio.setDate(hoje.getDate() - 1);
        periodoLabel = 'Último Dia';
    }

    const dataInicioStr = dataInicio.toISOString().split('T')[0];
    const hojeStr = hoje.toISOString().split('T')[0];

    // Buscar lançamentos do período
    const { data: lancamentos } = await supabase
      .from('fin_lancamentos')
      .select(`
        tipo, valor, status, data_vencimento,
        categoria:fin_categorias(nome)
      `)
      .gte('data_lancamento', dataInicioStr)
      .lte('data_lancamento', hojeStr)
      .is('deleted_at', null);

    // Buscar pendentes e vencidos
    const { data: pendentes } = await supabase
      .from('fin_lancamentos')
      .select('valor, data_vencimento')
      .eq('status', 'pendente')
      .is('deleted_at', null);

    // Calcular métricas
    const receitasPagas = lancamentos?.filter(l => l.tipo === 'receita' && l.status === 'pago') || [];
    const despesasPagas = lancamentos?.filter(l => l.tipo === 'despesa' && l.status === 'pago') || [];

    const totalReceitas = receitasPagas.reduce((acc, l) => acc + Number(l.valor), 0);
    const totalDespesas = despesasPagas.reduce((acc, l) => acc + Number(l.valor), 0);
    const lucro = totalReceitas - totalDespesas;
    const margemLucro = totalReceitas > 0 ? (lucro / totalReceitas) * 100 : 0;

    // Pendentes e vencidos
    const vencidos = pendentes?.filter(p => p.data_vencimento && p.data_vencimento < hojeStr) || [];
    const pendentesFuturos = pendentes?.filter(p => !p.data_vencimento || p.data_vencimento >= hojeStr) || [];

    const totalVencido = vencidos.reduce((acc, l) => acc + Number(l.valor), 0);
    const totalPendente = pendentesFuturos.reduce((acc, l) => acc + Number(l.valor), 0);

    // Top categorias
    const despesasPorCategoria = new Map<string, number>();
    despesasPagas.forEach(l => {
      const categoria = l.categoria as unknown as { nome: string } | null;
      const cat = categoria?.nome || 'Sem categoria';
      despesasPorCategoria.set(cat, (despesasPorCategoria.get(cat) || 0) + Number(l.valor));
    });
    const topDespesas = Array.from(despesasPorCategoria.entries())
      .map(([categoria, valor]) => ({ categoria, valor }))
      .sort((a, b) => b.valor - a.valor)
      .slice(0, 5);

    const receitasPorCategoria = new Map<string, number>();
    receitasPagas.forEach(l => {
      const categoria = l.categoria as unknown as { nome: string } | null;
      const cat = categoria?.nome || 'Sem categoria';
      receitasPorCategoria.set(cat, (receitasPorCategoria.get(cat) || 0) + Number(l.valor));
    });
    const topReceitas = Array.from(receitasPorCategoria.entries())
      .map(([categoria, valor]) => ({ categoria, valor }))
      .sort((a, b) => b.valor - a.valor)
      .slice(0, 5);

    const summaryData: SummaryData = {
      periodo: periodoLabel,
      totalReceitas,
      totalDespesas,
      lucro,
      margemLucro,
      contasPendentes: pendentesFuturos.length,
      contasVencidas: vencidos.length,
      totalPendente,
      totalVencido,
      topDespesas,
      topReceitas
    };

    // Buscar usuários que devem receber notificação
    const { data: preferences } = await supabase
      .from('email_notification_preferences')
      .select('user_id')
      .eq('notify_financial', true);

    if (!preferences || preferences.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'Nenhum destinatário configurado' }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userIds = preferences.map(p => p.user_id);
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, email, full_name')
      .in('id', userIds);

    const formatCurrency = (value: number) => {
      return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
    };

    // Enviar emails
    let enviados = 0;
    for (const profile of profiles || []) {
      if (!profile.email) continue;

      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #10B981, #059669); color: white; padding: 20px; border-radius: 8px 8px 0 0; }
            .content { background: #f9f9f9; padding: 20px; border-radius: 0 0 8px 8px; }
            .metric { background: white; padding: 15px; margin: 10px 0; border-radius: 8px; border-left: 4px solid #10B981; }
            .metric.warning { border-left-color: #F59E0B; }
            .metric.danger { border-left-color: #EF4444; }
            .metric-value { font-size: 24px; font-weight: bold; }
            .metric-label { color: #666; font-size: 14px; }
            .positive { color: #10B981; }
            .negative { color: #EF4444; }
            .section { margin-top: 20px; }
            .section-title { font-size: 16px; font-weight: bold; margin-bottom: 10px; }
            .list-item { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #eee; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1 style="margin: 0;">📊 Resumo Financeiro</h1>
              <p style="margin: 5px 0 0 0; opacity: 0.9;">${summaryData.periodo}</p>
            </div>
            <div class="content">
              <div class="metric">
                <div class="metric-label">Receitas</div>
                <div class="metric-value positive">${formatCurrency(summaryData.totalReceitas)}</div>
              </div>
              
              <div class="metric">
                <div class="metric-label">Despesas</div>
                <div class="metric-value negative">${formatCurrency(summaryData.totalDespesas)}</div>
              </div>
              
              <div class="metric" style="border-left-color: ${summaryData.lucro >= 0 ? '#10B981' : '#EF4444'}">
                <div class="metric-label">Lucro</div>
                <div class="metric-value ${summaryData.lucro >= 0 ? 'positive' : 'negative'}">${formatCurrency(summaryData.lucro)}</div>
                <div class="metric-label">Margem: ${summaryData.margemLucro.toFixed(1)}%</div>
              </div>
              
              ${summaryData.contasVencidas > 0 ? `
              <div class="metric danger">
                <div class="metric-label">⚠️ Contas Vencidas</div>
                <div class="metric-value negative">${formatCurrency(summaryData.totalVencido)}</div>
                <div class="metric-label">${summaryData.contasVencidas} lançamento(s)</div>
              </div>
              ` : ''}
              
              ${summaryData.contasPendentes > 0 ? `
              <div class="metric warning">
                <div class="metric-label">📅 Contas Pendentes</div>
                <div class="metric-value">${formatCurrency(summaryData.totalPendente)}</div>
                <div class="metric-label">${summaryData.contasPendentes} lançamento(s)</div>
              </div>
              ` : ''}
              
              ${summaryData.topDespesas.length > 0 ? `
              <div class="section">
                <div class="section-title">Top Despesas por Categoria</div>
                ${summaryData.topDespesas.map(d => `
                  <div class="list-item">
                    <span>${d.categoria}</span>
                    <span class="negative">${formatCurrency(d.valor)}</span>
                  </div>
                `).join('')}
              </div>
              ` : ''}
              
              ${summaryData.topReceitas.length > 0 ? `
              <div class="section">
                <div class="section-title">Top Receitas por Categoria</div>
                ${summaryData.topReceitas.map(r => `
                  <div class="list-item">
                    <span>${r.categoria}</span>
                    <span class="positive">${formatCurrency(r.valor)}</span>
                  </div>
                `).join('')}
              </div>
              ` : ''}
              
              <p style="margin-top: 20px; font-size: 12px; color: #999;">
                Este é um email automático do Sistema Financeiro da Egg Nunes Advocacia.
              </p>
            </div>
          </div>
        </body>
        </html>
      `;

      if (RESEND_API_KEY) {
        try {
          const res = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${RESEND_API_KEY}`,
            },
            body: JSON.stringify({
              from: `Egg Nunes Financeiro <${FROM_EMAIL}>`,
              to: [profile.email],
              subject: `📊 Resumo Financeiro - ${summaryData.periodo}`,
              html,
            }),
          });

          if (res.ok) {
            enviados++;
            console.log(`Email enviado para ${profile.email}`);
          }
        } catch (err) {
          console.error(`Erro ao enviar para ${profile.email}:`, err);
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        enviados,
        summary: summaryData
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("Erro:", error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
