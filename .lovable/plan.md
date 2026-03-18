

# Marketing Hub

## O que já existe
- `CRMCampaigns` — grid de campanhas com ROI, investimento, leads e receita (dentro do CRM)
- `MarketingAutomation` — automações de marketing (dentro do CRM)
- Não existe página dedicada de Marketing Hub, nem integração Meta Ads, nem calendário de publicações, nem funil dedicado, nem relatórios ROI com gráficos

## Plano

### 1. Nova tabela `marketing_publications` (migração)
Para o calendário de publicações planejadas:
- `id`, `title`, `description`, `platform` (facebook/instagram/linkedin/google/tiktok), `scheduled_date`, `status` (draft/scheduled/published), `campaign_id` (FK optional para crm_campaigns), `created_by`, `created_at`

### 2. Nova página `src/pages/MarketingHub.tsx`
Página standalone com 5 abas + filtros globais + greeting dinâmico.

**Header**:
- Greeting dinâmico: "Bom dia/Boa tarde/Boa noite, [nome]" baseado em `new Date().getHours()`
- Filtros globais persistentes acima das tabs:
  - Seletor de conta Meta (dropdown, dados mockados inicialmente — sem API real do Meta sem token)
  - Seletor de período: últimos 7, 30, 90 dias ou custom (date range picker)

**Aba 1 — Campanhas**: Reutiliza `CRMCampaigns` existente, passando filtro de período como prop

**Aba 2 — Meta Ads**: Cards de métricas simuladas (Impressões, Cliques, CTR, CPC, Gastos) + tabela de anúncios. Dados mockados com aviso "Conecte sua conta Meta Ads para dados reais". Estrutura pronta para integração futura via edge function

**Aba 3 — Calendário**: Calendário mensal mostrando publicações de `marketing_publications`. Criar/editar publicações via dialog. Dias com publicações marcados visualmente

**Aba 4 — Relatórios ROI**: Gráficos Recharts (BarChart ROI por campanha, LineChart evolução temporal, PieChart distribuição por plataforma). Dados de `crm_campaigns`

**Aba 5 — Funil**: Visualização do funil de vendas usando BarChart horizontal (Leads → Qualificados → Propostas → Fechados). Dados de `crm_deals` + `crm_deal_stages`

### 3. Rota no `App.tsx`
- `/negocios/marketing` dentro de `ProtectedRoute` + `Layout`

### 4. Link no sidebar
- Adicionar "Marketing Hub" no `AppSidebar.tsx` na seção de negócios

### Arquivos
1. **Migração SQL** — tabela `marketing_publications` + RLS
2. **`src/pages/MarketingHub.tsx`** (novo) — página completa com 5 abas
3. **`src/App.tsx`** — rota
4. **`src/components/AppSidebar.tsx`** — link no menu

