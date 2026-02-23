

# Enriquecimento de Publicações: Cliente + Vara/Órgão Julgador

## Diagnóstico

Analisei os dados e descobri informações importantes:

1. **Vara/Órgão Julgador**: A API do Comunica PJe **já retorna** essa informação no campo `nomeOrgao` (ex: "42ª VARA DO TRABALHO DE BELO HORIZONTE", "Unidade Jurisdicional da Comarca de Nova Lima"), mas o sistema está ignorando esse campo e salvando apenas a sigla do tribunal (ex: TRT3, TJMG).

2. **Nome do Cliente**: Não vem da API do Comunica PJe, mas está disponível no banco de dados via AdvBox (`advbox_tasks.raw_data.lawsuit.customers`).

## Mudanças Planejadas

### 1. Salvar o órgão julgador junto com o tribunal (Edge Functions)

Nas duas edge functions (`pje-publicacoes` e `sync-pje-publicacoes`), alterar o mapeamento do campo `tribunal` para incluir o `nomeOrgao`:

- **Antes**: `tribunal: item.siglaTribunal || ''` (resultado: "TRT3")
- **Depois**: `tribunal: item.nomeOrgao ? \`${item.siglaTribunal} - ${item.nomeOrgao}\` : item.siglaTribunal || ''` (resultado: "TRT3 - 42ª VARA DO TRABALHO DE BELO HORIZONTE")

Isso resolve o problema da vara sem precisar de cruzamento com o AdvBox.

### 2. Enriquecer com nome do cliente automaticamente (Edge Functions)

Após inserir registros do Comunica PJe, cruzar os números de processo com `advbox_tasks` para preencher o campo `destinatario` (nome do cliente):

- Buscar todos os `numero_processo` dos registros recém-inseridos que estejam sem `destinatario`
- Consultar `advbox_tasks` pelo `process_number` correspondente
- Extrair nomes de `raw_data.lawsuit.customers[].name`
- Atualizar o campo `destinatario` com os nomes

### 3. Atualizar registros existentes (110 publicações já importadas)

Os 110 registros já importados do Comunica PJe serão atualizados automaticamente quando o usuário clicar em "Enriquecer Dados" ou na próxima sincronização automática.

### 4. Frontend - Chamar enriquecimento automático

Após busca no Comunica PJe, disparar automaticamente a action `enrich-existing` em segundo plano.

## Detalhes Técnicos

### Arquivos modificados

1. **`supabase/functions/pje-publicacoes/index.ts`**
   - Na action `search-comunicapje`: alterar mapeamento de `tribunal` para incluir `nomeOrgao`
   - Adicionar etapa de enriquecimento de clientes após upsert

2. **`supabase/functions/sync-pje-publicacoes/index.ts`**
   - Alterar mapeamento de `tribunal` para incluir `nomeOrgao`
   - Adicionar etapa de enriquecimento de clientes após upsert do Comunica PJe

3. **`src/pages/PublicacoesDJE.tsx`**
   - Após busca no Comunica PJe, chamar `enrich-existing` automaticamente

### Formato do campo tribunal após alteração

```text
Antes:  "TRT3"
Depois: "TRT3 - 42ª VARA DO TRABALHO DE BELO HORIZONTE"

Antes:  "TJMG"
Depois: "TJMG - Unidade Jurisdicional da Comarca de Nova Lima"
```

### Lógica de enriquecimento de clientes

```text
1. SELECT DISTINCT numero_processo FROM publicacoes inseridas WHERE destinatario = ''
2. Para cada numero_processo:
   a. Buscar em advbox_tasks WHERE process_number = numero_processo
   b. Extrair raw_data -> lawsuit -> customers -> [].name
   c. UPDATE publicacoes_dje SET destinatario = nomes WHERE numero_processo = X AND destinatario = ''
```
