

## Melhorar qualidade da sugestão de tarefas por IA

### Problema

A IA está sugerindo tarefas genéricas ("conferir publicações") em vez de analisar a movimentação específica. Exemplo: movimentação "DESIGNADO PARA JULGAMENTO VIRTUAL" deveria sugerir "Preparar sustentação oral" ou "Avaliar oposição ao julgamento virtual", mas sugere apenas conferência de publicações.

### Causa raiz

1. **Modelo fraco para raciocínio jurídico**: Usa `google/gemini-2.5-flash` — modelo rápido mas superficial para análise jurídica complexa
2. **Dados insuficientes enviados**: O frontend envia apenas `description || title` como `publicationContent`, mas não inclui o título da movimentação separadamente — a IA recebe dados incompletos
3. **Prompt genérico**: O prompt tem poucos exemplos de movimentações processuais brasileiras e não cobre cenários como julgamento virtual, decisão monocrática, etc.

### Solução

**1. Trocar modelo para Anthropic Claude Sonnet 4** (`supabase/functions/suggest-task/index.ts`)
- Claude é significativamente melhor em raciocínio jurídico e cumprimento de instruções complexas
- A chave `ANTHROPIC_API_KEY` já está configurada
- Trocar de Lovable Gateway para API direta da Anthropic (mesmo padrão usado em `suggest-petition`)

**2. Enviar título + descrição separados no body** (`src/components/TaskCreationForm.tsx`)
- Adicionar campo `movementTitle` ao payload (envia `initialData.title`)
- Garantir que `publicationContent` envie `description` E `title` concatenados quando description estiver vazia

**3. Expandir prompt com exemplos específicos** (`supabase/functions/suggest-task/index.ts`)
- Adicionar ~15 exemplos de movimentações reais e as tarefas corretas correspondentes
- Incluir categorias: julgamento virtual, decisão monocrática, despacho, intimação, citação, sentença, recurso, audiência, perícia, cumprimento de sentença, etc.
- Instruir explicitamente: "NUNCA sugira 'conferir publicações' como tarefa principal"
- Adicionar regra: "Se a movimentação indica uma ação futura (julgamento, audiência), sugira PREPARAÇÃO para essa ação"

### Arquivos alterados
- `supabase/functions/suggest-task/index.ts` — trocar modelo + expandir prompt
- `src/components/TaskCreationForm.tsx` — enviar dados mais completos

