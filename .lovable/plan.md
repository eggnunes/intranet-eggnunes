

## Fix: Mostrar nome do remetente quando mensagem NÃO é anônima

### Problema

Tanto no card da lista (linhas 515-519) quanto no detalhe da mensagem (linhas 598-621), o código **sempre** mostra "Remetente Anônimo" para mensagens recebidas — ignorando o campo `is_anonymous`. Mensagens identificadas (olho verde) deveriam exibir o nome do remetente.

### Correções em `src/pages/CaixinhaDesabafo.tsx`

**1. Card da lista (linhas 510-519):** Quando `!msg.is_anonymous`, mostrar `msg.sender?.full_name` com ícone `User` em vez de `UserX` + "Remetente Anônimo".

**2. Detalhe da mensagem — view do sócio (linhas 598-621):**
- Se `!msg.is_anonymous`: mostrar nome, cargo e email diretamente, com ícone `User` no avatar. Sem gesto secreto.
- Se `msg.is_anonymous`: manter comportamento atual (avatar `UserX` com triple-click secreto para revelar).

