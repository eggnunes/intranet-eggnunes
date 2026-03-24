

## Nova aba "Contratos ZapSign" no CRM

### Objetivo
Criar uma aba no CRM que lista todos os documentos da tabela `zapsign_documents`, mostrando status de assinatura de cada signatário em tempo real, ordenados do mais recente ao mais antigo.

### Implementação

**1. Novo componente: `src/components/crm/CRMZapSignContracts.tsx`**

- Busca todos os registros de `zapsign_documents` ordenados por `created_at desc`
- Exibe cards de resumo no topo: total de contratos, assinados (status = 'signed'), pendentes (status = 'pending'), e expirados/cancelados
- Tabela com colunas: Nome do Documento, Tipo (contrato/procuração), Cliente, Status Geral, Status Cliente, Status Marcos, Status Rafael, Testemunhas, Data de Criação, Data de Assinatura
- Filtros: por status (todos/pendentes/assinados), por tipo (contrato/procuração), e busca por nome do cliente
- Badges coloridos para status: verde (signed), amarelo (pending), vermelho (refused/expired)
- Botão "Atualizar Status" que chama a API do ZapSign para cada documento pendente, consultando `GET /docs/{token}` e atualizando o banco local
- Link para o documento original e para a URL de assinatura do cliente

**2. Edge function: Adicionar action `check_status` à `zapsign-integration`**

- Nova action que recebe um `document_token` e consulta `GET https://api.zapsign.com.br/api/v1/docs/{token}/` com o `ZAPSIGN_API_TOKEN`
- Retorna o status atualizado de cada signatário
- Atualiza a tabela `zapsign_documents` com os status mais recentes
- Também suporta action `list_documents` que busca todos os docs da API ZapSign para sincronização em massa

**3. Adicionar a aba no `CRMDashboard.tsx`**

- Nova tab "ZapSign" com ícone `FileSignature` (do lucide-react) entre as abas existentes
- Import e render do novo componente `CRMZapSignContracts`

**4. Exportar no `index.ts`**

- Adicionar export do novo componente

### Detalhes técnicos

- A tabela `zapsign_documents` já existe no banco com todos os campos necessários (status, client_signer_status, marcos_signer_status, rafael_signer_status, witness1/2_signer_status, sign_url, signed_file_url, etc.)
- O componente usa realtime subscription em `zapsign_documents` para atualização automática quando o webhook do ZapSign atualizar registros
- O botão "Atualizar Status" faz `supabase.functions.invoke('zapsign-integration', { body: { action: 'check_status', documentToken } })` para cada doc pendente
- Paginação com `.range()` para suportar grande volume de documentos

