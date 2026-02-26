

## Plano: Corrigir 2 Problemas (Pagamento RH + Clientes ADVBox)

### Problema 1: Pagamento bloqueado por mês errado

**Causa raiz:** A verificação de duplicidade em `RHPagamentos.tsx` (linha 524-528) compara `mes_referencia` com `mesReferencia + '-01'`. O estado `mesReferencia` é inicializado com o mês atual (ex: `2026-02`), mas o formulário mostra o mês selecionado no filtro. O bug é que o `mesReferencia` do formulário de novo pagamento não está sincronizado com o filtro `filtroMes`, ou o valor está incorreto na comparação.

Mais importante: a verificação impede qualquer segundo pagamento para o mesmo colaborador no mesmo mês. O usuário precisa poder lançar bonificações, adiantamentos, etc.

**Solução:**
- **Remover a verificação de duplicidade** (linhas 523-538 de `RHPagamentos.tsx`). Permitir múltiplos pagamentos por colaborador no mesmo mês.
- Manter apenas a proteção contra double-click (que já existe com `submitting`).

**Arquivo:** `src/components/rh/RHPagamentos.tsx` — remover linhas 523-538

---

### Problema 2: Clientes ADVBox não carregam nas Decisões Favoráveis

**Causa raiz:** A tabela `advbox_customers` está vazia ou com poucos registros. Não existe cron automático para sincronizar clientes. O usuário precisa clicar manualmente no botão de sincronizar múltiplas vezes (cada execução importa ~2500 clientes antes do timeout de 50s).

**Solução:**
1. Adicionar entrada no `config.toml` para `sync-advbox-customers` com `verify_jwt = false`
2. Criar migração SQL com `pg_cron` para executar `sync-advbox-customers` a cada 15 minutos automaticamente (igual ao padrão já usado para `sync-advbox-tasks`)
3. O cron vai chamar a function repetidamente, e ela continua do offset onde parou, até completar todos os ~9500 clientes

**Arquivos:**
- `supabase/config.toml` — adicionar `[functions.sync-advbox-customers]` com `verify_jwt = false`
- Nova migração SQL — criar cron job `sync-advbox-customers-cron` a cada 15 minutos

