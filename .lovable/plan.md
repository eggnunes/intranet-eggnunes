

# Plano: Coluna "Cliente" + Cadastro Manual de Prazos

## Resumo
1. Extrair nome do cliente do `raw_data.lawsuit.customers[]` e exibi-lo como nova coluna na tabela
2. Criar tabela `prazos_manuais` para prazos cadastrados manualmente (sem vínculo obrigatório ao ADVBox)
3. Adicionar dialog "Cadastrar Novo Prazo" com busca de clientes do ADVBox (mesma lógica do `DecisoesFavoraveis.tsx`)

## Dados disponíveis
O campo `raw_data.lawsuit.customers` já contém o nome do cliente vinculado ao processo. Exemplo:
```json
{ "lawsuit": { "customers": [{ "name": "FULANO DE TAL", "customer_id": 123 }] } }
```

## Alterações

### 1. Migração: Criar tabela `prazos_manuais`
```sql
CREATE TABLE public.prazos_manuais (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_nome TEXT NOT NULL,
  cliente_advbox_id INTEGER,
  process_number TEXT,
  task_type TEXT NOT NULL,
  titulo TEXT NOT NULL,
  prazo_interno DATE,
  prazo_fatal DATE,
  advogado_responsavel TEXT,
  observacoes TEXT,
  status TEXT DEFAULT 'pendente',
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.prazos_manuais ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Approved users can manage prazos_manuais" ON public.prazos_manuais
  FOR ALL TO authenticated USING (public.is_approved(auth.uid())) WITH CHECK (public.is_approved(auth.uid()));
```

### 2. `ControlePrazos.tsx` — Coluna "Cliente"

- Na interface `ProcessedTask`, adicionar `cliente_nome: string | null`
- No `processedTasks` (useMemo), extrair: `rawData.lawsuit?.customers?.[0]?.name || null`
- Na `TableHeader`, adicionar coluna "Cliente" entre "Nº Processo" e "Tarefa"
- Na `TableRow`, renderizar o nome do cliente
- Incluir "Cliente" nas exportações Excel/PDF

### 3. `ControlePrazos.tsx` — Mesclar prazos manuais com ADVBox

- Buscar `prazos_manuais` no `fetchData`
- Converter prazos manuais no mesmo formato `ProcessedTask` (com `advbox_id: 0`, `is_manual: true`)
- Mesclar na lista de tarefas processadas

### 4. `ControlePrazos.tsx` — Dialog "Cadastrar Novo Prazo"

- Botão "Novo Prazo" no header (ícone `Plus`)
- Dialog com campos:
  - **Cliente** (busca na `advbox_customers` com `.ilike`, mesmo padrão do `DecisoesFavoraveis.tsx` — mínimo 2 caracteres, com botão "Sincronizar" caso não encontre)
  - **Nº Processo** (opcional, texto livre — pode ficar vazio)
  - **Tipo de Tarefa** (select com as keywords existentes)
  - **Título** (texto)
  - **Advogado Responsável** (select com advogados já conhecidos)
  - **Prazo Interno** (date picker)
  - **Prazo Fatal** (date picker)
  - **Observações** (textarea)
- Salvar na tabela `prazos_manuais`
- Prazos manuais aparecem na tabela com badge "Manual" diferenciado

### Arquivo editado
- `src/pages/ControlePrazos.tsx`

