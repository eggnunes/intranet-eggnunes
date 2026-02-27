

## Plano: Corrigir classificação de decisões na Jurimetria

### Problema
No `JurimetriaDashboard.tsx`, quando `resultado` é `null` (todas as decisões existentes), o código cai no `else` e conta como "improcedente". Como todas as decisões cadastradas até agora não têm o campo `resultado` preenchido, aparecem todas como improcedentes no gráfico.

### Solução

**1. Corrigir lógica no dashboard (`src/components/JurimetriaDashboard.tsx`)**

- Linha 82 (KPI `procedentes`): incluir `resultado === null` como procedente, já que decisões sem classificação neste módulo são favoráveis por definição
- Linha 126-127 (`regiaoData`): tratar `null` como procedente
- Linha 140-145 (`resultadoData`): tratar `null` como procedente em vez de "não identificado"

Na verdade, a abordagem correta é: decisões sem `resultado` preenchido devem ser tratadas como "procedente" pois este é o módulo de **Decisões Favoráveis**.

**2. Atualizar registros existentes no banco de dados**

Executar UPDATE para definir `resultado = 'procedente'` em todas as decisões que atualmente têm `resultado IS NULL`.

### Arquivos
- `src/components/JurimetriaDashboard.tsx` — corrigir lógica de classificação
- Migração SQL — `UPDATE favorable_decisions SET resultado = 'procedente' WHERE resultado IS NULL`

