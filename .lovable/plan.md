
## Correção definitiva: Substituir API corporativa do CNJ pela API pública DataJud

### Problema real
A API `comunicaapi.pje.jus.br/api/v1` **exige credenciais institucionais** (usuario/senha cadastrados no sistema corporativo do CNJ). Sem essas credenciais, ela retorna 404. Nao e um problema de CORS nem de regiao -- a API simplesmente nao e publica.

A funcao `sync-pje-publicacoes` ja usa a **API publica do DataJud** (`api-publica.datajud.cnj.jus.br`) com sucesso. A solucao e fazer o botao "Buscar na API do CNJ" usar essa mesma API publica.

### Limitacao importante
A API DataJud **nao suporta busca por OAB ou nome de advogado** -- ela busca por **numero de processo**. Portanto, a estrategia sera:

1. Buscar todos os numeros de processo do escritorio (da tabela `advbox_tasks`)
2. Consultar o DataJud para cada processo, buscando movimentacoes recentes
3. Salvar resultados no cache `publicacoes_dje`

### Mudancas tecnicas

**Arquivo: `supabase/functions/pje-publicacoes/index.ts`**

1. Remover referencia a `comunicaapi.pje.jus.br` e a funcao `fetchJsonSafely` orientada ao CloudFront
2. Adicionar a chave publica do DataJud e a logica de mapeamento de processos (mesma do `sync-pje-publicacoes`)
3. Reescrever a action `search-api` para:
   - Buscar processos unicos de `advbox_tasks` (filtrando por tribunal se informado)
   - Para cada processo, consultar o endpoint DataJud correto
   - Filtrar movimentacoes por palavras-chave relevantes (intimacao, citacao, publicacao)
   - Filtrar por datas se informadas
   - Salvar no cache `publicacoes_dje`
   - Retornar contagem de resultados
4. Reescrever `check-credentials` para verificar conectividade com DataJud em vez do CNJ
5. Manter as actions `search-local`, `mark-read`, `mark-unread` sem alteracoes

**Arquivo: `src/pages/PublicacoesDJE.tsx`**

1. Atualizar label do botao de "Buscar na API do CNJ" para "Buscar no DataJud"
2. Atualizar mensagens de toast para refletir a nova fonte (DataJud)
3. Manter filtros de OAB/advogado para uso na busca local, mas explicar no UI que a busca externa usa processos cadastrados

### Resultado esperado
O botao de busca externa vai funcionar de verdade, consultando a API publica do DataJud para todos os processos do escritorio e trazendo movimentacoes recentes para o cache local.
