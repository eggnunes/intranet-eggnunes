
# Correção do reenvio de aniversários via WhatsApp de Avisos

## Diagnóstico
O problema não está no botão da tela. O frontend já envia `forceResend: true` quando você clica em “Reenviar Mensagens”.

O erro real é este:
- no código atual da tela, o botão chama a função corretamente com `forceResend`
- porém, nos logs da função em produção, a execução ainda se comporta como se **não existisse** reenvio forçado
- além disso, os logs mostram que ainda existem **7 registros do dia com status `sent` via `zapi`**, então a trava continua bloqueando tudo

Em resumo: o backend que está respondendo ao clique ainda não está aplicando o reenvio da forma correta, e a interface acaba mostrando uma mensagem contraditória.

## O que vou corrigir

### 1. Corrigir a lógica do backend para reenvio forçado de verdade
A função de envio precisa:
- reconhecer `forceResend: true`
- alterar os envios de hoje de `sent` para `resent` antes da checagem de bloqueio
- recalcular a lista elegível após essa limpeza
- considerar apenas os clientes recebidos no envio atual, evitando efeitos colaterais em outros registros do dia

### 2. Garantir que o bloqueio diário não impeça o reenvio
Vou ajustar a idempotência para:
- bloquear apenas quando for envio normal
- liberar corretamente quando for reenvio manual
- registrar no log que foi um reenvio forçado, para ficar rastreável no histórico

### 3. Corrigir a mensagem exibida na tela
Hoje a UI mostra “já enviadas” mesmo quando você clicou em reenvio. Vou ajustar para:
- exibir mensagem específica de reenvio iniciado/concluído
- mostrar erro claro se o backend não aplicar o `forceResend`
- evitar a instrução circular de “clique em reenviar” quando você já clicou

### 4. Sanear os registros travados de hoje
Como já existem 7 registros marcados como `sent`, vou prever a correção dos dados de hoje para destravar o disparo atual e alinhar o histórico com o que realmente aconteceu.

### 5. Validar ponta a ponta
Depois da correção, a validação será:
- clicar em “Reenviar Mensagens”
- confirmar que a função registra `forceResend`
- confirmar que os registros antigos são reclassificados
- confirmar que o envio volta a ser processado via Z-API
- confirmar que o histórico deixa de mostrar falso bloqueio

## Arquivos e partes envolvidos
- `src/pages/AniversariosClientes.tsx`
- `supabase/functions/chatguru-birthday-messages/index.ts`
- ajuste de dados na tabela `chatguru_birthday_messages_log`

## Resultado esperado
Ao clicar em “Reenviar Mensagens”, o sistema deve:
- ignorar a trava das mensagens já marcadas hoje
- reenfileirar/reprocessar os aniversariantes do dia
- registrar corretamente o novo envio
- parar de informar falsamente que “todas já foram enviadas”

## Detalhe técnico
Os logs atuais mostram um descompasso entre o código da tela e a função que está executando. O frontend manda `forceResend`, mas a função ativa continua retornando `alreadySentToday: 7` sem aplicar o reenvio. A correção principal é alinhar a lógica real do backend com o comportamento esperado do botão e tornar a resposta explícita para a interface.
