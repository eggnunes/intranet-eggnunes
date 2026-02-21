

## Enriquecer publicacoes com dados do cliente e melhorar detalhes

### Problema

1. **Falta nome do cliente**: O DataJud nao retorna nomes de partes/clientes. Porem, a tabela `advbox_tasks` contem essa informacao em `raw_data -> lawsuit -> customers[]`. Atualmente esse dado nao e aproveitado.
2. **Data ambigua**: A coluna "Data" na tabela e "Data Disponibilizacao" no dialog nao deixam claro o que significam. Na verdade, o DataJud retorna `dataHora` de cada movimentacao -- ou seja, e a **data da movimentacao processual**.
3. **Dialog incompleto**: Campos como Destinatario, N. Comunicacao e Advogado sao inuteis para dados do DataJud. Faltam informacoes uteis como **nome do cliente**, **classe processual**, **assuntos** e **orgao julgador** que ja estao no `raw_data`.

### Solucao

#### Parte 1 - Edge function (`pje-publicacoes/index.ts`)

Na action `search-api`, apos buscar os processos do `advbox_tasks`, montar um mapa de **numero do processo -> nome do cliente** extraindo de `raw_data.lawsuit.customers[].name`:

```
// Montar mapa processo -> cliente
const clientesPorProcesso = new Map()
for (const p of processos) {
  if (p.raw_data?.lawsuit?.customers) {
    const nomes = p.raw_data.lawsuit.customers.map(c => c.name).join(', ')
    clientesPorProcesso.set(p.process_number, nomes)
  }
}
```

Ao montar cada registro para inserir, preencher o campo `destinatario` com o nome do cliente:

```
destinatario: clientesPorProcesso.get(numFormatado) || '',
```

Tambem incluir `assuntos` no `raw_data` salvo, ja que o DataJud retorna essa informacao.

#### Parte 2 - Frontend (`PublicacoesDJE.tsx`)

**Tabela de resultados:**
- Renomear coluna "Data" para "Data Movimentacao"
- Adicionar coluna "Cliente" mostrando `destinatario`

**Dialog de detalhes - reorganizar campos:**
- **Processo** e **Tribunal/Orgao Julgador** (como esta)
- **Cliente** (usando `destinatario` ou extraindo de `raw_data.processo`)
- **Classe Processual** (extrair de `raw_data.processo.classe.nome`)
- **Tipo da Movimentacao** (badge com tipo IN/CI/NT)
- **Data da Movimentacao** (renomear de "Data Disponibilizacao")
- **Conteudo da Movimentacao** (campo grande com texto completo)
- Remover campos que so mostram "-" (N. Comunicacao, Meio)

**Dados extraidos do raw_data no dialog:**
- `raw_data.processo.classe.nome` = Classe processual (ex: "Cumprimento de Sentenca contra a Fazenda Publica")
- `raw_data.processo.orgaoJulgador.nome` = Orgao julgador
- `raw_data.movimento.complementosTabelados` = Complementos da movimentacao
- Nomes dos clientes do `advbox_tasks` (via `destinatario`)

#### Parte 3 - Atualizar registros existentes

Criar uma action `enrich-existing` na edge function que:
1. Busca todas as publicacoes onde `destinatario` esta vazio
2. Para cada uma, busca o `process_number` correspondente em `advbox_tasks`
3. Extrai o nome do cliente do `raw_data.lawsuit.customers`
4. Atualiza o campo `destinatario`

Isso corrige os 590+ registros ja salvos sem precisar rebuscar no DataJud.

### Resumo das mudancas

| Arquivo | Mudanca |
|---------|---------|
| `supabase/functions/pje-publicacoes/index.ts` | Extrair nomes de clientes do advbox_tasks e salvar em `destinatario`; adicionar action `enrich-existing` |
| `src/pages/PublicacoesDJE.tsx` | Renomear "Data" para "Data Movimentacao"; adicionar coluna "Cliente"; redesenhar dialog com classe processual, orgao julgador e cliente; remover campos vazios |

### Resultado esperado

- A tabela mostra o nome do cliente em cada linha
- O dialog mostra: processo, cliente, classe processual, orgao julgador, data da movimentacao, conteudo completo
- A coluna de data deixa claro que e a data da movimentacao processual
- Os 590+ registros existentes sao enriquecidos com nomes de clientes automaticamente

