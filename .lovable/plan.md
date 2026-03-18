

# Página de Novo Cliente para Viabilidade

## Resumo
Criar nova página `/viabilidade/novo` com formulário completo de cadastro de cliente, análise de viabilidade via IA (Lovable AI) e persistência no banco.

## O que já existe
- Tabela `viabilidade_clientes` com campos: `nome`, `cpf`, `status`, `observacoes`, `created_by`
- Página `/viabilidade` com dashboard e listagem
- Bucket `documents` para uploads

## Implementação

### 1. Migração SQL
Adicionar colunas à tabela `viabilidade_clientes`:
- `data_nascimento` (DATE)
- `telefone` (TEXT)
- `email` (TEXT)
- `endereco` (TEXT)
- `tipo_acao` (TEXT) -- civel, trabalhista, previdenciario, tributario
- `descricao_caso` (TEXT)
- `documentos` (JSONB DEFAULT '[]') -- array de paths no storage
- `parecer_viabilidade` (TEXT) -- resultado da análise IA
- `analise_realizada_em` (TIMESTAMPTZ)

### 2. Nova página `src/pages/ViabilidadeNovo.tsx`
- **Formulário completo**: Nome, CPF (com máscara), Data Nascimento (datepicker), Telefone (máscara), Email, Endereço, Tipo de Ação (Select), Descrição do Caso (Textarea), Upload de Documentos (múltiplo, bucket `documents`)
- **Botão "Analisar Viabilidade"**: chama edge function `analyze-viability` com dados do formulário, usa Lovable AI (gemini-2.5-flash) para gerar parecer jurídico
- **Feedback visual**: Progress bar + skeleton enquanto IA processa
- **Resultado**: Card com parecer da IA, recomendação (viável/inviável/necessita mais dados), pontos relevantes
- **Botão "Salvar"**: insere na `viabilidade_clientes` com status baseado no resultado da análise

### 3. Edge function `supabase/functions/analyze-viability/index.ts`
- Recebe dados do cliente + tipo de ação + descrição
- Chama Lovable AI (gemini-2.5-flash) com prompt jurídico para avaliar viabilidade
- Retorna parecer estruturado (recomendação, justificativa, pontos de atenção)

### 4. Rota no `App.tsx`
- `/viabilidade/novo` com `ProtectedRoute` + `Layout`

### 5. Link na página Viabilidade
- Atualizar botão "Novo Cliente" para navegar para `/viabilidade/novo` em vez de abrir dialog

### Arquivos
1. **Migração SQL** -- novas colunas na `viabilidade_clientes`
2. **`src/pages/ViabilidadeNovo.tsx`** (novo) -- formulário completo
3. **`supabase/functions/analyze-viability/index.ts`** (novo) -- análise IA
4. **`src/App.tsx`** -- rota
5. **`src/pages/Viabilidade.tsx`** -- atualizar botão "Novo Cliente"

