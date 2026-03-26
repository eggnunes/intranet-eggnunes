

## Puxar andamentos do DataJud para a Tradução de Andamentos

### Correção do plano anterior
Será buscado **apenas** da fonte **DataJud** (coluna `meio = 'DataJud'`). Os registros do ComunicaPJe (intimações) serão ignorados, pois são específicos de cada caso.

### Como funciona
A tabela `publicacoes_dje` tem uma coluna `meio` que diferencia as fontes:
- **DataJud** (1.511 registros) — andamentos processuais genéricos
- **ComunicaPJe** (340 registros) — intimações específicas (serão ignoradas)

O campo `conteudo` do DataJud segue o padrão: `"Tipo do Andamento | detalhe: valor | Classe Processual"`. Exemplo: `"Petição | Petição (outras): 57 | Usucapião"`. Será extraída apenas a primeira parte antes do `|` como título do andamento.

### Alterações

**Arquivo:** `src/pages/TraducaoAndamentos.tsx`

Na função `loadData()`, após extrair títulos do ADVBox, adicionar:

1. Consultar `publicacoes_dje` filtrando `meio = 'DataJud'`, selecionando apenas `conteudo`
2. Para cada registro, extrair a parte antes do primeiro `|` (ex: `"Petição"`, `"Expedição de documento"`, `"Publicação"`)
3. Normalizar com `normalizeTitle()` e adicionar ao `Set` de títulos únicos — sem duplicatas com os do ADVBox
4. Mesclar na lista final ordenada

### Detalhes técnicos
```typescript
const { data: datajud } = await supabase
  .from('publicacoes_dje')
  .select('conteudo')
  .eq('meio', 'DataJud')
  .not('conteudo', 'is', null);

for (const pub of (datajud || [])) {
  const mainPart = (pub.conteudo || '').split('|')[0].trim();
  if (mainPart.length > 2) {
    const normalized = normalizeTitle(mainPart);
    if (normalized.length > 2) titleSet.add(normalized);
  }
}
```

### Resultado
- Andamentos do DataJud (movimentações processuais) são adicionados à lista de tradução
- Intimações do ComunicaPJe são ignoradas
- Títulos deduplicados e normalizados com os já existentes do ADVBox

