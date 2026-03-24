

## Melhorias no Formulário de Criação de Agentes de IA

### O que falta (comparando com a imagem de referência)

| Campo | Referência | Sistema Atual |
|-------|-----------|---------------|
| Função (role/especialidade) | Presente | Ausente |
| Status (Ativo/Inativo) | Presente | Ausente no form (existe no DB) |
| Cor do Card | Presente | Ausente |
| Acesso a Dados do Sistema (checkboxes) | Presente (Leads, Colaboradores, Intimações, Financeiro, Campanhas) | Ausente |

### Plano de implementação

**1. Migração de banco de dados — Adicionar colunas à tabela `intranet_agents`**

Novos campos:
- `function_role TEXT` — Função/especialidade do agente (ex: "Especialista em Direito Previdenciário")
- `card_color TEXT DEFAULT 'purple'` — Cor do card (purple, blue, green, orange, red, yellow, pink)
- `data_access TEXT[] DEFAULT '{}'` — Array de permissões de acesso a dados do sistema

**2. Atualizar `CreateAgentDialog.tsx` — Adicionar os novos campos ao formulário**

- Campo "Função" ao lado do Nome (mesma linha, layout 2 colunas)
- Seletor de "Status" (Ativo/Inativo) e "Cor do Card" na mesma linha do ícone emoji
- Seção "Acesso a Dados do Sistema" com checkboxes para: Leads (crm_contacts, crm_deals), Colaboradores (profiles), Intimações/Publicações (publicacoes_dje), Financeiro (fin_lancamentos, fin_contratos), Campanhas (crm_campaigns), Tarefas (tasks), Processos (advbox data), e "Acesso Total ao Sistema"
- O checkbox "Acesso Total" marca/desmarca todos automaticamente

**3. Atualizar `chat-with-agent/index.ts` — Injetar dados do sistema no contexto do agente**

Quando o agente tiver `data_access` configurado, a edge function buscará dados relevantes do banco e os incluirá no system prompt:
- `leads` → busca resumo de leads/deals recentes do CRM
- `colaboradores` → busca lista de colaboradores ativos
- `intimacoes` → busca publicações DJE recentes
- `financeiro` → busca resumo financeiro (totais, saldos)
- `campanhas` → busca campanhas de marketing ativas
- `tarefas` → busca tarefas pendentes/recentes
- `processos` → busca dados de processos ativos

Cada categoria injeta um bloco de dados no prompt com os registros mais recentes/relevantes (limitado para não estourar contexto).

**4. Atualizar `IntranetAgentsTab.tsx` — Exibir cor do card e badges de acesso**

- Aplicar a cor do card no componente Card (borda/gradiente superior)
- Mostrar badges indicando quais acessos o agente possui

**5. Atualizar `CreateAgentDialog.tsx` — Salvar novos campos**

- Incluir `function_role`, `card_color`, `data_access` no insert/update do Supabase

### Detalhes técnicos

- O campo `data_access` usa tipo `TEXT[]` (array de strings) no PostgreSQL
- As opções de acesso disponíveis: `leads`, `colaboradores`, `intimacoes`, `financeiro`, `campanhas`, `tarefas`, `processos`, `all`
- Quando `all` está presente no array, todos os dados são injetados
- Os dados injetados são resumidos (últimos 50 registros por categoria) para manter o contexto dentro dos limites do modelo
- A edge function faz as queries somente para as categorias permitidas, evitando consultas desnecessárias

