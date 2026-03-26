

## Melhorar exibição de jurisprudências: links de fonte, ementa copiável e metadados

### Alterações

#### 1. Edge function: capturar citations do Perplexity
**Arquivo:** `supabase/functions/search-jurisprudence/index.ts`

- Extrair `data.citations` da resposta da API Perplexity (campo retornado automaticamente pelo sonar-pro)
- Incluir no retorno JSON como `citations: string[]`

#### 2. Adicionar link de fonte em cada jurisprudência no prompt
**Arquivo:** `supabase/functions/search-jurisprudence/index.ts`

- No prompt do sistema, pedir que cada jurisprudência inclua campo `"link_fonte"` com a URL da fonte original (quando disponível)

#### 3. Frontend: ementa com metadados + botão copiar + link fonte
**Arquivo:** `src/pages/PesquisaJurisprudencia.tsx`

- Atualizar interface `JurisprudenciaItem` para incluir `link_fonte?: string`
- Atualizar interface `ParsedResult` para incluir `citations?: string[]`
- Na seção da ementa de cada card (linhas 558-564):
  - Incluir entre parênteses antes da ementa: número do processo, data de julgamento, relator, órgão julgador
  - Adicionar botão "Copiar Ementa" que copia a ementa completa COM os metadados entre parênteses
- Adicionar botão/link "Ver Fonte" quando `link_fonte` estiver disponível (abre em nova aba)
- Exibir seção "Fontes" no final dos resultados com as citations do Perplexity (links clicáveis)
- Importar `Copy`, `ExternalLink` do lucide-react

#### Formato da ementa copiada
```
(Processo nº [numero_processo], Rel. [relator], [orgao_julgador], julgado em [data_julgamento])
[ementa completa]
```

### Resultado
- Cada jurisprudência terá link clicável para a fonte original
- A ementa exibirá metadados entre parênteses (processo, relator, órgão, data)
- Botão de copiar copia ementa + metadados com um clique
- Fontes do Perplexity aparecem no final como links

