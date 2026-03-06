

# Plano: Cadastro de Fornecedores/Telefones Úteis + Cofre de Senhas

## Resumo
Criar duas funcionalidades dentro de uma nova página `/cadastros-uteis`:
1. **Telefones/Fornecedores**: visível a todos, editável apenas por admins
2. **Senhas Úteis**: visível e editável apenas por admins

## Banco de Dados (2 tabelas + RLS)

### Tabela `fornecedores_uteis`
```sql
id UUID PK, nome TEXT NOT NULL, telefone TEXT, categoria TEXT,
email TEXT, endereco TEXT, observacoes TEXT, 
created_by UUID, created_at, updated_at
```
- RLS: SELECT para `is_approved(auth.uid())`, INSERT/UPDATE/DELETE para `is_admin_or_socio(auth.uid())`

### Tabela `senhas_uteis`
```sql
id UUID PK, titulo TEXT NOT NULL, usuario TEXT, senha TEXT, 
url TEXT, categoria TEXT, observacoes TEXT,
created_by UUID, created_at, updated_at
```
- RLS: todas as operações restritas a `is_admin_or_socio(auth.uid())`

## Frontend

### Nova página `src/pages/CadastrosUteis.tsx`
- Tabs: "Fornecedores" | "Senhas" (aba Senhas só aparece para admins/sócios)
- **Aba Fornecedores**:
  - Tabela com busca por nome/categoria/telefone
  - Filtros: categoria (dropdown dinâmico extraído dos dados)
  - Máscara de telefone usando `maskPhone` existente
  - Dialog de cadastro/edição (apenas admins)
  - Botão copiar telefone
- **Aba Senhas** (somente admins):
  - Tabela com busca por título/categoria
  - Campo senha com toggle mostrar/ocultar (eye icon)
  - Botão copiar senha
  - Dialog de cadastro/edição
  - Filtro por categoria

### Sidebar
- Adicionar "Cadastros Úteis" no grupo ADMINISTRATIVO com ícone `Phone`

### Rota
- Adicionar `/cadastros-uteis` em `App.tsx` com `ProtectedRoute`

## Segurança
- Senhas armazenadas em texto na tabela com RLS restritivo (apenas admins)
- Nenhuma senha exposta no frontend para não-admins (a query nem é executada)

