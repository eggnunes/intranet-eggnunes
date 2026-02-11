
# Reorganizacao ADVBox - Movimentacoes como Submenu + Analytics Integrado ao Dashboard

## Resumo

1. **Separar Movimentacoes** como pagina propria no menu do ADVBox (entre Processos e Publicacoes)
2. **Remover aba "Movimentacoes"** de dentro de ProcessosDashboard - deixar so o Dashboard
3. **Remover Analytics** como item separado e integrar seus graficos ao Dashboard de Processos
4. **Aplicar stale-while-revalidate** no Analytics integrado (dados do cache primeiro, refresh em background)
5. **Adicionar mais filtros e graficos** ao Dashboard de Processos

---

## Arquivos a Modificar

### 1. `src/pages/MovimentacoesAdvbox.tsx` (NOVO)

Pagina dedicada para Movimentacoes, extraida da aba atual do ProcessosDashboard:
- Conteudo completo da aba "Movimentacoes" atual (busca, filtros de periodo/status/responsavel, lista de movimentacoes, TaskSuggestionsPanel)
- Adicionar filtros extras: filtro por tipo de acao, filtro por area/grupo, filtro por data especifica (date range picker)
- Usa mesma logica de cache (localStorage) para carregar instantaneamente
- Refresh silencioso em background (stale-while-revalidate)
- Timeline grafico de movimentacoes por dia

### 2. `src/pages/ProcessosDashboard.tsx`

- **Remover** a estrutura de Tabs (Dashboard/Movimentacoes) - pagina vira apenas Dashboard
- **Integrar graficos do Analytics**: Evolucao de Processos (Novos vs Arquivados 12 meses), Taxa de Crescimento Mensal (%), Evolucao por Tipo de Acao (Top 5), Top 10 Tipos de Acao, Processos por Responsavel, Processos por Area
- **Sem chamadas API extras**: Reutilizar os dados de `lawsuits` ja carregados para calcular os graficos do Analytics (mesmo dataset)
- **Adicionar filtros extras ao Dashboard**: Filtro por tipo de acao, filtro por area/grupo (alem dos que ja existem por responsavel)
- **Manter exportacao PDF/Excel** (trazer do Analytics a funcionalidade de exportacao)
- Remover import de Tabs/TabsList/TabsTrigger/TabsContent se nao for mais necessario

### 3. `src/components/AppSidebar.tsx`

Menu ADVBOX atualizado:
```text
ADVBOX:
  - Processos         (/processos)
  - Movimentacoes     (/movimentacoes-advbox)  <-- NOVO
  - Publicacoes       (/publicacoes)
  - Tarefas           (/tarefas-advbox)
  - Financeiro        (/relatorios-financeiros)
  - Aniversarios Clientes (/aniversarios-clientes)
```
- Remover "Analytics" (`/advbox-analytics`)
- Adicionar "Movimentacoes" com icone `AlertCircle` ou `FileText`

### 4. `src/App.tsx`

- Adicionar rota `/movimentacoes-advbox` -> `MovimentacoesAdvbox`
- Redirecionar `/advbox-analytics` -> `/processos` (compatibilidade)
- Import do novo componente

---

## Detalhes Tecnicos

### Graficos integrados ao Dashboard (vindos do Analytics)

Os graficos do Analytics serao calculados a partir do array `lawsuits` que ja esta carregado no Dashboard. Nao ha chamada API adicional. Os graficos serao:

1. **Evolucao de Processos** (LineChart - Novos vs Arquivados, ultimos 12 meses)
2. **Taxa de Crescimento Mensal %** (LineChart)
3. **Evolucao por Tipo de Acao Top 5** (LineChart - ultimos 6 meses)
4. **Top 10 Tipos de Acao** (BarChart horizontal)
5. **Processos por Responsavel** (BarChart)
6. **Processos por Area** (BarChart horizontal)
7. **Exportar Relatorio** (botao PDF/Excel - trazido do Analytics)

### Cache e Performance (MovimentacoesAdvbox)

```text
1. Abrir pagina -> Carrega movimentacoes do localStorage (MOVEMENTS_CACHE_KEY)
2. Exibe dados imediatamente (loading = false se cache existe)
3. Em background, chama movements-full para atualizar
4. Atualiza lista e cache quando resposta chegar
5. Indicador "Atualizando dados..." durante refresh
```

### Filtros adicionais na pagina de Movimentacoes

- Filtro por **tipo de acao** do processo associado
- Filtro por **area/grupo** do processo associado
- Filtro por **cliente** (busca textual)
- Filtros existentes mantidos: periodo, status, responsavel, busca textual

### Filtros adicionais no Dashboard de Processos

- Filtro por **tipo de acao** (checkbox multi-select)
- Filtro por **area/grupo** (checkbox multi-select)
- Filtros existentes mantidos: busca, responsavel
