

## Título automático com IA + filtro por produto na Viabilidade Jurídica

### O que será feito
1. Adicionar coluna `titulo` na tabela `viabilidade_clientes` para armazenar um título curto gerado pela IA
2. Após a análise de viabilidade, a IA gera automaticamente um título curto (ex: "Revisão de Benefício INSS", "Indenização por Danos Morais")
3. Adicionar filtro por produto (tipo_acao) na listagem de viabilidades
4. Exibir o título na tabela de listagem

### Implementação

**1. Migração SQL** — nova coluna `titulo`

```sql
ALTER TABLE viabilidade_clientes ADD COLUMN titulo TEXT;
```

**2. Edge function `analyze-viability/index.ts`**

Após receber o parecer da IA, fazer uma segunda chamada rápida (Lovable AI, Gemini Flash) para gerar um título curto de até 8 palavras baseado no tipo de ação e descrição do caso. Retornar o título junto com `parecer` e `recomendacao`:

```typescript
// Nova chamada após o parecer
const titulo = await generateTitle(tipoAcao, descricaoCaso, parecer);
return { parecer, recomendacao, titulo, modelo_usado };
```

Prompt: "Gere um título curto (máximo 8 palavras) que identifique o tipo de caso jurídico. Responda APENAS com o título."

**3. `src/pages/ViabilidadeNovo.tsx`**

- Capturar `data.titulo` do retorno da edge function
- Salvar no insert: `titulo: data.titulo || tipoAcao || null`

**4. `src/pages/Viabilidade.tsx`**

- Adicionar coluna "Título/Produto" na tabela (entre Nome e CPF)
- Adicionar filtro dropdown por `tipo_acao` (produto) ao lado do filtro de status
- Extrair lista única de `tipo_acao` dos clientes carregados
- Incluir `titulo` e `tipo_acao` no type `ViabilidadeCliente`

### Arquivos modificados
- **Migração SQL** — coluna `titulo`
- **`supabase/functions/analyze-viability/index.ts`** — geração de título via Lovable AI
- **`src/pages/ViabilidadeNovo.tsx`** — salvar título
- **`src/pages/Viabilidade.tsx`** — exibir título + filtro por produto

