

## Redesign do Modo TV

### Problemas identificados
1. **KPIs sem período** — Leads e Contratos Fechados mostram totais históricos, sem contexto temporal
2. **Agendamentos irrelevante** — a equipe não usa agendamentos, KPI sempre zero
3. **Funil ilegível** — 10 estágios com barras minúsculas, "Desqualificados" (1.212) domina o gráfico, estágios ativos ficam invisíveis
4. **Últimas Movimentações** — sidebar sem valor prático para o comercial

### Solução proposta

**Layout:** Header + 4 KPIs + 2 gráficos lado a lado (sem sidebar)

#### KPIs (todos filtrados pelo mês vigente 25→24):
1. **Leads no Período** — contagem de `crm_contacts` criados entre dia 25 e 24
2. **Valor Total Fechado** — soma de `value` dos deals won no período (em R$)
3. **Contratos Fechados** — contagem de deals won no período
4. **Taxa de Conversão** — (fechados / total de deals criados no período) × 100%

Exibir label do período abaixo do header: "Período: 25/02 a 24/03/2026"

#### Gráfico 1 — Funil de Vendas (lado esquerdo):
- **Excluir** "Fechamento", "C. Perdidos" e "Desqualificados" do funil (são estágios terminais, distorcem a visualização)
- Mostrar apenas estágios ativos (1 a 7): Recepção → Assinatura de contrato
- Gráfico de barras horizontais com cores degradê, barSize maior, labels com quantidade

#### Gráfico 2 — Fechamentos por Vendedor (lado direito):
- Gráfico de barras verticais mostrando contratos fechados no período por cada responsável (Daniel, Lucas, Jhonny)
- Cores diferenciadas por vendedor, label de quantidade no topo de cada barra

#### Substituição da sidebar:
- Remover "Últimas Movimentações"
- O espaço é redistribuído para os 2 gráficos lado a lado em fullwidth

### Arquivos alterados
- `src/pages/TVMode.tsx` — reescrever queries com filtro de período 25→24, novos KPIs, novo layout com 2 gráficos

### Detalhes técnicos
- Reutilizar a mesma lógica de cálculo de período do `CRMDashboard.tsx` (dia >= 25 → período deste mês; dia < 25 → período do mês anterior)
- Query de leads: `.gte('created_at', periodStart)` `.lte('created_at', periodEnd)`
- Query de deals won: `.eq('won', true).gte('closed_at', periodStart).lte('closed_at', periodEnd)`
- Taxa de conversão: deals won / total deals criados no período
- Valor total: `SUM(value)` dos deals won no período
- Funil: filtrar `order_index <= 7` para excluir Fechamento/Perdidos/Desqualificados
- Fechamentos por vendedor: usar `RESPONSAVEIS_IDS` fixos (Daniel, Lucas, Jhonny), contar deals won por `owner_id`
- Manter auto-refresh de 30s e relógio

