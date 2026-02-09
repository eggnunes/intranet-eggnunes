
# Correção do Envio de Mensagens e Diagnóstico Z-API

## Problema Identificado
A Z-API aceita a chamada da API e retorna sucesso (HTTP 200), mas a mensagem nao e de fato entregue ao destinatario. A tabela de eventos de webhook esta completamente vazia e a funcao webhook nunca foi acionada, o que indica que:
1. A instancia Z-API pode estar com o WhatsApp desconectado (sem sessao ativa)
2. Os webhooks nunca foram registrados na instancia Z-API
3. Nao existe nenhum indicador visual para o usuario saber se a Z-API esta conectada ou nao

## Solucao

### 1. Adicionar Painel de Diagnostico e Status da Conexao Z-API
Criar um componente `AdvboxDataStatus`-like para a Z-API que:
- Ao abrir a pagina WhatsApp Avisos, executa automaticamente o `test-connection`
- Exibe um banner no topo da pagina indicando:
  - **Verde**: "Z-API conectada" (quando `connected: true`)
  - **Vermelho**: "Z-API desconectada - mensagens nao serao entregues" (quando `connected: false`)
  - **Amarelo**: "Verificando conexao..." (durante o carregamento)
- Se desconectada, exibe instrucoes para o usuario reconectar no painel da Z-API

### 2. Adicionar Botao "Configurar Webhooks"
No painel de diagnostico, adicionar um botao que:
- Chama a action `setup-webhooks` da edge function `zapi-send-message`
- Registra os webhooks necessarios na instancia Z-API
- Mostra resultado (quantos webhooks configurados com sucesso)
- Isso garante que eventos de entrega/leitura cheguem ao sistema

### 3. Validar Conexao Antes de Enviar Mensagem
Modificar o fluxo de envio para:
- Verificar o status da conexao antes de tentar enviar
- Se a Z-API estiver desconectada, mostrar aviso ao usuario antes de enviar (mas permitir o envio se ele quiser)
- Adicionar feedback visual mais claro sobre o status de entrega

### 4. Melhorar Feedback de Entrega
- Apos enviar uma mensagem, se o status nao mudar de "sent" para "delivered" em 30 segundos, mostrar um alerta discreto
- Usar polling como fallback para verificar status das mensagens recentes, ja que os webhooks podem nao estar configurados

---

## Arquivos a Modificar

| Arquivo | Mudancas |
|---------|----------|
| `src/pages/WhatsAppAvisos.tsx` | Adicionar verificacao de status da conexao ao carregar pagina, banner de status, botao de configurar webhooks |
| `src/components/whatsapp/ChatArea.tsx` | Exibir alerta quando Z-API esta desconectada no header do chat |
| `src/components/whatsapp/MessageInput.tsx` | Receber prop de status da conexao e exibir aviso se desconectada |

### Nenhum arquivo novo necessario
As mudancas serao integradas aos componentes existentes.

---

## Detalhes Tecnicos

### Verificacao de Conexao (WhatsAppAvisos.tsx)
Ao montar a pagina, chamar:
```text
supabase.functions.invoke('zapi-send-message', {
  body: { action: 'test-connection' }
})
```

Armazenar o resultado em estado:
- `zapiConnected: boolean | null` (null = verificando)
- `zapiStatus: object` (dados completos do status)

### Banner de Status
Exibido acima das tabs:
- Se `zapiConnected === null`: "Verificando conexao com Z-API..."
- Se `zapiConnected === false`: "Z-API desconectada. Mensagens nao serao entregues. Reconecte no painel da Z-API e clique em 'Configurar Webhooks'."
- Se `zapiConnected === true`: Exibir discretamente ou ocultar

### Botao Setup Webhooks
Visivel sempre, chama:
```text
supabase.functions.invoke('zapi-send-message', {
  body: { action: 'setup-webhooks' }
})
```
Exibe toast com resultado.

### Validacao Pre-Envio
No `handleSendMessage`, verificar `zapiConnected`:
- Se `false`, exibir toast de aviso (mas nao bloquear o envio)
- Se `null` (nao verificado), enviar normalmente

### Polling de Status (fallback)
Implementar um intervalo de 60 segundos que verifica o status da conexao:
- Se estava conectado e desconectou, mostrar alerta
- Atualizar o banner em tempo real
