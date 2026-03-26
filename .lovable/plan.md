

## Correção: Conversas 1-1 duplicadas nas Mensagens Internas

### Problema identificado

A função `createConversation` em `useMessaging.tsx` verifica duplicatas usando apenas o estado local (`conversations` em memória). Se as conversas ainda não foram totalmente carregadas, ou se os dados de participantes estão incompletos, a verificação falha e uma nova conversa duplicada é criada. Já `useStartConversation.tsx` faz a verificação corretamente no banco de dados.

### Implementação

**Arquivo: `src/hooks/useMessaging.tsx`**

1. **Corrigir detecção de duplicatas no `createConversation`** — substituir a busca em memória por uma consulta ao banco de dados:
   - Buscar todas as conversas 1-1 (`is_group = false`) do usuário atual
   - Para cada uma, verificar se o usuário alvo também é participante
   - Se encontrar, retornar a conversa existente em vez de criar nova

2. **Deduplicar conversas na listagem (`fetchConversations`)** — adicionar lógica para agrupar conversas 1-1 duplicadas com o mesmo par de usuários, mostrando apenas a mais recente (com `updated_at` mais recente)

**Arquivo: `src/pages/Mensagens.tsx`**

3. **Após criar/encontrar conversa existente, setar como ativa corretamente** — garantir que ao retornar uma conversa existente, o `activeConversation` seja preenchido com os dados completos (participantes, etc.)

### Resultado
- Ao iniciar conversa com alguém que já tem chat existente, o sistema redireciona para o chat existente
- Conversas duplicadas já existentes serão consolidadas na visualização

