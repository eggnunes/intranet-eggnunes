

## Plano: Corrigir sincronização incompleta de clientes Advbox

### Problema identificado
A tabela `advbox_customers` contém apenas **4.021 registros**, mas o Advbox tem significativamente mais clientes. O cliente "Marcelo Alves da Cunha" não está na tabela local. O registro de sync mostra `total_processed: 9500` mas `last_offset: 0` — indicando que o offset não foi salvo corretamente, fazendo com que cada execução reinicie do zero e nunca alcance clientes cadastrados em posições posteriores da API.

### Correções

**1. Corrigir a edge function `sync-advbox-customers/index.ts`**

- Após um sync completo (`status: completed`), a próxima execução inicia do offset 0 (resync total) — isso está correto
- Porém, quando o sync é parcial e o registro já existe com `last_offset: 0`, o sistema fica preso. Preciso garantir que o offset seja salvo corretamente em todas as saídas parciais
- Adicionar log do offset real ao salvar como partial
- Quando o sync completa totalmente, marcar como `completed` e limpar registros parciais antigos para que o próximo ciclo faça um resync limpo

**2. Forçar resync completo via migração SQL**

- Limpar registros de sync antigos/corrompidos da tabela `advbox_sync_status` para `sync_type = 'customers'`
- Isso permitirá que a próxima execução do cron comece do zero e percorra todos os clientes

**3. Melhorar o desempenho da sync**

- Reduzir `DELAY_BETWEEN_REQUESTS` de 500ms para 300ms para processar mais clientes dentro do limite de 50 segundos
- Isso permitirá cobrir mais registros por execução, acelerando a sincronização completa

### Arquivos modificados
- `supabase/functions/sync-advbox-customers/index.ts` — corrigir persistência do offset e delay
- Migração SQL — limpar registros de sync corrompidos

