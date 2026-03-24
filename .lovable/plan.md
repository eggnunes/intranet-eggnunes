

## Correção do domínio de envio de e-mails

### Problema
Dois remetentes errados impedem o envio de todos os e-mails:

| Edge Function | Remetente atual (ERRADO) | Problema |
|---|---|---|
| `send-notification-email` | `avisos@intranetagnunes.com.br` | Typo: "agnunes" em vez de "eggnunes" |
| `send-daily-digest` | `avisos@eggnunes.com.br` | Domínio não verificado no Resend |

O domínio verificado é **`intraneteggnunes.com.br`** (confirmado na imagem do Resend).

### Correção

**1. `supabase/functions/send-notification-email/index.ts` (linha 380)**
- Alterar `avisos@intranetagnunes.com.br` para `avisos@intraneteggnunes.com.br`

**2. `supabase/functions/send-daily-digest/index.ts` (linha 10)**
- Alterar `avisos@eggnunes.com.br` para `avisos@intraneteggnunes.com.br`

**3. Deploy das duas edge functions e teste manual** para confirmar que os e-mails passam a ser enviados com sucesso.

