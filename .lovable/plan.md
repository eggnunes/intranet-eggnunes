

## Corrigir erro de duplicidade no registro de pagamentos RH

### Problema
A tabela `rh_pagamentos` possui uma constraint UNIQUE `rh_pagamentos_colaborador_id_mes_referencia_key` em `(colaborador_id, mes_referencia)` que impede múltiplos pagamentos para o mesmo colaborador no mesmo mês. A remoção anterior da verificação no frontend não resolve porque o banco de dados bloqueia o INSERT.

### Solução

**Migração SQL:** Remover a constraint única da tabela `rh_pagamentos`:

```sql
ALTER TABLE rh_pagamentos DROP CONSTRAINT rh_pagamentos_colaborador_id_mes_referencia_key;
```

Isso é tudo. A constraint do banco será removida, permitindo múltiplos lançamentos (salário, bonificação, adiantamento, etc.) para o mesmo colaborador no mesmo mês. Nenhuma alteração de código necessária.

### Arquivo
- Migração SQL (única alteração)

