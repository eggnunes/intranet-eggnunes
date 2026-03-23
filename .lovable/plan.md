

# Corrigir Agendamento do Resumo Diário

## Problema

A Edge Function `send-daily-digest` está implementada corretamente e já usa o e-mail cadastrado no perfil de cada colaborador (`profiles.email`). Porém, o job pg_cron que deveria disparar essa função diariamente às 7h (Brasília) **não foi criado** — apenas as extensões foram habilitadas.

## Solução

Executar um SQL (via insert tool, não migração) para criar o cron job:

```sql
SELECT cron.schedule(
  'send-daily-digest',
  '0 10 * * *',  -- 10:00 UTC = 07:00 BRT
  $$
  SELECT net.http_post(
    url := 'https://igzcajgwqfpcgybxanjo.supabase.co/functions/v1/send-daily-digest',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlnemNhamd3cWZwY2d5YnhhbmpvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQzNTE2MTAsImV4cCI6MjA3OTkyNzYxMH0.zDBmiIc9n9TrXgfkBNMgRCjfX8oybieBnu2_QdSN8cY"}'::jsonb,
    body := '{"time": "daily-digest"}'::jsonb
  ) AS request_id;
  $$
);
```

## Verificação do fluxo completo

O e-mail é enviado para `profile.email` de cada colaborador ativo/aprovado/não suspenso. A lógica está correta:

1. Busca perfis com `is_active=true`, `is_suspended=false`, `approval_status='approved'`
2. Verifica preferência `notify_daily_digest` (default: true)
3. Monta conteúdo personalizado por cargo
4. Envia para `profile.email` via Resend
5. Pula usuários sem e-mail ou sem conteúdo relevante

## Resultado

Após criar o cron job, o resumo diário será enviado automaticamente todos os dias às 7h (Brasília) para o e-mail cadastrado de cada colaborador.

