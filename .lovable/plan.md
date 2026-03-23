## Diagnóstico: Por que o Resumo Diário não foi enviado

A função **executou hoje às 07:00** (BRT), mas **enviou 0 e-mails e pulou todos os 18 colaboradores**. Log registrado no banco:

```
sentCount: 0, skippedCount: 18, totalUsers: 18
```

### Causas identificadas

**1. Limite de 1.000 linhas na consulta de tarefas**
A consulta busca todas as tarefas não concluídas — são **7.953 tarefas**. O banco retorna apenas as primeiras 1.000 por padrão. As tarefas dos colaboradores ativos provavelmente ficam fora desse corte, resultando em 0 tarefas encontradas para cada usuário.

**2. Nomes com espaço extra no perfil**
Alguns perfis têm espaço no final do nome (ex: `"Marcos Luiz Egg Nunes "` com espaço). Quando comparados com o campo `assigned_users` do Advbox (sem espaço), o `.includes()` falha e não encontra as tarefas.

**3. Falta de dados de movimentações processuais**
O código não inclui publicações do DJE (`publicacoes_dje`) no resumo do operacional. Existem 83 publicações nos últimos 7 dias que poderiam ser incluídas para advogados.

### Plano de correção

**Arquivo:** `supabase/functions/send-daily-digest/index.ts`

1. **Corrigir a consulta de tarefas** — Em vez de buscar todas as 7.953 tarefas em uma query (limitada a 1.000), buscar as tarefas por usuário individualmente usando `ilike` no campo `assigned_users`, com `trim()` no nome
2. **Tratar espaços extras nos nomes** — Aplicar `.trim()` no `full_name` antes de comparar com `assigned_users`
3. **Adicionar publicações do DJE para o operacional** — Buscar publicações recentes da tabela `publicacoes_dje` e incluí-las no resumo dos advogados/operacional, vinculando pelo nome do advogado
4. **Incluir seção de leads semanal para o comercial** — Ajustar a seção de leads para sempre mostrar o resumo semanal mesmo que não tenha havido leads no dia anterior (o resumo semanal de 83+ registros ainda é relevante)
5. **Garantir envio mesmo com conteúdo parcial** — Relaxar a condição `hasContent` para considerar tarefas pendentes (que existem para quase todos)
6. **Redesdobrar a edge function** após as correções

### Resultado esperado

Após a correção, o cron às 07:00 BRT enviará o resumo diário com:

- **Comercial**: resumo de leads (dia anterior + semana) + tarefas pendentes
- **Operacional/Advogados**: movimentações processuais no advbox do processo em que o usuário é responsável+ tarefas atrasadas/próximas do prazo + tarefas pendentes
- **Todos**: mensagens recebidas, comunicados e atualizações da intranet (quando houver)