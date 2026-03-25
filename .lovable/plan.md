

## 1. Gerenciar membros de grupo nas Mensagens Internas + Filtrar desligados na Distribuição de Tarefas

### Problema 1: Sem opção de adicionar/remover membros em grupos de conversa
O header do chat de grupo mostra apenas o nome e quantidade de participantes, mas não oferece nenhuma ação para gerenciar membros. O hook `useMessaging` também não possui funções para adicionar ou remover participantes.

### Problema 2: Colaboradores desligados aparecem na Distribuição de Tarefas
A lista de exclusão em `DistribuicaoTarefas.tsx` é hardcoded com nomes específicos de gestores. Colaboradores desligados (como Tatiane) não são filtrados — o sistema deveria cruzar com a tabela `profiles` para excluir quem tem `is_active = false`.

---

### Implementação

**Arquivo: `src/hooks/useMessaging.tsx`**
- Adicionar função `addParticipants(conversationId, userIds[])` — insere na tabela `conversation_participants` e recarrega conversas
- Adicionar função `removeParticipant(conversationId, userId)` — deleta da tabela `conversation_participants` e recarrega conversas
- Exportar ambas funções no return

**Arquivo: `src/pages/Mensagens.tsx`**
- No header do chat quando `activeConversation.is_group === true`, adicionar um botão de engrenagem/configuração (ícone `Settings` ou `UserPlus`)
- Ao clicar, abrir um Dialog "Gerenciar Grupo" com:
  - Lista dos participantes atuais com botão de remover (ícone X) ao lado de cada um (exceto o próprio usuário)
  - Seção para adicionar novos membros: lista de colaboradores ativos com busca, checkbox para selecionar, botão "Adicionar"
  - A lista de colaboradores disponíveis busca `profiles` onde `is_active = true` e `is_suspended = false` e `approval_status = 'approved'`, excluindo quem já é participante

**Arquivo: `src/pages/DistribuicaoTarefas.tsx`**
- Buscar da tabela `profiles` todos os colaboradores com `is_active = true` e `is_suspended = false` (campos `full_name`)
- No `collaboratorStats` useMemo, além da lista hardcoded de exclusão, também excluir qualquer nome que **não** esteja na lista de colaboradores ativos
- Isso garante que Tatiane (desligada) e qualquer futuro desligamento sejam automaticamente filtrados

### Resultado
- Grupos de conversa terão botão para gerenciar membros (adicionar e remover)
- Colaboradores desligados não aparecerão mais na distribuição de tarefas

