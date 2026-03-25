

## Separar leads por qualificação no TV Mode

### O que será feito
Substituir o KPI único "Leads no Período" por 3 contadores separados: **Qualificado**, **Indefinido** e **Desqualificado**, baseados nos estágios do funil do RD Station.

### Classificação (baseada nos estágios do pipeline)
- **Qualificado**: Deals nos estágios 3-8 (Pre-operacional → Fechamento) — passaram pela qualificação
- **Indefinido**: Deals nos estágios 1-2 (Recepção/apresentação, Qualificar) — ainda em avaliação
- **Desqualificado**: Deals no estágio 10 (Desqualificados) + estágio 9 (C. Perdidos)

### Implementação

**Arquivo: `src/pages/TVMode.tsx`**

1. **Nova query** `tv-leads-by-qualification` que busca deals no período com seus `stage_id`, faz JOIN lógico com os stages já carregados, e classifica em 3 grupos

2. **Substituir o KPI "Leads no Período"** por 3 KPI cards menores:
   - Qualificados (ícone UserCheck, cor verde)
   - Indefinidos (ícone UserMinus, cor amarela)  
   - Desqualificados (ícone UserX, cor vermelha)

3. **Ajustar o grid de KPIs** de 4 colunas para 6 colunas (3 novos de qualificação + Contratos Fechados + Valor Fechado + Taxa de Conversão), mantendo layout proporcional para TV

4. **Incluir no auto-refresh** a nova query

