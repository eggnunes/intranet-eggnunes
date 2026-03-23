

# Importar dados de clientes e endereço detalhado na Viabilidade

## O que será feito

### 1. Botão "Importar Cliente" com busca unificada
Acima do formulário de dados, adicionar um card com 3 abas (ADVBox, CRM, Leads) onde o usuário digita o nome e busca clientes existentes. Ao selecionar um, os campos são preenchidos automaticamente (nome, CPF, telefone, email, etc.).

- **ADVBox**: busca na tabela `advbox_customers` (campos: `name`, `tax_id`/`cpf`, `email`, `phone`)
- **CRM**: busca na tabela `crm_contacts` (campos: `name`, `email`, `phone`, `company`, `city`, `state`)
- **Leads**: busca na tabela `captured_leads` (campos: `name`, `email`, `phone`)

### 2. Endereço com campos separados e busca por CEP
Substituir o campo único "Endereço" por campos individuais:
- **CEP** (com botão de busca via ViaCEP — função `fetchAddressByCEP` já existe em `src/lib/masks.ts`)
- **Rua** (preenchido automaticamente pelo CEP)
- **Número**
- **Complemento**
- **Bairro** (preenchido automaticamente)
- **Cidade** (preenchido automaticamente)
- **Estado** (preenchido automaticamente)

Ao salvar, os campos serão concatenados no campo `endereco` existente na tabela.

## Arquivo alterado

| Arquivo | Alteração |
|---|---|
| `src/pages/ViabilidadeNovo.tsx` | Adicionar importação de clientes (ADVBox/CRM/Leads) + campos de endereço separados com busca CEP |

## Detalhes técnicos

- Usar `Tabs` do shadcn para as 3 fontes de dados (ADVBox, CRM, Leads)
- Input de busca com debounce (300ms) que consulta a respectiva tabela via Supabase
- Lista de resultados clicáveis que preenchem os campos do formulário
- Usar `maskCEP` e `fetchAddressByCEP` já existentes em `src/lib/masks.ts`
- Ao salvar, concatenar os campos: `${rua}, ${numero}${complemento ? ', ' + complemento : ''} - ${bairro} - ${cidade}/${estado} - CEP: ${cep}`
- Nenhuma migração de banco necessária — o campo `endereco` (texto) já existe

