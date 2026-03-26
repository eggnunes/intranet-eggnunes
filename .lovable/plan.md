

## Melhorar sistema de notificações de mensagens internas

### O que existe hoje
- Hook `useMessageNotifications` que faz contagem de mensagens não lidas e mostra toast
- Ícone de mensagens no header com badge de contagem (já funciona)
- Na lista de conversas, cada chat mostra `unread_count` via badge
- Sidebar (`AppSidebar`) **não** mostra badge de mensagens no item "Mensagens"

### O que será implementado

#### 1. Badge de mensagens não lidas na Sidebar
**Arquivos:** `src/lib/menuData.ts`, `src/components/AppSidebar.tsx`

- Adicionar `unreadMessagesCount` ao `MenuCounts` interface
- Passar esse count para o item `/mensagens` como `badgeCount`
- No `AppSidebar`, chamar `useMessageNotifications` para obter a contagem e passá-la ao `getMenuGroups`
- Resultado: um círculo vermelho com o número de mensagens não lidas aparece ao lado de "Mensagens" na sidebar

#### 2. Card chamativo no cabeçalho quando houver mensagens não lidas
**Arquivo:** `src/components/Layout.tsx`

- Quando `unreadMessagesCount > 0`, exibir um banner/card animado abaixo do header (ou destacar mais o ícone existente) com:
  - Ícone pulsante de mensagem
  - Texto "Você tem X mensagem(ns) não lida(s)"
  - Botão "Ver mensagens" que navega para `/mensagens`
  - Animação de pulse no badge do ícone de mensagens para chamar atenção
- O badge atual no header será aprimorado com animação `animate-pulse` quando houver mensagens

#### 3. Garantir contagem por conversa na lista de chats
**Arquivo:** `src/hooks/useMessaging.tsx`

- Verificar que o `unread_count` por conversa está sendo calculado corretamente
- Já existe no código — apenas confirmar que está funcional

#### 4. Melhorar o toast de notificação em tempo real
**Arquivo:** `src/hooks/useMessageNotifications.tsx`

- Garantir que o toast aparece com som e animação mesmo fora da página de mensagens
- Adicionar tentativa de usar `Notification API` do navegador (notificação nativa do sistema) como complemento ao toast, para chamar atenção mesmo quando a aba não está em foco
- Pedir permissão para notificações nativas na primeira vez

### Resultado
- Sidebar mostra badge vermelho com contagem no item "Mensagens"
- Header tem badge pulsante e card chamativo quando há mensagens não lidas
- Toast rico + notificação nativa do navegador ao receber mensagem nova
- Cada conversa continua mostrando sua contagem individual

