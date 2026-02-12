

## Plano: Corrigir Dados Incompletos de Processos e Card de Movimentações

### Problemas Identificados

**1. Processos recentes com dados incompletos**

A API do ADVBox retorna processos recém-criados sem todos os campos preenchidos (sem número de processo, sem cliente vinculado, sem responsável atribuído). Isso não é um problema de cache -- os dados são genuinamente vazios na origem. O sistema atual simplesmente não exibe nada quando esses campos estão vazios, o que confunde o usuário.

**Solução**: Exibir indicadores visuais claros quando campos estiverem vazios:
- Número do processo vazio: mostrar "Sem número" em itálico
- Cliente não vinculado: mostrar "Cliente não vinculado"  
- Responsável não atribuído: mostrar "Sem responsável"
- Pasta não definida: já está tratado (não mostra badge)

**2. Card de Movimentações mostrando 100 ao invés do total real**

O endpoint dedicado `movements-count` foi criado e está correto no edge function. O código no dashboard também parece correto na extração. Porém, o `supabase.functions.invoke` pode estar falhando silenciosamente (erro de auth, timeout) e caindo no fallback `finalMovements.length` que é 100 (primeira página).

**Solução**: 
- Adicionar logs mais detalhados para diagnosticar
- Se `movementsCountRes` tiver erro, logar o erro específico
- Verificar se o edge function `advbox-integration` está deployado com o case `movements-count`
- Garantir que o fallback mostre o valor do cache quando disponível (o cache `totalMovements` pode ter o valor correto de execuções anteriores)

---

### Alterações Técnicas

**Arquivo 1: `src/pages/ProcessosAtivos.tsx`**

- Linha 572: Quando `lawsuit.process_number` estiver vazio, mostrar "Sem número de processo" em texto cinza/itálico
- Linhas 577-580: Quando `lawsuit.customers` não existir, mostrar "Cliente não vinculado" em cinza
- Linhas 602-606: Sempre mostrar a linha de responsável -- quando vazio, exibir "Sem responsável atribuído"

**Arquivo 2: `src/pages/ProcessosDashboard.tsx`**

- Linhas 912-931: Melhorar a extração do `movementsCountRes`:
  - Adicionar log de erro quando `movementsCountRes.error` existir
  - Antes de usar `finalMovements.length` como fallback final, verificar se o cache (`cachedData?.totalMovements`) tem um valor maior que 100
  - Isso garante que, mesmo se o endpoint falhar, o valor salvo de uma execução anterior será usado
- Re-deploy do edge function para garantir que `movements-count` está disponível

**Arquivo 3: `src/pages/ProcessosDashboard.tsx`** (cards de processos no dashboard, se aplicável)

- Aplicar a mesma lógica de "Sem número" / "Sem responsável" nos cards de processos do dashboard principal

---

### Resumo

| Problema | Causa | Correção |
|----------|-------|----------|
| Processos sem número/cliente/responsável | Dados vazios na API do ADVBox para processos novos | Exibir placeholders descritivos |
| Card movimentações = 100 | Endpoint `movements-count` pode estar falhando, fallback usa `length` | Usar cache como fallback intermediário + logs de diagnóstico |

