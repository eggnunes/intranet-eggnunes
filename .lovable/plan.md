

## Correcao: Resultados do DataJud nao aparecem + Filtros avancados

### Problema identificado

Apos o botao "Buscar no DataJud" salvar 604 movimentacoes no banco, a funcao `loadLocal()` e chamada para recarregar os dados, mas:

1. **Erros silenciosos**: `loadLocal` engole qualquer erro sem feedback ao usuario (linha 170)
2. **Limite de 100 registros**: A query `search-local` tem `.limit(100)`, insuficiente para 604+ resultados
3. **Sem paginacao real**: Nao ha paginacao no cache local - so mostra os primeiros 100
4. **Sem invalidacao de cache**: Se o `loadLocal` falhar, o estado `publicacoes` fica vazio

### Solucao em 2 partes

#### Parte 1: Corrigir exibicao dos resultados

**Arquivo: `src/pages/PublicacoesDJE.tsx`**

1. Adicionar tratamento de erros em `loadLocal` - se falhar, mostrar toast de erro em vez de silenciar
2. Apos a busca na API, chamar `loadLocal` sem filtro de advogado (ja que o DataJud nao filtra por OAB)
3. Adicionar paginacao local com estado `totalCount` e botao "Carregar mais"
4. Adicionar filtros aplicaveis diretamente nos resultados ja carregados (filtro client-side para busca rapida)

**Arquivo: `supabase/functions/pje-publicacoes/index.ts`**

1. Aumentar `.limit(100)` para `.limit(1000)` na action `search-local` para trazer mais resultados
2. Adicionar contagem total via `.select('*', { count: 'exact' })` para informar quantos registros existem
3. Adicionar suporte a paginacao (`offset` e `limit` via filtros)

#### Parte 2: Filtros avancados nos resultados

Adicionar no frontend uma barra de filtros acima da tabela de resultados com:

- Campo de busca textual (filtra por conteudo, processo, tribunal - client-side)
- Filtro por status de leitura (Todas / Lidas / Nao lidas)
- Filtro por periodo (ultimos 7 dias, 30 dias, 90 dias, todos)
- Ordenacao (data mais recente, data mais antiga, tribunal)
- Contador mostrando "Exibindo X de Y resultados"

### Mudancas tecnicas detalhadas

**`supabase/functions/pje-publicacoes/index.ts` - action `search-local`:**

```
// Antes
let query = supabase
  .from('publicacoes_dje')
  .select('*')
  .order('data_disponibilizacao', { ascending: false })
  .limit(100)

// Depois
const page = filters?.page || 1
const pageSize = filters?.pageSize || 200
let query = supabase
  .from('publicacoes_dje')
  .select('*', { count: 'exact' })
  .order('data_disponibilizacao', { ascending: false })
  .range((page - 1) * pageSize, page * pageSize - 1)
```

Retorno atualizado para incluir `count` e `page`.

**`src/pages/PublicacoesDJE.tsx`:**

1. `loadLocal` - adicionar `console.error` e `toast.error` quando falhar
2. Apos busca API: chamar `loadLocal` passando `pageSize: 500` para trazer bastante resultado
3. Adicionar estado `filtroTexto`, `filtroLeitura`, `filtroPeriodo` para filtros client-side
4. Filtrar `publicacoes` em um `useMemo` antes de renderizar a tabela
5. Adicionar componentes de filtro entre o CardHeader "Resultados" e a tabela
6. Adicionar paginacao com botao "Carregar mais" e contador "Exibindo X de Y"

### Resultado esperado

- O usuario clica em "Buscar no DataJud" e os 604+ resultados aparecem imediatamente na tabela
- Filtros rapidos permitem buscar por texto, status de leitura e periodo
- Se houver erro no carregamento, o usuario recebe feedback claro
- Paginacao permite navegar grandes volumes de dados

