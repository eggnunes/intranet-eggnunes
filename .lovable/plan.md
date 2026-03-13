
Diagnóstico (já validado em logs)
- Do I know what the issue is? Sim.
- A função `chatguru-birthday-messages` está estourando tempo de execução no backend.
- Evidências:
  - logs mostram busca massiva de clientes (`~10.440`) com vários `429` (rate limit) antes de iniciar envio;
  - chamada termina com timeout de gateway (504/limite da plataforma), então o front recebe “Failed to send a request to the Edge Function”;
  - além disso, o intervalo de `3 minutos` entre mensagens torna inviável concluir o processo numa chamada HTTP síncrona.

Plano de correção (implementação)
1) Refatorar a função para executar dentro do limite de tempo
- Arquivo: `supabase/functions/chatguru-birthday-messages/index.ts`
- Trocar a estratégia de busca:
  - parar de paginar `/customers` completo;
  - buscar aniversariantes por endpoint específico de aniversário (chamada única) e filtrar por dia/mês em BRT.
- Adicionar timeout por requisição externa (`fetch` com `AbortController`) para Advbox/ChatGuru, evitando travamento silencioso.

2) Tornar o envio idempotente (sem duplicar em reexecuções)
- Antes de enviar, consultar `chatguru_birthday_messages_log` para “já enviados hoje” (fuso BRT).
- Excluir esses clientes da fila do envio.
- Resultado: se houver nova tentativa, só segue com os pendentes.

3) Eliminar o gargalo de espera longa
- Remover espera de 3 minutos dentro da mesma execução HTTP.
- Usar throttle curto (ex.: 1–2s) apenas para não disparar tudo de uma vez.
- Incluir “guardrail” de tempo total (ex.: ~130s): se estiver perto do limite, encerra com sucesso parcial e retorna quantos faltam.

4) Melhorar retorno para o front
- Retornar payload com:
  - `sent`, `failed`, `remaining`, `alreadySentToday`.
- Arquivo: `src/pages/AniversariosClientes.tsx`
  - ajustar toast para mostrar “processamento parcial” quando houver `remaining > 0`;
  - instrução clara de “clicar novamente para concluir pendentes” (sem duplicar os já enviados).

5) Validação pós-ajuste
- Testar fluxo real no botão “Enviar mensagens”.
- Confirmar que:
  - não ocorre mais “Failed to send a request…”;
  - logs da função fecham com resposta 200;
  - reexecução não duplica cliente já enviado no dia;
  - histórico de falhas/sucessos continua preenchendo corretamente.

Escopo de arquivos
- `supabase/functions/chatguru-birthday-messages/index.ts` (principal)
- `src/pages/AniversariosClientes.tsx` (feedback de resultado no front)

Sem necessidade de nova tabela/migração para esta correção imediata.
