

## Corrigir badge de mensagens não lidas mostrando contagem incorreta

### Problema
O banco de dados mostra **0 mensagens não lidas** para o seu usuário, mas o badge exibe "5". Causas identificadas:

1. **Hook duplicado** — `useMessageNotifications` é chamado em `Layout.tsx` E em `AppSidebar.tsx`, criando duas instâncias independentes com subscriptions separadas
2. **Contagem não atualiza** — quando você abre uma conversa, o `useMessaging` marca as mensagens como lidas (atualiza `last_read_at`), mas o `useMessageNotifications` não sabe disso e mantém a contagem antiga
3. **Sem sincronização entre hooks** — não há mecanismo para o hook de notificação reagir quando o banco é atualizado por outro hook

### Correção

#### 1. Centralizar o hook em um único lugar
**Arquivo:** `src/components/Layout.tsx`
- Manter o hook aqui e passar `unreadMessagesCount` e `refetchUnreadCount` como props ou via contexto para o `AppSidebar`

**Arquivo:** `src/components/AppSidebar.tsx`
- Remover a chamada duplicada de `useMessageNotifications()`
- Receber `unreadMessagesCount` como prop

#### 2. Adicionar listener de `last_read_at` no hook
**Arquivo:** `src/hooks/useMessageNotifications.tsx`
- Adicionar subscription Realtime para mudanças na tabela `conversation_participants` (evento UPDATE, filtrado pelo user_id)
- Quando `last_read_at` for atualizado (pelo `useMessaging`), re-executar `fetchUnreadCount` automaticamente
- Remover o `setTimeout` de 1 segundo que é frágil

#### 3. Garantir que a contagem é zerada corretamente
- Ao entrar na página `/mensagens`, forçar re-fetch imediato
- Ao abrir uma conversa no `useMessaging`, disparar um evento customizado (`window.dispatchEvent`) que o hook de notificação escuta para re-buscar

### Abordagem técnica
Usar `window.dispatchEvent(new Event('messages-read'))` no `useMessaging` quando marca como lido, e `window.addEventListener('messages-read', fetchUnreadCount)` no `useMessageNotifications` para manter sincronizado sem acoplar os hooks.

### Arquivos modificados
- `src/hooks/useMessageNotifications.tsx` — listener de evento + subscription Realtime para `conversation_participants`
- `src/hooks/useMessaging.tsx` — disparar evento `messages-read` ao marcar como lido
- `src/components/AppSidebar.tsx` — receber `unreadMessagesCount` como prop em vez de chamar o hook
- `src/components/Layout.tsx` — passar prop para AppSidebar

### Resultado
- Badge reflete exatamente a quantidade real de mensagens não lidas
- Ao abrir uma conversa, o badge atualiza instantaneamente
- Sem duplicação de hooks ou subscriptions

