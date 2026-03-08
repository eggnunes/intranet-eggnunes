

# Diagnóstico: Carregamento de Tarefas no Controle de Prazos

## Dados do Banco

- **5.570 tarefas** sincronizadas do ADVBox (5.233 pendentes, 337 concluídas)
- **Zero duplicatas** — a coluna `advbox_id` é única, então cada tarefa do ADVBox existe apenas uma vez no banco
- **Zero verificações** registradas ainda (tabela `prazo_verificacoes` vazia)

## Problema Identificado: Limite de 1.000 Linhas

A consulta na página `ControlePrazos.tsx` (linha 88-91) **não especifica um limite**, então o banco retorna no máximo **1.000 registros** (limite padrão). Isso significa que **4.570 tarefas estão sendo ignoradas** e não aparecem na tela.

## Sobre Duplicidade

Não há risco de duplicidade. A sincronização usa `upsert` com `onConflict: 'advbox_id'`, garantindo que cada tarefa do ADVBox exista apenas uma vez. A planilha do SharePoint não é importada separadamente — os dados vêm exclusivamente da API do ADVBox. Se uma tarefa está na planilha e no ADVBox, ela aparece apenas uma vez.

## Solução

### Arquivo: `src/pages/ControlePrazos.tsx`

1. **Paginação na query** — Implementar carregamento de todas as tarefas com múltiplas queries de 1.000 registros cada (loop até buscar tudo), ou adicionar paginação na interface (páginas de 50/100 itens)
2. **Abordagem recomendada**: Paginação na interface com controles de página (mais performático para 5.570+ registros), mantendo os filtros server-side quando possível

### Detalhes técnicos
- Adicionar `.range(from, to)` na query com controle de página
- Exibir controles de paginação (anterior/próximo/total)
- Manter contagem total com query separada `count`
- Os filtros de exclusão de task_type e "Mariana" continuam aplicados client-side após a busca

### Filtro de task_types
O filtro de exclusão já funciona corretamente — usa `.includes()` então "ACOMPANHAR DECISÃO" filtra tanto tarefas com tipo exato quanto "ACOMPANHAR DECISÃO/DESPACHO" (1.102 tarefas serão corretamente excluídas).

