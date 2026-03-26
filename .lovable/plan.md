

## Correção: Anexos de arquivos não são enviados nas mensagens internas

### Problema identificado

A função `uploadFile` em `src/pages/Mensagens.tsx` (linha 258-283) captura erros silenciosamente — apenas faz `console.error` e retorna `null`. Quando o upload falha, o array `fileUrls` fica vazio e a mensagem é enviada sem os anexos (ou nem é enviada se não houver texto). O usuário não recebe nenhum feedback visual do erro.

### Causa provável do upload falhar

O bucket `task-attachments` é **privado** e as signed URLs expiram. Porém a política de INSERT existe ("Usuários aprovados podem fazer upload de anexos"). O problema pode estar no fato de que o upload é feito sequencialmente sem feedback, e qualquer erro (rede, timeout, tamanho) é engolido.

### Implementação

**Arquivo: `src/pages/Mensagens.tsx`**

1. **Adicionar feedback de erro no `uploadFile`** — mostrar `toast.error` com o nome do arquivo que falhou, para o usuário saber exatamente o que aconteceu

2. **Adicionar feedback de progresso** — mostrar indicador visual ("Enviando arquivos...") durante o upload dos anexos

3. **Impedir envio sem anexos quando só há arquivos** — se todos os uploads falharem e não há texto, mostrar toast de erro e NÃO limpar os `attachedFiles`, permitindo nova tentativa

4. **Aumentar resiliência do upload** — adicionar retry simples (1 tentativa extra) para uploads que falham por motivos transitórios

### Resultado esperado
- Se um upload falhar, o usuário verá uma mensagem de erro indicando qual arquivo não foi enviado
- Os arquivos anexados não serão limpos em caso de falha, permitindo reenvio
- Feedback visual durante o processo de upload

