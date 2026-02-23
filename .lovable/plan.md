

## Dashboard Analitico e Filtros Avancados para Gestao de Folgas

### Resumo

Transformar a pagina de Gestao de Folgas em um sistema completo com dashboard analitico (graficos e metricas), filtros avancados de busca, e garantir que folgas passadas possam ser cadastradas sem restricao.

---

### 1. Cadastro de Folgas Passadas

O formulario atual ja utiliza `<input type="date">` sem restricao de data minima, entao folgas passadas ja podem ser cadastradas. Nenhuma alteracao necessaria neste ponto.

---

### 2. Reestruturacao com Abas

A pagina `GestaoFolgas` passara a ter **duas abas**:

- **Dashboard**: Metricas resumidas + graficos analiticos
- **Registros**: Tabela CRUD com filtros avancados (conteudo atual aprimorado)

---

### 3. Dashboard Analitico (nova aba)

**Cards de metricas no topo:**
- Total de folgas no ano atual
- Total de folgas no mes atual
- Colaborador com mais folgas no ano
- Motivo mais frequente

**Graficos (usando Recharts, ja instalado):**
- **Grafico de barras**: Folgas por mes (ultimos 12 meses)
- **Grafico de pizza**: Distribuicao por motivo
- **Grafico de barras horizontal**: Ranking de colaboradores com mais folgas no ano

Os dados serao buscados com uma query sem filtro de mes (todo o ano atual) para alimentar o dashboard.

---

### 4. Filtros Avancados na aba Registros

Substituir os filtros atuais (mes + colaborador) por um painel mais completo:

| Filtro | Tipo | Descricao |
|---|---|---|
| Periodo (De/Ate) | date range | Dois inputs de data para intervalo personalizado |
| Colaborador | select | Dropdown com todos os colaboradores |
| Motivo | text input | Busca textual no campo motivo |
| Ano | select | Selecao rapida por ano (2024, 2025, 2026...) |

Botao "Limpar filtros" para resetar todos.

---

### Detalhes Tecnicos

**Arquivos a modificar:**
- `src/components/rh/RHFolgas.tsx` - Adicionar abas (Dashboard + Registros), graficos com Recharts, filtros avancados
- `src/pages/GestaoFolgas.tsx` - Sem alteracao (ja renderiza RHFolgas)

**Bibliotecas utilizadas:**
- `recharts` (ja instalado) para graficos
- `@/components/ui/chart` (ChartContainer, etc.) para estilizacao consistente
- `@/components/ui/tabs` para abas

**Busca de dados do dashboard:**
- Uma query separada buscando todas as folgas do ano atual (sem filtro de mes) para calcular metricas e alimentar graficos
- Agrupamento feito no frontend (por mes, por motivo, por colaborador)

