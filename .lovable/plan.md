

## Corrigir Busca e Listagem de Contratos na Nova Cobranca Asaas

### Problemas Identificados

1. **Ordenacao errada**: Os contratos estao sendo carregados ordenados por `client_name` (alfabetico). Isso faz com que os ultimos clientes que preencheram formulario aparecam no meio ou no final da lista, dificultando a localizacao. Devem ser ordenados por `created_at DESC` (mais recentes primeiro).

2. **Busca limitada**: A busca no campo de texto funciona, mas so compara com `client_name.toLowerCase().includes(search)`. Se o usuario digitar "Juan" e o nome estiver salvo como "JUAN OLIVEIRA" ou com acentos, a busca pode falhar em cenarios de formatacao. Alem disso, a busca por CPF so funciona com `includes`, sem remover formatacao.

3. **Limite de exibicao**: O `.slice(0, 20)` mostra apenas 20 resultados, o que e adequado, mas combinado com a ordenacao alfabetica faz com que so aparecem nomes comecando com A-D inicialmente.

4. **Cliente pode nao estar na tabela**: O cliente "Juan Oliveira" nao foi encontrado na tabela `fin_contratos`. Pode ser que o formulario tenha sido preenchido mas o contrato nao foi gerado, ou o nome esta salvo de forma diferente. A busca precisa ser mais flexivel.

---

### Solucao

**Arquivo a modificar:** `src/components/financeiro/asaas/AsaasNovaCobranca.tsx`

#### 1. Ordenar contratos por data (mais recentes primeiro)

Alterar a query de `loadContractCustomers()` de `.order('client_name')` para `.order('created_at', { ascending: false })`.

#### 2. Melhorar a busca de contratos

- Normalizar a busca removendo acentos e caracteres especiais
- Buscar tambem no CPF removendo formatacao (pontos e tracos)
- Buscar no email do cliente tambem
- Aumentar o limite de exibicao para 30 resultados

#### 3. Aplicar mesmas melhorias para outras fontes

- Ordenar clientes locais (`fin_clientes`) por nome mas permitir busca por email/telefone
- Garantir que a busca por CPF funciona independente da formatacao

---

### Detalhes Tecnicos

**Alteracoes na funcao `loadContractCustomers()`:**
- Mudar `.order('client_name')` para `.order('created_at', { ascending: false })`
- Remover filtro `.eq('status', 'ativo')` ou expandir para incluir outros status recentes (ex: `in ('ativo', 'pendente')`)

**Alteracoes na funcao `getFilteredCustomers()` (bloco contrato):**
- Normalizar texto de busca (remover acentos com `normalize('NFD').replace(...)`)
- Comparar CPF sem formatacao: `client_cpf?.replace(/\D/g, '').includes(searchClean)`
- Incluir busca por email: `client_email?.toLowerCase().includes(search)`
- Aumentar slice para 30

**Nenhuma alteracao no backend** -- apenas ajustes na query e na logica de filtro do frontend.
