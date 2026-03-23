

# Mostrar nome do autor nos registros de humor

## Problema
A tabela "Registros" na aba "Meu Histórico" mostra apenas Data, Humor e Observações — sem o nome de quem registrou. Além disso, a aba "Visão Geral" (gestores) não tem tabela detalhada com nomes.

## Solução

### 1. Alterar a query `myHistory` para incluir o nome do perfil
- Trocar `.select('*')` por `.select('*, profiles:user_id(full_name)')` para trazer o nome junto.

### 2. Adicionar coluna "Nome" na tabela de registros
- Inserir uma coluna `<TableHead>Nome</TableHead>` na tabela existente.
- Exibir `entry.profiles?.full_name` em cada linha.
- Ajustar `colSpan` da linha "Sem registros" de 3 para 4.

### 3. Adicionar tabela detalhada na aba "Visão Geral" (gestores)
- Abaixo do gráfico de barras, adicionar uma tabela com colunas: Nome, Data, Humor, Observações.
- Usar os dados de `allMoods` que já trazem `profiles:user_id(full_name, position)`.

## Arquivo alterado
| Arquivo | Ação |
|---|---|
| `src/pages/PesquisaHumor.tsx` | Ajustar query e adicionar coluna de nome nas tabelas |

