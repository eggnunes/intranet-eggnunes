import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ScoringRule {
  id: string;
  field_name: string;
  field_value: string;
  operator: string;
  points: number;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log("Iniciando lead scoring automático...");

    // Buscar regras ativas de scoring
    const { data: rules, error: rulesError } = await supabase
      .from('crm_lead_scoring_rules')
      .select('*')
      .eq('is_active', true);

    if (rulesError) throw rulesError;

    if (!rules || rules.length === 0) {
      console.log("Nenhuma regra de scoring ativa");
      return new Response(
        JSON.stringify({ success: true, message: "Nenhuma regra ativa" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Buscar contatos que não foram pontuados recentemente (últimas 24h)
    const ontem = new Date();
    ontem.setDate(ontem.getDate() - 1);

    const { data: contacts, error: contactsError } = await supabase
      .from('crm_contacts')
      .select('*')
      .or(`updated_at.lt.${ontem.toISOString()},lead_score.is.null`);

    if (contactsError) throw contactsError;

    if (!contacts || contacts.length === 0) {
      console.log("Nenhum contato para pontuar");
      return new Response(
        JSON.stringify({ success: true, message: "Nenhum contato para pontuar" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Buscar atividades dos contatos para pontuação adicional
    const { data: activities } = await supabase
      .from('crm_activities')
      .select('contact_id, type, completed')
      .in('contact_id', contacts.map(c => c.id));

    // Buscar deals dos contatos
    const { data: deals } = await supabase
      .from('crm_deals')
      .select('contact_id, value, won')
      .in('contact_id', contacts.map(c => c.id));

    let atualizados = 0;
    const detalhes: { nome: string; scoreAntigo: number | null; scoreNovo: number }[] = [];

    for (const contact of contacts) {
      let score = 0;
      const scoreAntigo = contact.lead_score;

      // Aplicar regras de campos
      for (const rule of rules as ScoringRule[]) {
        const fieldValue = (contact as Record<string, unknown>)[rule.field_name];
        if (!fieldValue || typeof fieldValue !== 'string') continue;

        let matches = false;
        switch (rule.operator) {
          case 'equals':
            matches = fieldValue.toLowerCase() === rule.field_value.toLowerCase();
            break;
          case 'contains':
            matches = fieldValue.toLowerCase().includes(rule.field_value.toLowerCase());
            break;
          case 'not_equals':
            matches = fieldValue.toLowerCase() !== rule.field_value.toLowerCase();
            break;
        }

        if (matches) {
          score += rule.points;
        }
      }

      // Pontuação por atividades
      const contactActivities = activities?.filter(a => a.contact_id === contact.id) || [];
      const completedActivities = contactActivities.filter(a => a.completed).length;
      
      // +5 pontos por atividade completada (max 50)
      score += Math.min(completedActivities * 5, 50);

      // Pontuação por deals
      const contactDeals = deals?.filter(d => d.contact_id === contact.id) || [];
      
      // +20 pontos se tem deal ativo
      if (contactDeals.length > 0) score += 20;
      
      // +50 pontos se tem deal ganho
      if (contactDeals.some(d => d.won === true)) score += 50;

      // Pontuação por completude do perfil
      if (contact.email) score += 5;
      if (contact.phone) score += 5;
      if (contact.company) score += 10;
      if (contact.city) score += 3;
      if (contact.notes) score += 5;

      // Pontuação por fonte de tráfego
      if (contact.utm_source === 'google') score += 10;
      if (contact.utm_source === 'facebook') score += 8;
      if (contact.utm_medium === 'cpc') score += 15;

      // Atualizar score se mudou
      if (score !== scoreAntigo) {
        await supabase
          .from('crm_contacts')
          .update({ 
            lead_score: score,
            updated_at: new Date().toISOString()
          })
          .eq('id', contact.id);

        atualizados++;
        detalhes.push({
          nome: contact.name,
          scoreAntigo,
          scoreNovo: score
        });
      }
    }

    console.log(`Lead scoring concluído: ${atualizados} contatos atualizados`);

    return new Response(
      JSON.stringify({
        success: true,
        totalContatos: contacts.length,
        regrasAplicadas: rules.length,
        atualizados,
        topScores: detalhes
          .sort((a, b) => b.scoreNovo - a.scoreNovo)
          .slice(0, 10)
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("Erro no lead scoring:", error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
