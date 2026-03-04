

## Diagnóstico: Bug no Filtro de Busca por Telefone

### Causa Raiz

O problema é um bug de JavaScript nas linhas de filtro por telefone. Quando o usuario digita "ederson" (texto sem digitos), a variavel `searchDigits` fica como string vazia `""`. Em JavaScript, `"qualquer string".includes("")` retorna **sempre `true`**.

Nas linhas 358, 379 e 323, o filtro por telefone NAO tem a guarda `searchDigits &&`:

```javascript
// Linha 358 - contratos
if (c.client_phone && c.client_phone.replace(/\D/g, '').includes(searchDigits)) return true;

// Linha 379 - formulários  
if (c.telefone && c.telefone.replace(/\D/g, '').includes(searchDigits)) return true;

// Linha 323 - local
if (c.telefone && c.telefone.replace(/\D/g, '').includes(searchDigits)) return true;
```

Quando `searchDigits = ""`, essas linhas fazem `"31987983081".includes("")` que retorna `true`. Resultado: **TODOS os clientes com telefone preenchido passam no filtro**, independente do nome digitado. Por isso aparecem Fabio, Monclar, Ruan (que tem telefone) em vez de filtrar por "ederson".

Compare com a linha 356 (CPF) que tem a guarda correta: `if (searchDigits && c.client_cpf?.replace(...)...)`.

### Solucao

Adicionar a guarda `searchDigits &&` antes das verificacoes de telefone em 3 linhas:

**Arquivo: `src/components/financeiro/asaas/AsaasNovaCobranca.tsx`**

- **Linha 323**: `if (c.telefone && ...)` → `if (searchDigits && c.telefone && ...)`
- **Linha 358**: `if (c.client_phone && ...)` → `if (searchDigits && c.client_phone && ...)`
- **Linha 379**: `if (c.telefone && ...)` → `if (searchDigits && c.telefone && ...)`

Isso garante que a busca por telefone so e executada quando o usuario digita numeros, e a busca por nome/email funciona corretamente.

