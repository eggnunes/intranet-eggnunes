

## Acelerar Busca de Clientes ADVBox na Cobranca Asaas

### Problema

Ao abrir o dialog de nova cobranca e selecionar a aba "ADVBox", o sistema chama o endpoint `/customers` da Edge Function que busca TODOS os clientes da API do ADVBox com paginacao completa (100 por pagina, com delay de 1.5s entre paginas). Com milhares de clientes, isso leva 20-30 segundos ou mais, podendo dar timeout. Clientes novos tambem podem nao aparecer se o cache da Edge Function estiver desatualizado.

### Solucao

Criar um pipeline de persistencia local (igual ao que ja existe para `advbox_tasks`) com uma tabela `advbox_customers` no banco de dados. A busca no frontend passa a consultar o banco local (instantaneo), enquanto a sincronizacao com a API do ADVBox acontece em background.

### Detalhes Tecnicos

#### 1. Migracao SQL - Criar tabela `advbox_customers`

```text
Tabela: advbox_customers
Campos:
  - id (uuid, PK)
  - advbox_id (integer, unique) -- ID do cliente no ADVBox
  - name (text, not null)
  - tax_id (text) -- CPF/CNPJ
  - cpf (text)
  - cnpj (text)
  - email (text)
  - phone (text)
  - birthday (date)
  - synced_at (timestamptz, default now())
  - created_at (timestamptz, default now())

RLS: Leitura para usuarios autenticados.
Indice: em name (lower) e tax_id para buscas rapidas.
```

Tambem criar tabela de controle de sincronizacao (reutilizar `advbox_sync_status` com `sync_type = 'customers'`) ou um registro dedicado.

#### 2. Edge Function - `sync-advbox-customers`

Nova Edge Function dedicada a sincronizar clientes do ADVBox para a tabela local:

- Busca clientes da API do ADVBox com paginacao resumivel (usando `last_offset` de `advbox_sync_status`)
- Faz UPSERT na tabela `advbox_customers` (insert ou update por `advbox_id`)
- Atualiza progresso em `advbox_sync_status`
- Configurar com `verify_jwt = false` para permitir chamada via pg_cron
- Agendar execucao a cada 15 minutos via pg_cron (igual `advbox_tasks`)

#### 3. Frontend - Modificar `AsaasNovaCobranca.tsx`

Alterar `loadAdvboxCustomers()` para:

- **Consultar `advbox_customers` no banco local** (query Supabase, retorno instantaneo)
- Exibir resultados imediatamente
- Opcionalmente, mostrar botao "Atualizar lista" que dispara a sincronizacao manual
- Remover a chamada direta ao endpoint `/customers` da Edge Function `advbox-integration`

#### 4. Configuracao

- Adicionar `[functions.sync-advbox-customers]` com `verify_jwt = false` no `config.toml`
- Criar job pg_cron para executar a cada 15 minutos

### Fluxo Resultante

```text
ANTES:
  Usuario abre dialog -> Chama API ADVBox (20-30s) -> Exibe clientes

DEPOIS:
  Usuario abre dialog -> Consulta banco local (<1s) -> Exibe clientes
  [Background: pg_cron a cada 15min sincroniza novos clientes]
  [Manual: Botao "Atualizar" para forcar sincronizacao]
```

### Arquivos a Criar/Modificar

1. **Migracao SQL** -- Criar tabela `advbox_customers` + indice + RLS + registro em `advbox_sync_status` + job pg_cron
2. **`supabase/functions/sync-advbox-customers/index.ts`** -- Nova Edge Function de sincronizacao
3. **`src/components/financeiro/asaas/AsaasNovaCobranca.tsx`** -- Alterar `loadAdvboxCustomers()` para buscar do banco local
4. **`supabase/config.toml`** -- Sera atualizado automaticamente com a nova funcao

