

## Melhorias no sistema de Viabilidade Jurídica

### 1. Salvar análise na pasta do cliente no Teams
**Status atual**: Já existe `SaveToTeamsDialog` que auto-navega para pasta do cliente em "Operacional - Clientes/{nome}" no site Jurídico, criando a pasta se não existir. A funcionalidade já está implementada corretamente — o botão "Teams" aparece quando há parecer. Nenhuma alteração necessária neste item.

### 2. Adicionar campos obrigatórios do ADVBox ao formulário de viabilidade
**Arquivo:** `src/pages/ViabilidadeNovo.tsx`

Campos obrigatórios da API ADVBox para criar cliente (baseado no `createCustomerInAdvbox`):
- `name` (nome) — já existe
- `cpf` — já existe  
- `phone` (telefone) — já existe
- `email` — já existe
- `type` (pessoa física/jurídica) — **ADICIONAR**
- `city` (cidade) — já existe via AddressFields
- `state` (estado) — já existe via AddressFields
- `street` (rua + número) — já existe via AddressFields
- `neighborhood` (bairro) — já existe via AddressFields
- `customers_origins_id` (origem/como conheceu) — **ADICIONAR** campo "Como Conheceu?" com opções comuns

Adicionar ao formulário:
- Campo "Tipo de Pessoa" (Física/Jurídica) — Select
- Campo "RG" — Input  
- Campo "Profissão" — Input
- Campo "Estado Civil" — Select
- Campo "Como Conheceu?" (origem) — Select com opções comuns
- Nenhum desses será obrigatório no formulário (conforme solicitado)

Adicionar esses campos como colunas na tabela `viabilidade_clientes` via migration:
- `rg`, `profissao`, `estado_civil`, `tipo_pessoa`, `como_conheceu`

### 3. Botão "Cadastrar no ADVBox" no formulário/dashboard
**Arquivo:** `src/pages/Viabilidade.tsx` e `src/pages/ViabilidadeNovo.tsx`

- Criar nova edge function `register-viability-client-advbox` que:
  - Recebe `viabilidade_id`
  - Busca dados do cliente na tabela `viabilidade_clientes`
  - Verifica se já existe no ADVBox por CPF/nome
  - Se não existir, cria usando os campos disponíveis (preenchendo "Não informado" nos ausentes)
  - Retorna sucesso com `advbox_customer_id`
- Adicionar coluna `advbox_customer_id` na tabela `viabilidade_clientes` via migration
- No dashboard (dialog de visualização) e na tabela, adicionar botão "Cadastrar no ADVBox":
  - Se `advbox_customer_id` já existir → mostrar badge "Cadastrado no ADVBox"
  - Se não → botão que chama a edge function

### 4. Clicar no cliente para ver histórico de viabilidades
**Arquivo:** `src/pages/Viabilidade.tsx`

- Ao clicar no nome do cliente na tabela, em vez de abrir apenas a análise individual, abrir um dialog que:
  - Busca todas as viabilidades com o mesmo `nome` ou `cpf`
  - Lista todas as análises daquele cliente em ordem cronológica
  - Cada item mostra: título, tipo de ação, status, data, resumo do parecer
  - Clicar em um item expande os detalhes completos

### Migration SQL
```sql
ALTER TABLE viabilidade_clientes 
  ADD COLUMN IF NOT EXISTS rg TEXT,
  ADD COLUMN IF NOT EXISTS profissao TEXT,
  ADD COLUMN IF NOT EXISTS estado_civil TEXT,
  ADD COLUMN IF NOT EXISTS tipo_pessoa TEXT DEFAULT 'fisica',
  ADD COLUMN IF NOT EXISTS como_conheceu TEXT,
  ADD COLUMN IF NOT EXISTS advbox_customer_id TEXT;
```

### Arquivos modificados
- `src/pages/ViabilidadeNovo.tsx` — novos campos do ADVBox no formulário + salvar campos extras
- `src/pages/Viabilidade.tsx` — histórico por cliente ao clicar + botão cadastrar ADVBox + dialog atualizado
- `supabase/functions/register-viability-client-advbox/index.ts` — nova edge function
- Migration para adicionar colunas

### Resultado
- Formulário de viabilidade terá todos os campos necessários para cadastro no ADVBox (sem obrigatoriedade)
- Botão para cadastrar cliente diretamente no ADVBox a partir da viabilidade
- Clicar no nome do cliente mostra histórico de todas as viabilidades dele
- Salvar no Teams já funciona corretamente (auto-cria pasta do cliente)

