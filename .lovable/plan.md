
Objetivo: corrigir o envio de aniversários que está retornando “0 mensagens enviadas”.

Diagnóstico confirmado:
- A função `chatguru-birthday-messages` busca aniversariantes em `advbox_customers`.
- Hoje, essa tabela está com `birthday` vazio para todos os registros (`with_birthday = 0`), então o filtro do dia sempre resulta em 0.
- A tela de aniversários usa outra origem (`advbox-integration/customer-birthdays`), por isso mostra clientes, mas o envio não encontra ninguém.

Plano de correção

1) Corrigir a fonte de dados do envio (principal)
- Arquivo: `supabase/functions/chatguru-birthday-messages/index.ts`
- Alterar o carregamento de aniversariantes para usar diretamente o endpoint do Advbox de aniversários (`/customers/birthdays`) com `ADVBOX_API_TOKEN` (mesma origem lógica da tela).
- Normalizar campos com fallback robusto:
  - ID: `id || customer_id`
  - Telefone: `cellphone || mobile_phone || phone`
  - Data: `birthdate || birthday`
- Manter filtro por dia/mês (timezone Brasil), exclusões (`customer_birthday_exclusions`) e validação de telefone.
- Resultado: envio passa a usar a mesma base que o usuário vê na tela, eliminando divergência “lista mostra X / envio manda 0”.

2) Melhorar feedback no front para caso sem elegíveis
- Arquivo: `src/pages/AniversariosClientes.tsx`
- Ajustar toast de retorno:
  - Se `results.total === 0`, mostrar aviso claro (“Nenhum aniversariante elegível encontrado para envio hoje”) em vez de mensagem de sucesso genérica.
  - Manter sucesso normal quando `sent > 0`.

3) Prevenir recorrência no cache local (consistência de dados)
- Arquivo: `supabase/functions/sync-advbox-customers/index.ts`
- Corrigir mapeamento de campos no sync:
  - `birthday`: usar `customer.birthdate || customer.birthday || customer.birth_date`
  - `phone`: usar `customer.cellphone || customer.mobile_phone || customer.phone`
- Isso evita continuar gravando aniversários como nulos no banco local.

Validação pós-implementação
- Teste funcional no módulo:
  1. Abrir “Aniversários de Clientes”.
  2. Clicar em “Enviar Mensagens de Aniversário”.
  3. Confirmar que não aparece mais “0 enviadas” quando houver elegíveis.
- Verificar logs:
  - `chatguru_birthday_messages_log` deve receber novos registros `sent`/`failed`.
- Verificar consistência:
  - Conferir se os nomes elegíveis na tela batem com os processados na função.

Detalhes técnicos (resumo)
- Causa raiz: divergência entre fonte de dados da UI e fonte de dados do envio.
- Correção estrutural: unificar a origem de aniversariantes para o envio + ajustar sync para não persistir campos críticos como nulos.
- Impacto esperado: envio volta a funcionar imediatamente e sem inconsistência entre tela e processamento.
