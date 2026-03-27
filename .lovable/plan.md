

## Pop-up de mensagens internas com resposta rápida + toggle no perfil

### Visão geral
Criar um pop-up/dialog mais completo que aparece quando o usuário recebe uma nova mensagem interna, permitindo responder diretamente sem sair da tela atual. Adicionar uma configuração no perfil para ativar/desativar esse pop-up (ativado por padrão).

### Alterações

**1. Migração: adicionar coluna na tabela `email_notification_preferences`**
```sql
ALTER TABLE email_notification_preferences 
ADD COLUMN IF NOT EXISTS popup_messages_enabled BOOLEAN DEFAULT true;
```

Usar a tabela existente de preferências, já vinculada ao usuário, para armazenar essa configuração.

**2. Novo componente: `src/components/MessagePopupDialog.tsx`**

Dialog flutuante (não modal — não bloqueia a tela) que aparece no canto inferior direito quando chega uma mensagem. Conteúdo:
- Avatar e nome do remetente
- Preview da mensagem (truncada)
- Campo de texto para resposta rápida
- Botão "Enviar" que insere a resposta diretamente na tabela `messages`
- Botão "Abrir conversa" que navega para `/mensagens`
- Botão de fechar (X)
- Auto-dismiss após 30 segundos se não houver interação

**3. Atualização: `src/hooks/useMessageNotifications.tsx`**

- Buscar a preferência `popup_messages_enabled` do usuário ao inicializar
- Passar a flag para o componente de popup via retorno do hook
- Expor os dados da mensagem recebida (`lastReceivedMessage`) para o componente popup consumir

**4. Atualização: `src/components/Layout.tsx`**

- Importar e renderizar o `MessagePopupDialog` dentro do layout global
- Passar os dados do hook `useMessageNotifications` para o componente

**5. Atualização: `src/components/EmailNotificationSettings.tsx`**

- Adicionar toggle "Pop-up de Mensagens" na seção de preferências
- Descrição: "Exibir pop-up com resposta rápida ao receber novas mensagens"
- Ícone: `MessageCircle`
- Ativado por padrão

**6. Atualização: `src/pages/Profile.tsx`**

- O `EmailNotificationSettings` já é renderizado no perfil, então o toggle aparecerá automaticamente

### Comportamento do pop-up
- Aparece no canto inferior direito, acima do `NotificationToast`
- Não bloqueia interação com o resto da página
- Se chegar outra mensagem enquanto o pop-up está aberto, atualiza o conteúdo
- Ao responder, envia a mensagem e fecha o pop-up
- Não aparece se o usuário está na página `/mensagens`
- Respeita a configuração do perfil (popup habilitado/desabilitado)

### Detalhes técnicos
- A resposta rápida usa `supabase.from('messages').insert(...)` diretamente
- Após enviar, atualiza `last_read_at` do participante
- O toast existente (sonner) continua funcionando como fallback caso o popup esteja desativado
- O popup tem `z-index` maior que o `NotificationToast` para não ficar por trás

