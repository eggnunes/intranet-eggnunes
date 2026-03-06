

# Plano: Adicionar filtro por data específica nas Publicações DJE

## Problema
O filtro de período nos resultados só oferece opções predefinidas (7, 30, 90 dias). Não é possível filtrar por um dia específico ou intervalo customizado.

## Solução
Substituir o dropdown de período por um filtro mais completo que inclua:
1. **Opções rápidas** mantidas (7, 30, 90 dias, todo período)
2. **Data específica** — filtrar publicações de um único dia
3. **Intervalo customizado** — data início e data fim nos resultados (client-side)
4. **Filtro por advogado** nos resultados (client-side) — útil quando há publicações de múltiplos advogados

## Alterações

**Arquivo**: `src/pages/PublicacoesDJE.tsx`

1. **Novo estado** `filtroPeriodo` passa a aceitar também `'custom'` e `'dia'`, com estados auxiliares `filtroDataDia`, `filtroDataCustomInicio`, `filtroDataCustomFim`
2. **Novo filtro por advogado** (client-side) extraído dos dados carregados — dropdown dinâmico com nomes únicos encontrados
3. **UI**: Trocar o select de período por um que inclua "Data específica" e "Intervalo customizado". Quando selecionados, exibir os date inputs inline ao lado
4. **Lógica de filtragem**: No `useMemo`, tratar os novos casos comparando `data_disponibilizacao` com a data escolhida ou intervalo

## Resultado
O usuário poderá filtrar por qualquer dia ou intervalo, além das opções rápidas já existentes, e filtrar por advogado nos resultados.

