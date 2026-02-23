

## Adicionar Fonte "Contratos" na Nova Cobranca do Asaas

### Problema Identificado

O sistema ja possui 3 fontes de clientes ao criar uma cobranca (Asaas, ADVBox, Financeiro) e ja faz a sincronizacao automatica com o Asaas quando o cliente vem de outra fonte. Porem:

1. **Falta a fonte "Contratos"** -- Clientes que preencheram formulario e assinaram contrato estao na tabela `fin_contratos` com nome, CPF, email e telefone, mas nem sempre foram cadastrados no `fin_clientes` ou no ADVBox.
2. **Email e telefone nao sao enviados** -- Ao sincronizar um cliente local com o Asaas, o sistema envia apenas nome e CPF/CNPJ, ignorando email e telefone disponiveis na base.

### Solucao

**Arquivo a modificar:** `src/components/financeiro/asaas/AsaasNovaCobranca.tsx`

#### 1. Adicionar aba "Contratos" na busca de clientes

- Criar uma quarta aba no seletor de fonte: **Contratos** (icone `FileText`)
- Carregar dados de `fin_contratos` (status ativo) ao abrir o dialog
- Filtrar por nome do cliente ou CPF no campo de busca
- Exibir badge "Contrato" + nome do produto ao lado do nome do cliente
- Ao selecionar, mapear para o formato `Customer` com `source: 'contrato'`

#### 2. Enviar email e telefone ao criar cliente no Asaas

- Ao sincronizar cliente de fonte "local" ou "contrato", buscar email e telefone dos dados disponiveis
- Para `fin_clientes`: usar campos `email` e `telefone`
- Para `fin_contratos`: usar campos `client_email` e `client_phone`
- Incluir esses dados na chamada `create_customer` para o Asaas

#### 3. Ajustar o grid de abas de 3 para 4 colunas

- Mudar `grid-cols-3` para `grid-cols-4` no TabsList
- Manter visual compacto com icones e textos curtos

### Detalhes Tecnicos

**Novas interfaces e estados:**

```text
- Interface ContractCustomer: id, client_name, client_cpf, client_email, client_phone, product_name
- Estado: contractCustomers (array), loadingContracts (boolean)
- Nova funcao: loadContractCustomers() -- query fin_contratos com status ativo
```

**Mapeamento de customer para cada fonte:**

```text
Fonte       | name           | cpfCnpj     | email          | phone
------------|----------------|-------------|----------------|----------------
Asaas       | name           | cpfCnpj     | (ja tem)       | (ja tem)
ADVBox      | name           | tax_id/cpf  | --             | --
Financeiro  | nome           | cpf_cnpj    | email          | telefone
Contratos   | client_name    | client_cpf  | client_email   | client_phone
```

**Alteracao na interface Customer:**

Adicionar campos opcionais `email` e `phone` para que sejam passados na sincronizacao com Asaas.

**Alteracao na funcao syncCustomerToAsaas:**

Incluir `email` e `phone` (quando disponiveis) no body da chamada `create_customer`.

**Nenhuma alteracao no edge function** -- a funcao `asaas-integration` ja aceita `email` e `phone` no action `create_customer`.

