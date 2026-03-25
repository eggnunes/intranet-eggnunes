

## Expandir lista de contratos ZapSign + botão "Salvar na pasta do cliente"

### Problema 1: Poucos contratos na lista
A tabela `zapsign_documents` tem apenas 13 registros porque só são inseridos documentos criados pela intranet. Contratos criados diretamente no ZapSign ou antes da integração não aparecem.

### Problema 2: Falta botão para salvar na pasta do cliente no Teams
Não existe ação para salvar o documento assinado diretamente na pasta do cliente no SharePoint/Teams.

---

### Solução

**1. Adicionar ação `sync_all` na edge function `zapsign-integration/index.ts`**

Nova ação que busca todos os documentos da conta ZapSign via API (`GET /docs/`) com paginação, e faz upsert na tabela `zapsign_documents`:

- Endpoint: `GET https://api.zapsign.com.br/api/v1/docs/?page=1`
- Paginar até não ter mais resultados
- Para cada documento, extrair: token, nome, status, signatários, URLs
- Upsert por `document_token` (evita duplicatas)
- Mapear nomes de signatários para identificar cliente, Marcos, Rafael e testemunhas
- Retornar contagem de documentos sincronizados

**2. Adicionar botão "Sincronizar ZapSign" no componente `CRMZapSignContracts.tsx`**

- Novo botão ao lado de "Atualizar Status" que chama `action: 'sync_all'`
- Ao clicar, busca todos os documentos da API e popula a tabela
- Exibe toast com quantidade sincronizada

**3. Adicionar botão "Salvar no Teams" em cada linha da tabela**

Para cada documento que tem `signed_file_url` (assinado) ou `original_file_url`:

- Novo botão com ícone de nuvem/upload na coluna Ações
- Ao clicar:
  - Faz fetch do PDF via URL (`signed_file_url` ou `original_file_url`)
  - Converte para base64
  - Abre o fluxo de salvar no Teams, buscando automaticamente o site "Jurídico"
  - Caminho: drive "Documentos" → `Operacional - Clientes/{nome_do_cliente}`
  - Se a pasta não existir, cria automaticamente usando `findOrCreateClientFolder`
  - Nome do arquivo: nome do documento original do ZapSign

**4. Adicionar paginação à tabela**

- Exibir 20 documentos por página com controles de paginação
- Manter filtros e busca funcionando com paginação

### Detalhes técnicos

**Edge function — nova ação `sync_all`:**
```typescript
if (body.action === 'sync_all') {
  let page = 1;
  let allDocs = [];
  while (true) {
    const resp = await fetch(`${ZAPSIGN_API_URL}/docs/?page=${page}`, {
      headers: { 'Authorization': `Bearer ${ZAPSIGN_API_TOKEN}` }
    });
    const data = await resp.json();
    if (!data.results?.length) break;
    allDocs.push(...data.results);
    if (!data.next) break;
    page++;
  }
  // Upsert each document...
}
```

**Componente — botão salvar no Teams:**
- Importar `useTeamsUpload` e `SaveToTeamsDialog`
- Novo estado `savingDoc` para controlar qual documento está sendo salvo
- Ao clicar no botão, busca o PDF, converte para base64, abre dialog pré-configurado com site Jurídico e pasta do cliente

**Arquivos modificados:**
- `supabase/functions/zapsign-integration/index.ts` — nova ação `sync_all`
- `src/components/crm/CRMZapSignContracts.tsx` — botão sync, botão salvar Teams, paginação

