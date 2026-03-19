
Objetivo: corrigir imediatamente o vazamento operacional do resumo financeiro, remover o cadastro da Tatiane e bloquear definitivamente esse tipo de configuração para usuários sem permissão administrativa.

1. O que eu verifiquei
- Tatiane Ferreira Passos está inativa no cadastro:
  - `is_active = false`
  - `is_suspended = false`
  - atualização em `2026-03-18 18:50:37+00`
- Existe um registro ativo dela em `email_notification_preferences` com:
  - `notify_financial = true`
  - criado em `2026-01-22 17:16:56+00`
  - atualizado em `2026-01-22 17:16:58+00`
- Ela não tem cargo admin em `user_roles`.
- Ela não tem override em `admin_permissions`.
- No rastreamento de acesso, o último acesso dela à página `/profile` foi em `2026-01-22 17:16:41+00`, praticamente no mesmo momento em que essa preferência foi salva.
- Não encontrei evidência de acesso dela a rotas financeiras.
- A tela de preferência de e-mail está exposta no perfil de qualquer usuário (`src/pages/Profile.tsx` renderiza `EmailNotificationSettings` sem checagem de permissão).
- A função `send-financial-summary` envia para todo mundo com `notify_financial = true`, sem filtrar `is_active`, `is_suspended`, aprovação ou permissão financeira/admin.

2. Conclusão do incidente
Não há indício de que a Tatiane tenha acessado o financeiro nem de que ela tenha obtido permissão de administrador.
O problema real é de desenho de acesso:
- qualquer colaborador podia abrir o próprio perfil;
- marcar “Financeiro” nas preferências;
- ficar cadastrado como destinatário do resumo financeiro;
- e a automação depois enviava o resumo sem validar se a pessoa ainda era ativa ou autorizada.

3. Correções que vou implementar
- Atualizar `send-financial-summary` para enviar somente a usuários que cumpram todos os critérios:
  - perfil aprovado;
  - `is_active = true`;
  - `is_suspended = false`;
  - papel admin ou permissão financeira explícita.
- Remover a Tatiane da lista efetiva de recebimento, limpando/desativando o registro dela em `email_notification_preferences`.
- Restringir a configuração `notify_financial` no frontend:
  - esconder ou desabilitar essa opção para usuários sem acesso administrativo/financeiro;
  - impedir que o salvamento envie `notify_financial = true` para quem não pode.
- Reforçar no backend o `send-notification-email`:
  - para templates financeiros (`financial_due` e similares), validar também se o destinatário está ativo e autorizado, para evitar outras rotas de envio indevido.
- Adicionar saneamento automático ao desligamento:
  - quando um colaborador ficar inativo ou suspenso, suas preferências financeiras devem ser limpas automaticamente.
- Revisar a política de acesso da tabela `email_notification_preferences` para impedir que usuários comuns definam preferências financeiras privilegiadas apenas via interface própria.

4. Arquivos e áreas que precisam ser alterados
- `supabase/functions/send-financial-summary/index.ts`
- `supabase/functions/send-notification-email/index.ts`
- `src/components/EmailNotificationSettings.tsx`
- `src/pages/Profile.tsx` (se eu optar por ocultar o bloco inteiro ou parte dele)
- nova migration para endurecer regras no banco e automatizar limpeza quando usuário for desligado

5. Ajuste de banco recomendado
Vou criar proteção no banco para que o problema não dependa só da interface:
- trigger/função de saneamento ao atualizar `profiles.is_active` ou `profiles.is_suspended`;
- política/regra para que `notify_financial` só possa permanecer true para usuários autorizados;
- limpeza do registro legado da Tatiane no próprio banco.

6. Resultado esperado após a correção
- Tatiane deixa de ser destinatária imediatamente.
- Usuários inativos/suspensos nunca mais recebem resumo financeiro.
- Usuários sem papel/permissão adequada não conseguem se cadastrar para receber emails financeiros.
- Mesmo que a UI falhe no futuro, o backend e o banco impedem novo vazamento.
- Fica eliminado o cenário em que um colaborador comum “programa” esse envio pelo perfil.

7. Relatório resumido do ocorrido
- Quem “solicitou”: tudo indica que o próprio cadastro da Tatiane foi ativado por ela mesma na página de perfil em `22/01/2026`, não por acesso ao financeiro.
- Como isso foi possível: a opção de notificação financeira estava exposta a usuários comuns.
- Como o email saiu após o desligamento: a automação não valida status ativo/autorização no momento do envio.
- Há evidência de acesso administrativo indevido: não encontrei.
- Severidade: alta, porque houve exposição de informação financeira por falha de autorização indireta.

8. Implementação em ordem
1. Corrigir a função de envio do resumo financeiro.
2. Corrigir a função genérica de emails financeiros.
3. Criar proteção no banco para limpeza automática.
4. Bloquear a opção financeira na tela de perfil para não admins.
5. Remover o registro legado da Tatiane.
6. Revisar outros usos de `notify_financial` para não haver rotas paralelas.
