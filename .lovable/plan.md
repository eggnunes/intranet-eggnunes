

# Página de Campanhas de Marketing

## Resumo

Criar uma página dedicada para gerenciar campanhas de marketing (Facebook, Instagram, Google, etc.) com cards visuais, métricas de ROI, e modal de criação/edição. Será uma nova aba "Campanhas" dentro do CRM Dashboard.

## Banco de Dados

Nova tabela `crm_campaigns` com campos:
- `id`, `name`, `platform` (facebook, instagram, google, linkedin, tiktok, outro), `type` (trafego, conversao, branding), `investment` (numeric), `start_date`, `end_date`, `status` (active, paused, completed), `created_by` (FK profiles), `created_at`, `updated_at`
- Leads gerados e fechamentos serão calculados em tempo real a partir de `crm_contacts` (campo `traffic_source`) e `crm_deals` (campo `campaign_name` + `won`)
- RLS: authenticated users can view all; only admins/sócios or creator can insert/update/delete

## Componente: `CRMCampaigns.tsx`

1. **Grid de cards** com cores por plataforma (Facebook=azul, Instagram=rosa, Google=amarelo, LinkedIn=azul escuro, TikTok=preto)
2. Cada card mostra: nome, plataforma badge, tipo, investimento, leads (contados de `crm_contacts`), fechamentos (contados de `crm_deals` won), ROI calculado
3. **Botão "Nova Campanha"** visível apenas para admin/sócio
4. **Botão "Editar"** em cada card (mesmo controle de acesso)
5. **Modal de criação/edição** com: nome, plataforma (select), tipo (select), investimento (input numérico), data início e fim (datepickers)
6. Animações via CSS (fade-in nos cards) — não usaremos Framer Motion pois não está instalado no projeto; usaremos as animações Tailwind existentes

## Integração

- Nova aba "Campanhas" no `CRMDashboard.tsx` (ícone `Megaphone`)
- Exportar componente no `src/components/crm/index.ts`

## Arquivos

1. **Migração SQL** — criar tabela `crm_campaigns` com RLS
2. **`src/components/crm/CRMCampaigns.tsx`** (novo)
3. **`src/components/crm/CRMDashboard.tsx`** — adicionar aba
4. **`src/components/crm/index.ts`** — exportar

