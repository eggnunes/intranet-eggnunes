

## Remover gráfico de pizza "Fechamentos por Tipo de Ação" do Ranking CRM

### O que será feito
Remover o gráfico de pizza (Pie Chart) que mostra "Fechamentos por Tipo de Ação", mantendo apenas o gráfico de barras "Fechamentos por Vendedor".

### Implementação

**Arquivo: `src/components/crm/CRMRanking.tsx`**

1. **Remover o bloco do Pie Chart** (linhas 395-430) — o Card inteiro com o PieChart
2. **Remover o grid de 2 colunas** — mudar `grid-cols-1 lg:grid-cols-2` para apenas o card do bar chart sem grid wrapper (já que sobra só um gráfico)
3. **Limpar imports não usados**: remover `PieChart, Pie, Legend` do import do recharts
4. **Remover `PIE_COLORS`** (linha 61) e o `productChartData` useMemo (linhas 218-230 aprox.)

### Resultado
Apenas o gráfico de barras dos vendedores permanece, limpo e legível.

