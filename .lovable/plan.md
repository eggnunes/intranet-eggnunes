

# Integracao da API Comunica PJe (DJEN) + Melhorias DataJud

## Contexto

O documento do Manus identifica **duas APIs** do CNJ:

1. **API Comunica PJe (DJEN)** - Busca publicacoes pelo nome dos advogados. **Esta API nao existe ainda no sistema** e e a principal addicao.
2. **API DataJud** - Busca movimentacoes por numero de processo. **Ja esta implementada** no sistema atual.

O sistema atual usa apenas o DataJud (via processos cadastrados no AdvBox). A integracao do Comunica PJe adiciona uma segunda fonte de dados que captura publicacoes de Diarios de Justica diretamente pelo nome dos advogados, cobrindo processos que podem nao estar cadastrados no AdvBox.

## Problema do Bloqueio Geografico

O Manus alerta que a API Comunica PJe tem bloqueio geografico (CloudFront). O sistema ja resolve isso para o DataJud executando a edge function na regiao `sa-east-1` (Sao Paulo). A mesma estrategia sera aplicada para o Comunica PJe.

## Mudancas Planejadas

### 1. Edge Function `pje-publicacoes/index.ts` - Nova action `search-comunicapje`

Adicionar uma nova action que:
- Faz requisicoes GET para `https://comunicaapi.pje.jus.br/api/v1/comunicacao`
- Busca por cada advogado configurado (Rafael Egg Nunes e Guilherme Zardo Rocha)
- Parametros: `nomeAdvogado` (URL-encoded, maiusculas), `dataDisponibilizacaoInicio`, `dataDisponibilizacaoFim`, `itensPorPagina=100`, `pagina`
- Implementa paginacao automatica (verifica `count` vs `itensPorPagina`)
- Mapeia campos da resposta: `texto` -> `conteudo`, `siglaTribunal` -> `tribunal`, `numeroprocessocommascara` -> `numero_processo`, `data_disponibilizacao` -> `data_disponibilizacao`
- Gera hash unico: `cpje-{numeroProcesso}-{data_disponibilizacao}` para evitar duplicatas
- Define `meio` = `'ComunicaPJe'` para distinguir da fonte DataJud
- Faz upsert na tabela `publicacoes_dje` (mesma tabela, nova fonte)

### 2. Edge Function `sync-pje-publicacoes/index.ts` - Adicionar Comunica PJe ao sync automatico

A funcao de sincronizacao diaria (cron) atualmente so consulta o DataJud. Sera adicionada a consulta ao Comunica PJe apos a consulta ao DataJud, seguindo a mesma logica:
- Buscar publicacoes dos ultimos 7 dias para cada advogado
- Fazer upsert no banco
- Incluir contagem no resultado final

### 3. Frontend `src/pages/PublicacoesDJE.tsx` - Botao de busca ComunicaPJe

Adicionar:
- Um novo botao "Buscar no Comunica PJe" ao lado do botao existente "Buscar no DataJud"
- Ao clicar, invoca a action `search-comunicapje` com os filtros de data
- Mostrar coluna ou badge indicando a fonte (`DataJud` ou `ComunicaPJe`) na tabela de resultados
- Filtro adicional por fonte/meio

### 4. Configuracao dos advogados

Os nomes dos advogados serao configurados diretamente na edge function como constante:

```text
ADVOGADOS = [
  { nome: 'RAFAEL EGG NUNES', display: 'Rafael Egg Nunes' },
  { nome: 'GUILHERME ZARDO ROCHA', display: 'Guilherme Zardo Rocha' },
]
```

## Detalhes Tecnicos

### Requisicao ao Comunica PJe

```text
GET https://comunicaapi.pje.jus.br/api/v1/comunicacao
  ?nomeAdvogado=RAFAEL%20EGG%20NUNES
  &dataDisponibilizacaoInicio=2026-02-22
  &dataDisponibilizacaoFim=2026-02-22
  &itensPorPagina=100
  &pagina=1
```

- Sem autenticacao (API publica)
- Requer IP brasileiro (regiao sa-east-1 resolve isso)
- Resposta: objeto com campo `items` (array de publicacoes) e `count` (total)
- Campos relevantes por item: `texto`, `data_disponibilizacao`, `siglaTribunal`, `numeroprocessocommascara`, `tipoComunicacao`, `nomeDestinatario`, `meio`

### Mapeamento de campos Comunica PJe -> publicacoes_dje

| Campo API | Campo Banco |
|---|---|
| `numeroprocessocommascara` | `numero_processo` |
| `siglaTribunal` | `tribunal` |
| `tipoComunicacao` (CI/IN/NT) | `tipo_comunicacao` |
| `data_disponibilizacao` | `data_disponibilizacao` |
| `data_disponibilizacao` | `data_publicacao` |
| `texto` | `conteudo` |
| `nomeDestinatario` | `destinatario` |
| `meio` (ex: "Diario") | `meio` -> salvar como `'ComunicaPJe'` |
| advogado buscado | `nome_advogado` |
| JSON completo do item | `raw_data` |

### Hash para deduplicacao

```text
cpje-{numeroProcessoSemMascara}-{data_disponibilizacao}-{primeiros30charsTexto}
```

### Logica de paginacao

```text
pagina = 1
loop:
  resultado = GET(url, pagina)
  salvar items
  if (pagina * itensPorPagina >= resultado.count) break
  pagina++
```

### Filtro por fonte no frontend

Adicionar opcao de filtro `meio` no client-side para permitir filtrar entre "Todas", "DataJud" e "ComunicaPJe".

## Arquivos modificados

1. `supabase/functions/pje-publicacoes/index.ts` - Adicionar action `search-comunicapje`
2. `supabase/functions/sync-pje-publicacoes/index.ts` - Adicionar busca ComunicaPJe ao sync diario
3. `src/pages/PublicacoesDJE.tsx` - Botao ComunicaPJe, coluna/badge de fonte, filtro por fonte

## O que NAO muda

- A integracao DataJud existente permanece intacta
- A tabela `publicacoes_dje` nao precisa de alteracao (ja tem os campos necessarios)
- O mecanismo de leitura/nao-lida continua igual
- O dialog de detalhes continua usando `reconstructContent` para registros DataJud, e mostra `conteudo` direto para registros ComunicaPJe (que ja vem com texto completo)

