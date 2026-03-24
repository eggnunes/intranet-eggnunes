

## Problema

O ranking de vendedores no CRM apresenta dois problemas:

1. **Sem filtro de período** — busca TODOS os deals históricos, sem aplicar o ciclo comercial (dia 25 ao dia 24)
2. **Inclui não-vendedores** — Rafael (sócio) aparece no ranking mesmo não sendo do comercial
3. **Sem indicação do período** — não mostra qual período está sendo contabilizado
4. **Sem total de contratos** — não exibe o total consolidado do período

## Plano de correção

### Arquivo: `src/components/crm/CRMRanking.tsx`

1. **Calcular o ciclo comercial vigente** — Reutilizar a mesma lógica já presente no `CRMDashboard.tsx`: se dia atual >= 25, período = dia 25 do mês atual até dia 24 do próximo; caso contrário, dia 25 do mês anterior até dia 24 do mês atual

2. **Filtrar deals por período** — Adicionar `.gte('closed_at', periodStart)` e `.lte('closed_at', periodEnd)` na query de `crm_deals`, buscando apenas deals fechados dentro do ciclo vigente

3. **Filtrar atividades por período** — Aplicar o mesmo filtro de data nas `crm_activities` usando o campo `created_at`

4. **Excluir Rafael do ranking** — Filtrar pelo nome "Rafael Egg Nunes" (ou pelo e-mail `rafael@eggnunes.com.br`) após carregar os perfis, removendo-o da lista antes de montar as estatísticas

5. **Exibir período no header** — Adicionar um subtítulo/badge abaixo do título "Ranking de Vendedores" mostrando "Período: 25/02/2026 a 24/03/2026"

6. **Exibir total de contratos fechados** — Adicionar um card/badge de destaque mostrando o total consolidado de fechamentos no período (soma de todos os vendedores)

### Detalhes técnicos

- A lógica do ciclo comercial será extraída como função auxiliar dentro do componente (mesma lógica do CRMDashboard)
- O filtro de exclusão usará o nome do perfil com `.toLowerCase().includes('rafael egg')`
- O total será calculado como `sorted.reduce((acc, s) => acc + s.closings, 0)` e exibido acima da lista

