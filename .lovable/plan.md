

## Melhorias na Pesquisa de Humor — Baseado nas Referências

### O que falta no sistema atual (comparando com os prints)

| Recurso | Referência | Sistema Atual |
|---------|-----------|---------------|
| Cards de contagem por humor com barra de progresso | Image 1 | Apenas gráfico de barras |
| Score médio do ciclo (ex: 4.5/5 "Excelente") | Image 1 | Ausente |
| Cabeçalho de ciclo (período, total colaboradores, dias com registro, total respostas) | Image 1 | Ausente |
| Gráfico de pizza — Distribuição Geral | Image 1 | Ausente (só barras) |
| Gráfico radar — Score por Departamento | Image 1 | Ausente |
| Gráfico de barras horizontais — Humor por Departamento (stacked) | Image 2 | Ausente |
| Gráfico de barras empilhadas — Evolução Diária | Image 2 | Ausente |
| Timeline de registros — cards agrupados por dia com avatar, nome, departamento e comentário | Image 3 | Apenas tabela |
| Filtro de período (Mensal + seletor de mês) | Image 1 | Fixo em 30 dias |

### Plano de implementação

**Arquivo:** `src/pages/PesquisaHumor.tsx`

1. **Filtro de período mensal** — Adicionar seletor de mês/ano no header. A query de `allMoods` passará a filtrar pelo mês selecionado em vez de "últimos 30 dias"

2. **Cabeçalho de ciclo** — Card no topo da aba "Visão Geral" mostrando: nome do mês, total de colaboradores com registro, dias únicos com registro, total de respostas, e score médio (média dos scores de todos os registros do período) com classificação textual (Excelente/Bom/Regular/Ruim)

3. **Cards de contagem por humor** — Grid de 5 cards (um por mood), cada um com emoji, contagem, label, e barra de progresso colorida mostrando a porcentagem relativa ao total

4. **Gráfico de pizza — Distribuição Geral** — `PieChart` do Recharts substituindo ou complementando o bar chart atual, com labels de porcentagem e cores por humor

5. **Gráfico radar — Score por Departamento** — `RadarChart` do Recharts mostrando o score médio de cada departamento (position do profile) nos eixos do radar

6. **Gráfico de barras horizontais — Humor por Departamento** — `BarChart` horizontal com barras empilhadas por tipo de humor, agrupadas por departamento

7. **Gráfico de evolução diária** — `BarChart` vertical com barras empilhadas por dia, mostrando a distribuição de humores em cada dia do período, com legenda colorida

8. **Timeline de registros por dia** — Substituir a tabela detalhada por uma visualização em timeline: registros agrupados por data (ex: "quinta-feira, 26 de fevereiro (3 registros)"), cada entrada mostrando avatar colorido pelo humor, nome em destaque, departamento como badge, e observação (se houver)

### Detalhes técnicos

- Importar `PieChart, Pie, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis` do Recharts
- O score médio será calculado como `allMoods.reduce((sum, m) => sum + getMoodInfo(m.mood).score, 0) / allMoods.length`
- O filtro de mês usará `useState` com mês/ano atuais como default, e a query filtrará por `survey_date` entre o primeiro e último dia do mês
- Os departamentos serão extraídos do campo `profiles.position` já disponível na query
- A timeline agrupará por `survey_date` usando `Object.groupBy` ou reduce manual
- Manter a aba "Meu Histórico" sem alterações
- Manter os alertas de humor baixo existentes

