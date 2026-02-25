

## Diagnóstico

Analisando o código e o screenshot, identifiquei dois problemas que explicam por que o Ederson não aparece:

### Problema 1: Busca limitada a campos mapeados
O filtro de formulários (`formMapped.filter`) só busca em 4 campos: `nomeCompleto`, `cpf`, `email`, `telefone`. Se o mapeamento de colunas falhar (ex: coluna do Google Sheets com nome diferente de "nome completo"), o campo `nomeCompleto` fica vazio e a busca nunca encontra o cliente, mesmo que os dados existam na planilha.

Na edge function `google-sheets-integration`, `getValue('nome completo')` procura um header que **contenha** "nome completo". Se o header da planilha for apenas "Nome" ou "Nome do Cliente", o mapeamento falha silenciosamente e retorna string vazia.

### Problema 2: Sem busca em todos os dados brutos
Quando o mapeamento de coluna falha, não há fallback. O sistema deveria buscar em TODOS os valores da linha, garantindo que qualquer texto digitado encontre a pessoa independente de como as colunas estão nomeadas.

### Solução

**Arquivo 1: `supabase/functions/google-sheets-integration/index.ts`**
- Adicionar campo `allValues` a cada registro: concatenação de todos os valores da linha em uma única string. Isso permite busca em qualquer campo, mesmo que o mapeamento de colunas falhe.
- Adicionar fallback para o campo `nomeCompleto`: se `getValue('nome completo')` retornar vazio, tentar `getValue('nome')` como alternativa.

**Arquivo 2: `src/components/financeiro/asaas/AsaasNovaCobranca.tsx`**
- Atualizar interface `FormCustomer` para incluir `allValues: string`.
- No filtro de formulários, adicionar busca em `c.allValues` como fallback quando nenhum campo específico bate.
- Mostrar contador de formulários carregados ("X formulários carregados") para o usuário saber que os dados foram carregados corretamente.

### Resultado esperado
- Digitar "ederson" encontrará o cliente mesmo que o mapeamento de colunas não tenha capturado o nome no campo `nomeCompleto`.
- A busca varrerá todos os dados da linha do formulário.
- O usuário verá quantos registros de formulário foram carregados.

