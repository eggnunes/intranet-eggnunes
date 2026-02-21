

## Correcao: Conteudo da movimentacao incompleto/cortado

### Problema identificado

O DataJud retorna nomes de movimentacao **hierarquicos** onde o campo `nome` contem apenas a parte filha do nome. Exemplo:
- Nome completo correto: "Audiencia de Instrucao e Julgamento"  
- O que a API retorna em `mov.nome`: "de Instrucao e Julgamento" (falta "Audiencia")

Alem disso, os complementos estao mostrando **codigos internos** em vez de descricoes legiveis:
- Atual: `designada: 9; Juiz(a): 185`
- Correto: `Situacao: designada; Dirigido por: Juiz(a)`

O campo `valor` nos complementos e um codigo numerico interno do DataJud, nao um texto util. Os campos `nome` e `descricao` contem a informacao legivel.

### Mudancas

**Arquivo: `supabase/functions/pje-publicacoes/index.ts`**

1. **Corrigir montagem do conteudo** (linha 251-266):
   - Nos complementos, usar `nome` como valor legivel e `descricao` como label, em vez de `nome: valor`
   - Formato novo: `situacao_da_audiencia: designada; dirigida_por: Juiz(a)` em vez de `designada: 9; Juiz(a): 185`

2. **Incluir o codigo do movimento para mapeamento futuro**: salvar `mov.codigo` no raw_data (ja e salvo com `movimento: mov`)

**Arquivo: `src/pages/PublicacoesDJE.tsx`**

1. **Melhorar exibicao dos complementos no dialog de detalhes**: ao renderizar complementos do `raw_data.movimento.complementosTabelados`, mostrar `descricao` como label e `nome` como valor (ignorando o campo `valor` numerico)

2. **Melhorar formatacao do conteudo principal**: se o conteudo comeca com "de " (indicando nome hierarquico truncado), nao ha como recuperar o pai da API, mas podemos deixar o conteudo mais limpo separando nome do movimento, complementos e classe em campos distintos no dialog em vez de tudo concatenado com `|`

### Detalhes tecnicos

**Edge function - nova logica de complementos:**

```
// Antes (mostra codigos numericos)
const complementos = (mov.complementosTabelados || [])
  .map(c => `${c.nome || ''}: ${c.valor || c.descricao || ''}`)
  .join('; ')

// Depois (mostra descricoes legiveis)
const complementos = (mov.complementosTabelados || [])
  .map(c => `${c.descricao || c.nome || ''}: ${c.nome || ''}`)
  .join('; ')
```

**Frontend - dialog de detalhes, renderizacao dos complementos:**

Ao renderizar `raw_data.movimento.complementosTabelados`, mostrar:
- Label: `descricao` (ex: "situacao_da_audiencia" -> formatar para "Situacao da Audiencia")  
- Valor: `nome` (ex: "designada", "Juiz(a)")
- Ignorar o campo `valor` numerico

### Resultado esperado

- Complementos mostram texto legivel em vez de codigos numericos
- Dialog de detalhes separa visualmente nome do movimento, complementos e classe processual
- Informacao mais clara e completa para o usuario
