
# Reorganizacao do ADVBox - Dashboard, Abas e Correcoes

## Resumo das Mudancas

1. **Remover "Portais de Tribunais"** do ProcessosDashboard (ja existe em Gestao Processual)
2. **Reorganizar a pagina de Processos** em abas: Dashboard | Movimentacoes
3. **Mover "Produtividade" para dentro de "Tarefas"** no menu lateral
4. **Mover "Historico Mensagens" para dentro de "Aniversarios Clientes"** no menu lateral (e tambem no Financeiro se houver mensagens financeiras)
5. **Corrigir KPIs do Dashboard** (Processos Novos, Arquivados, Crescimento Liquido mostrando "---" ou 0)
6. **Remover limite de 100** movimentacoes - usar movimentacoes completas desde o inicio

---

## Detalhes Tecnicos

### 1. ProcessosDashboard.tsx - Reorganizar em Abas

**Estrutura atual:** Tudo em uma unica pagina com Accordions (Visao Geral, Timeline, Processos Ativos, Movimentacoes Recentes, Portais de Tribunais).

**Nova estrutura com Tabs:**

```text
[Dashboard]  [Movimentacoes]
```

- **Aba "Dashboard"**: KPIs (Processos Ativos, Movimentacoes no Periodo, Processos Novos, Processos Arquivados, Crescimento Liquido) + graficos de evolucao + distribuicao por tipo/responsavel + processos ativos (lista)
- **Aba "Movimentacoes"**: Timeline de movimentacoes + filtros + busca + lista completa de movimentacoes (o conteudo que hoje esta nos accordions de Timeline e Movimentacoes Recentes)
- **Remover**: Accordion de "Portais de Tribunais" completamente

### 2. Correcao dos KPIs

**Problema:** Com dados parciais (100 de 11.816), os KPIs de "Processos Novos", "Arquivados" e "Crescimento Liquido" mostram "---" ou 0 porque so temos 100 processos carregados e nenhum deles cai no periodo dos ultimos 30 dias.

**Solucao:**
- Na aba Dashboard, carregar automaticamente `lawsuits-full` (todos os processos) ao inves de apenas a primeira pagina (`lawsuits`). Isso ja existe como funcao `loadFullData`, mas hoje so e acionada manualmente pelo botao "Carregar Todos"
- Mudar a chamada inicial `fetchData()` para usar o endpoint `lawsuits-full` por padrao
- Remover o alerta de "Dados parciais" e o botao "Carregar Todos" uma vez que sempre buscamos tudo
- Se a busca completa for lenta, mostrar um loading adequado com progresso

### 3. Remover limite de 100 movimentacoes

- O endpoint `last-movements` busca apenas a primeira pagina (100 itens)
- Mudar para chamar `movements-full` desde o inicio ao inves de `last-movements` + `loadFullMovements` separado
- Remover a logica separada de `fullMovements` vs `movements` - usar apenas uma lista unica

### 4. Menu Lateral (AppSidebar.tsx)

**Mudancas no grupo ADVBOX:**
- Remover "Produtividade" como item separado (`/relatorios-produtividade-tarefas`)
- Remover "Historico Mensagens" como item separado (`/historico-mensagens-aniversario`)

**Resultado:**
```text
ADVBOX:
  - Processos (com abas Dashboard/Movimentacoes)
  - Publicacoes
  - Tarefas (com Produtividade integrada)
  - Financeiro
  - Analytics
  - Aniversarios Clientes (com Historico Mensagens integrado)
```

### 5. TarefasAdvbox.tsx - Integrar Produtividade

- Adicionar uma nova aba "Produtividade" dentro da pagina de Tarefas
- Incorporar o conteudo de `RelatoriosProdutividadeTarefas` como componente dentro dessa aba
- Manter a rota `/relatorios-produtividade-tarefas` funcionando (redirect ou render direto) para nao quebrar links existentes

### 6. AniversariosClientes.tsx - Integrar Historico de Mensagens

- Adicionar uma nova aba "Historico" dentro da pagina de Aniversarios Clientes
- Incorporar o conteudo de `HistoricoMensagensAniversario` filtrado por tipo `birthday` como componente dentro dessa aba
- O historico de mensagens de cobranca (`collection`/`documents`) ja esta vinculado ao financeiro via `CollectionManagement`; se nao estiver, adicionar la tambem

### 7. Rotas (App.tsx)

- Manter rotas existentes para compatibilidade, mas redirecionar `/relatorios-produtividade-tarefas` para `/tarefas-advbox?tab=produtividade`
- Manter `/historico-mensagens-aniversario` funcionando mas redirecionar para `/aniversarios-clientes?tab=historico`

---

## Arquivos a Modificar

| Arquivo | Mudanca |
|---|---|
| `src/pages/ProcessosDashboard.tsx` | Reorganizar em Tabs (Dashboard/Movimentacoes); Remover Portais de Tribunais; Usar lawsuits-full e movements-full desde inicio; Corrigir KPIs |
| `src/components/AppSidebar.tsx` | Remover Produtividade e Historico Mensagens do menu |
| `src/pages/TarefasAdvbox.tsx` | Adicionar aba "Produtividade" com conteudo do RelatoriosProdutividadeTarefas |
| `src/pages/AniversariosClientes.tsx` | Adicionar aba "Historico" com conteudo do HistoricoMensagensAniversario (filtrado por birthday) |
| `src/pages/RelatoriosProdutividadeTarefas.tsx` | Extrair logica principal para componente reutilizavel ou redirecionar |
| `src/pages/HistoricoMensagensAniversario.tsx` | Extrair logica para componente reutilizavel ou redirecionar |
| `src/App.tsx` | Adicionar redirects das rotas antigas |
