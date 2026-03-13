
Diagnóstico objetivo
- O erro persiste porque a função `chatguru-birthday-messages` ainda faz varredura completa de clientes via `/customers` com paginação (`fetchBirthdaysFromAdvbox()`), mesmo após as mudanças anteriores.
- Esse trecho continua vulnerável a rate limit (`429`) e pode consumir o tempo total antes de enviar qualquer mensagem, gerando no front o erro genérico “Failed to send a request to the Edge Function”.
- Ou seja: o gargalo principal está na etapa de busca de aniversariantes, não no envio em si.

Plano de correção (implementação)
1) Corrigir a fonte dos aniversariantes no backend (arquivo: `supabase/functions/chatguru-birthday-messages/index.ts`)
- Remover a estratégia de buscar todos os clientes (`/customers` com offset/limit).
- Implementar busca otimizada:
  - Prioridade 1: usar lista recebida do front (clientes de hoje já carregados na tela).
  - Fallback: buscar via endpoint específico de aniversários (`/customers/birthdays`) em chamada única.
- Manter filtro final por dia/mês (BRT), telefone válido e exclusões do banco.

2) Tornar a execução previsível por lote
- Adicionar limite fixo por execução (`MAX_MESSAGES_PER_RUN`, ex.: 30–40) antes do loop de envio.
- Continuar com idempotência por dia (`chatguru_birthday_messages_log`) para que cada novo clique processe apenas pendentes.
- Preservar retorno com `sent`, `failed`, `remaining`, `alreadySentToday`.

3) Ajustar o front para reduzir dependência de busca externa no clique (arquivo: `src/pages/AniversariosClientes.tsx`)
- No envio, passar para a função os aniversariantes elegíveis de hoje (já disponíveis no estado da página).
- Manter UX atual de “processamento parcial” quando `remaining > 0` (clicar novamente continua sem duplicar).
- Melhorar tratamento de erro para diferenciar:
  - falha de conectividade/sessão;
  - erro retornado pela função (401/403/500).

4) Endurecer validações sem perder segurança
- Manter validação de admin no backend.
- Manter exclusões e idempotência sempre no servidor (mesmo recebendo lista do front), para impedir envios indevidos/duplicados.

5) Validação pós-implementação
- Testar o botão “Enviar Mensagens de Aniversário” com usuário admin autenticado.
- Confirmar que:
  - não aparece mais “Failed to send a request...”;
  - retorno traz contadores corretos;
  - novo clique processa apenas `remaining`;
  - não há duplicidade no mesmo dia em `chatguru_birthday_messages_log`.

Detalhes técnicos (resumo)
- Arquivos a alterar:
  - `supabase/functions/chatguru-birthday-messages/index.ts`
  - `src/pages/AniversariosClientes.tsx`
- Sem migração de banco nesta correção (usaremos estruturas já existentes: exclusões + log).
- Resultado esperado: envio estável, sem timeout por varredura massiva, com continuidade segura por lotes.
