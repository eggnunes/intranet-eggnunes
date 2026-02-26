

## Diagnóstico

A tabela `advbox_customers` tem **0 registros**. A sincronização nunca completa porque:

1. A edge function `sync-advbox-customers` tenta buscar TODOS os ~9500 clientes da API (100 por página, 1.5s entre requests = ~150 segundos) e só depois faz o upsert
2. Edge functions têm timeout de ~60 segundos — a função é encerrada (`shutdown`) antes de completar a busca, e nenhum dado é salvo
3. Os logs confirmam: chega até offset ~2400 e recebe `shutdown`

## Solução

### 1. Reescrever `sync-advbox-customers` com upsert incremental

Mudar a estratégia de "buscar tudo, depois salvar" para "buscar uma página, salvar imediatamente". Assim cada batch de 100 clientes é persistido antes de buscar o próximo. Se o timeout ocorrer, os dados já salvos permanecem no banco.

- Mover o upsert para DENTRO do loop de paginação (após cada fetch de 100 registros)
- Reduzir delay entre requests para 500ms (a API permite)
- Adicionar controle de tempo: parar graciosamente após 50 segundos para evitar timeout abrupto
- Retornar resposta parcial indicando progresso

### 2. Frontend: mostrar progresso e permitir múltiplas sincronizações

Em `DecisoesFavoraveis.tsx`:
- Mostrar contador de clientes carregados: "X clientes disponíveis"
- Quando tabela estiver vazia e o usuário clicar em sincronizar, exibir mensagem "Sincronizando... pode levar alguns cliques para importar todos os clientes"
- Após sincronização parcial, refetch automático para mostrar os dados já salvos

### Arquivos a modificar

- `supabase/functions/sync-advbox-customers/index.ts` — upsert incremental dentro do loop
- `src/pages/DecisoesFavoraveis.tsx` — UI de feedback de progresso

