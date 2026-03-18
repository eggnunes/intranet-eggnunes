

# Pesquisa de Humor

## Resumo
Criar uma nova pagina `/pesquisa-humor` com sistema de pesquisa de humor diario, historico pessoal com grafico de tendencia, e painel de gestao para socios/admins com dados agregados e alertas.

## Implementacao

### 1. Migracao SQL — tabela `mood_surveys`
Campos: `id` (UUID), `user_id` (UUID ref profiles), `mood` (TEXT — muito_bom, bom, neutro, ruim, muito_ruim), `observacoes` (TEXT nullable), `created_at` (TIMESTAMPTZ default now()).
RLS: usuarios autenticados aprovados podem inserir/ler os proprios registros. Admins e socios podem ler todos.

### 2. Nova pagina `src/pages/PesquisaHumor.tsx`

**Para todos os usuarios:**
- **Botao "Registrar Humor"** abre Dialog/modal:
  - Pergunta: "Como esta seu humor hoje?"
  - 5 opcoes com emojis: 😄 Muito Bom, 🙂 Bom, 😐 Neutro, 😟 Ruim, 😢 Muito Ruim
  - Campo de observacoes (Textarea, opcional)
  - Botao "Enviar" — insere na `mood_surveys`, limita 1 por dia
- **Historico pessoal:**
  - Grafico de linha (Recharts LineChart) com tendencia dos ultimos 30 dias (mood mapeado 1-5)
  - Tabela com Data, Humor (badge + emoji), Observacoes

**Para gestores (isAdmin ou position = 'socio'):**
- Aba/secao adicional "Visao Geral":
  - Grafico de barras agregado: distribuicao de humor de todos os funcionarios no periodo
  - Filtro por departamento/position (socio, advogado, estagiario, comercial, administrativo)
  - Alertas: cards destacando usuarios com humor "ruim" ou "muito_ruim" nos ultimos 7 dias

### 3. Rota e sidebar
- Rota `/pesquisa-humor` no `App.tsx`
- Link no `AppSidebar.tsx` na secao de RH com icone `SmilePlus`

### Arquivos
1. **Migracao SQL** — tabela `mood_surveys` + RLS
2. **`src/pages/PesquisaHumor.tsx`** (novo)
3. **`src/App.tsx`** — rota
4. **`src/components/AppSidebar.tsx`** — link

