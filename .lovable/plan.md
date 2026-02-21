
## Correcao: Conteudo da movimentacao com dados antigos/cortados

### Problema

O campo `conteudo` no banco de dados contem o formato antigo com codigos numericos (ex: "designada: 9; Juiz(a): 185"). A correcao anterior so mudou como NOVOS dados sao salvos, mas os 590+ registros existentes continuam com o formato antigo. O dialog mostra `selectedPub.conteudo` diretamente do banco em vez de reconstruir o texto a partir do `raw_data`.

### Solucao (2 mudancas)

#### 1. Frontend: Reconstruir conteudo a partir do raw_data

No dialog de detalhes (`PublicacoesDJE.tsx`, linha 654-660), em vez de mostrar `selectedPub.conteudo` diretamente, reconstruir o texto a partir dos dados estruturados do `raw_data`:

- Usar `rawMovimento.nome` como nome da movimentacao
- Usar os `complementos` ja calculados (linhas 585-592) como detalhes
- Usar `classeNome` como classe processual
- Juntar tudo de forma legivel, sem codigos numericos

Isso resolve o problema para TODOS os registros, novos e antigos, pois o `raw_data` sempre contem os dados originais da API.

#### 2. Edge function: Atualizar registros existentes no banco

Adicionar logica na action `enrich-existing` para tambem corrigir o campo `conteudo` dos registros que contem codigos numericos, reconstruindo-o a partir do `raw_data` salvo.

### Detalhes tecnicos

**`src/pages/PublicacoesDJE.tsx`** (dialog de detalhes):

```
// Antes (linha 658):
{selectedPub.conteudo || 'Conteudo nao disponivel'}

// Depois: reconstruir a partir do raw_data
const nomeMovimento = rawMovimento?.nome || '';
const complementosTexto = complementos?.join('; ') || '';
const conteudoFormatado = rawMovimento 
  ? `${nomeMovimento}${complementosTexto ? ` | ${complementosTexto}` : ''}${classeNome ? ` | ${classeNome}` : ''}`
  : selectedPub.conteudo;
// Mostrar conteudoFormatado em vez de selectedPub.conteudo
```

**`supabase/functions/pje-publicacoes/index.ts`** (action `enrich-existing`):

Alem de atualizar `destinatario`, tambem reconstruir e atualizar o campo `conteudo` para registros que contem codigos numericos (detectaveis por regex como `\d{2,3}` apos `:` nos complementos).

### Resultado esperado

- O dialog mostra conteudo legivel para TODOS os registros (antigos e novos)
- Complementos aparecem como "Situacao Da Audiencia: designada" em vez de "designada: 9"
- Nao depende mais de rebuscar dados no DataJud para corrigir registros antigos
