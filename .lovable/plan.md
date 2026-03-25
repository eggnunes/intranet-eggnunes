

## Edição de dados do formulário, coluna de profissão e busca por múltiplos termos

### Contexto
Os dados dos clientes vêm do Google Sheets (read-only). Para permitir edição, os dados editados serão salvos localmente no banco de dados. Ao exibir, os dados locais terão prioridade sobre os do Google Sheets.

### 1. Nova tabela `client_form_overrides` (migração SQL)

Tabela para armazenar edições locais dos dados do formulário:

```sql
CREATE TABLE client_form_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_row_id INTEGER NOT NULL UNIQUE, -- corresponde ao client.id (linha da planilha)
  nome_completo TEXT,
  cpf TEXT,
  documento_identidade TEXT,
  como_conheceu TEXT,
  data_nascimento TEXT,
  estado_civil TEXT,
  profissao TEXT,
  telefone TEXT,
  tem_whatsapp TEXT,
  email TEXT,
  cep TEXT,
  cidade TEXT,
  rua TEXT,
  numero TEXT,
  complemento TEXT,
  bairro TEXT,
  estado TEXT,
  nome_pai TEXT,
  nome_mae TEXT,
  opcao_pagamento TEXT,
  quantidade_parcelas TEXT,
  data_vencimento TEXT,
  aposentado TEXT,
  previsao_aposentadoria TEXT,
  possui_emprestimo TEXT,
  doenca_grave TEXT,
  plano_saude TEXT,
  qual_plano_saude TEXT,
  negativa_plano TEXT,
  doenca_negativa TEXT,
  conhece_alguem_situacao TEXT,
  conhece_alguem_mesma_situacao TEXT,
  telefone_alternativo TEXT,
  updated_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE client_form_overrides ENABLE ROW LEVEL SECURITY;
-- Socios e admins podem ler e editar
CREATE POLICY "Authenticated users can read overrides"
  ON client_form_overrides FOR SELECT TO authenticated
  USING (public.is_approved(auth.uid()));
CREATE POLICY "Admins can manage overrides"
  ON client_form_overrides FOR ALL TO authenticated
  USING (public.is_admin_or_socio(auth.uid()));
```

### 2. Arquivo `src/pages/SetorComercial.tsx` — Edição de cliente

- Ao carregar clientes do Google Sheets, buscar também todos os overrides da tabela `client_form_overrides`
- Fazer merge: para cada cliente, se existir override com `client_row_id === client.id`, os campos não-null do override substituem os do Google Sheets
- No dialog de detalhes, adicionar botão **"Editar"** (ícone Pencil) que alterna todos os campos de texto estático para inputs editáveis
- Ao salvar, fazer upsert na tabela `client_form_overrides` com `client_row_id`
- Badge visual "Editado localmente" quando há override

### 3. Coluna "Profissão" na tabela + filtro

- Adicionar `<TableHead>Profissão</TableHead>` na tabela (entre Email e Pagamento)
- Adicionar `<TableCell>{client.profissao}</TableCell>` correspondente
- Adicionar dropdown `<Select>` de filtro por profissão ao lado dos filtros de data
- Extrair lista única de profissões dos clientes carregados
- Aplicar filtro no `filteredClients`

### 4. Busca por múltiplos termos separados por vírgula

Alterar a lógica de filtro (linha 308-313):

```typescript
// Antes: busca simples por 1 termo
// Depois: split por vírgula, cada termo busca independente (OR)
const searchTerms = searchTerm.split(',').map(t => t.trim().toLowerCase()).filter(Boolean);

const filteredClients = dateFilteredClients.filter(client => {
  if (searchTerms.length === 0) return true;
  return searchTerms.some(term =>
    client.nomeCompleto?.toLowerCase().includes(term) ||
    client.cpf?.includes(term) ||
    client.email?.toLowerCase().includes(term) ||
    client.telefone?.includes(term) ||
    client.profissao?.toLowerCase().includes(term)
  );
});
```

### Arquivos modificados
- **Migração SQL** — nova tabela `client_form_overrides`
- **`src/pages/SetorComercial.tsx`** — edição inline, coluna profissão, filtro profissão, busca multi-termo

