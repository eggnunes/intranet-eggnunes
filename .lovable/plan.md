

## Incluir Microsoft Teams como fonte de dados dos Agentes de IA

### O que será feito

Adicionar "Documentos do Teams" como nova opção de acesso a dados na configuração dos agentes. Quando habilitado, o agente terá acesso à lista de arquivos das pastas de clientes no SharePoint/Teams (site Jurídico, caminho "Operacional - Clientes"), podendo informar quais documentos existem para cada cliente.

### Alterações

**1. Nova opção no formulário de criação de agentes**
**Arquivo:** `src/components/agents/CreateAgentDialog.tsx`

- Adicionar ao array `DATA_ACCESS_OPTIONS`:
  ```
  { value: 'teams_documents', label: 'Documentos Teams', description: 'Pastas e documentos de clientes no SharePoint/Teams' }
  ```

**2. Injetar dados do Teams no prompt do agente**
**Arquivo:** `supabase/functions/chat-with-agent/index.ts`

- Adicionar bloco `hasAccess('teams_documents')` na seção de data access (junto aos existentes como leads, financeiro, etc.)
- Dentro desse bloco:
  1. Obter token Microsoft Graph usando as credenciais já configuradas (`MICROSOFT_CLIENT_ID`, `MICROSOFT_TENANT_ID`, `MICROSOFT_CLIENT_SECRET`)
  2. Buscar o site "Jurídico" via `/sites?search=Jurídico`
  3. Listar os drives do site e pegar o drive "Documentos"
  4. Listar a pasta "Operacional - Clientes" e suas subpastas (nomes dos clientes)
  5. Para cada pasta de cliente (limitado a 50), listar os arquivos (nome, tamanho, data de modificação)
  6. Montar bloco de dados: `### Documentos do Teams (Pastas de Clientes)` com a estrutura de pastas/arquivos
  7. Injetar no `systemPrompt` junto aos outros blocos de dados

- O agente poderá responder perguntas como "quais documentos o cliente X tem?" ou "o contrato do cliente Y já está na pasta?"

**3. Exibir tag "Documentos Teams" no card do agente**
**Arquivo:** `src/components/agents/IntranetAgentsTab.tsx`

- Já funciona automaticamente pois o card renderiza os itens de `data_access` — basta garantir que o label aparece corretamente mapeando `teams_documents` → `Documentos Teams`

### Detalhes técnicos

- As credenciais Microsoft já estão configuradas como secrets (`MICROSOFT_CLIENT_ID`, `MICROSOFT_TENANT_ID`, `MICROSOFT_CLIENT_SECRET`)
- A lógica de autenticação Graph API já existe na edge function `microsoft-teams` — será replicada parcialmente em `chat-with-agent`
- Para não sobrecarregar o prompt, limitar a 50 pastas de clientes e 20 arquivos por pasta, mostrando apenas nome e data
- Se o token Microsoft falhar, o bloco é omitido silenciosamente (não bloqueia o agente)

### Resultado
- Ao criar/editar um agente, haverá a opção "Documentos Teams" no acesso a dados
- O agente com essa permissão saberá listar e informar sobre documentos nas pastas de clientes do SharePoint

