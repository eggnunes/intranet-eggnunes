

# Modo TV para Escritório

## Resumo
Criar página fullscreen `/negocios/tv` para exibição em TVs, com dark mode forçado, funil de vendas (Recharts), KPIs e feed de movimentações com auto-scroll. Dados atualizados a cada 30s.

## O que não existe
Nenhuma página TV Mode existe no projeto. Funcionalidade totalmente nova.

## Implementação

### 1. Nova página `src/pages/TVMode.tsx`
- Layout 100vh sem sidebar/header, dark mode forçado via classe `dark` no container
- **Topo**: logo (`/logo-eggnunes.png`), relógio digital (atualizado a cada segundo via `setInterval`), data formatada
- **Centro**: Funil de vendas usando `FunnelChart` ou `BarChart` horizontal do Recharts, com dados de `crm_deal_stages` + contagem de deals por stage. Cards grandes com KPIs: Total Leads (`crm_contacts`), Agendamentos (`crm_activities` tipo meeting), Contratos Fechados (`crm_deals` where `won = true`)
- **Lateral direita**: Lista "Últimas Movimentações" de `crm_deal_history` com joins em `crm_deals` e `profiles`, auto-scroll CSS animation
- **Auto-refresh**: `setInterval` de 30s recarregando dados, indicador visual (spinner sutil)

### 2. Rota no `App.tsx`
- Rota `/negocios/tv` **sem** `ProtectedRoute` wrapper com Layout — renderiza `TVMode` diretamente dentro de `ProtectedRoute` mas sem o `Layout` component
- Importar e adicionar rota

### Arquivos
1. **`src/pages/TVMode.tsx`** (novo) — página completa
2. **`src/App.tsx`** — adicionar rota

