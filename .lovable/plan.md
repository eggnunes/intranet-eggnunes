

## Problema: Contratos Fechados zerados no CRM Dashboard

### Diagnóstico

O código do dashboard está correto — ele filtra deals ganhos (`won = true`) com `closed_at` dentro do período 25→24. O problema é que **a sincronização com o RD Station parou no dia 23/02**. Nenhum dado novo do RD Station foi importado desde então.

Isso acontece porque a sincronização é **apenas manual** — alguém precisa clicar no botão "Sincronizar" no CRM para buscar os dados novos. Não existe nenhuma rotina automática (cron job) fazendo essa sincronização periodicamente.

### Solução

Criar uma sincronização automática periódica para que o CRM se mantenha atualizado sem depender de ação manual:

1. **Criar uma nova edge function `crm-auto-sync`** que executa a sincronização completa (pipelines, contatos, deals) automaticamente a cada 3 horas
   - Chama internamente o mesmo código da `crm-sync` com `action: full_sync`
   - Usa `SUPABASE_SERVICE_ROLE_KEY` para autenticação server-to-server
   - Registra logs de execução na tabela `crm_sync_log`

2. **Configurar cron job no `config.toml`** para executar a cada 3 horas automaticamente

3. **Executar uma sincronização manual imediata** para trazer os dados do último mês que estão faltando

### Detalhes técnicos

- Nova edge function: `supabase/functions/crm-auto-sync/index.ts`
  - `verify_jwt = false` (chamada via cron, sem JWT)
  - Faz chamada HTTP interna para `crm-sync` com `action: full_sync` usando service role key
- Adicionar bloco de cron no `config.toml`: execução a cada 3 horas
- A edge function `crm-sync` já tem `verify_jwt = true`, então o auto-sync precisa usar o service role key no header Authorization

### Resultado esperado

Após implementação e deploy, o CRM será atualizado automaticamente a cada 3 horas, mantendo os contratos fechados, leads e oportunidades sempre atualizados com o RD Station.

