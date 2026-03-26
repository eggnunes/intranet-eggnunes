

## Adicionar aba Instagram ao Marketing Hub

### Visão geral
Criar uma nova aba "Instagram" no Marketing Hub com métricas do perfil, gráficos de engajamento/crescimento de seguidores, e os 10 posts mais engajados. Os dados virão da Instagram Graph API (parte do ecossistema Meta), usando o mesmo token já configurado no Meta Ads.

### Como funciona
A Instagram Graph API permite acessar métricas de contas Business/Creator conectadas a uma Facebook Page. O token do Meta Ads já configurado pode ser reutilizado — basta descobrir o Instagram Business Account ID vinculado.

### Alterações

**1. Nova edge function: `supabase/functions/instagram-insights/index.ts`**

Ações suportadas:
- `account_info`: Busca o Instagram Business Account ID via Pages do Facebook, retorna bio, seguidores, seguindo, total de posts, foto de perfil, nome e username
- `media`: Busca os últimos posts com métricas (likes, comments, shares, saves, reach, impressions)
- `top_engaged`: Retorna os 10 posts com maior engajamento (likes + comments)
- `audience_insights`: Métricas de audiência (crescimento, demographics) via account insights endpoint
- `daily_insights`: Métricas diárias (impressions, reach, follower_count, profile_views) para gráficos

Fluxo para descobrir o IG Account ID:
1. `GET /me/accounts` com o token → lista Pages
2. Para cada Page: `GET /{page_id}?fields=instagram_business_account`
3. Armazena o IG account ID na tabela `meta_ads_config` (nova coluna `instagram_account_id`)

**2. Migração de banco: adicionar coluna**
```sql
ALTER TABLE meta_ads_config ADD COLUMN IF NOT EXISTS instagram_account_id TEXT;
```

**3. Novo componente: `src/components/marketing/InstagramTab.tsx`**

Seções da aba:
- **Perfil**: foto, nome, username, bio, seguidores, seguindo, total de posts
- **Cards de métricas**: seguidores, alcance, impressões, visitas ao perfil (período selecionado)
- **Gráfico de crescimento**: linha temporal de seguidores ao longo do período
- **Gráfico de engajamento**: barras com likes/comments por dia
- **Top 10 posts**: grid de cards com thumbnail, caption (resumida), likes, comments, data — ordenados por engajamento total

**4. Atualização: `src/pages/MarketingHub.tsx`**
- Importar `InstagramTab`
- Adicionar tab trigger "Instagram" com ícone do Instagram (usar ícone existente ou similar)
- Passar `dateRange` como prop

### Detalhes técnicos
- A Instagram Graph API v25.0 será usada (mesma versão do Meta Ads)
- Métricas de mídia: `like_count`, `comments_count`, `timestamp`, `media_type`, `thumbnail_url`, `permalink`, `caption`
- Insights da conta: `impressions`, `reach`, `follower_count`, `profile_views` com `period=day`
- O token precisa das permissões `instagram_basic`, `instagram_manage_insights`, `pages_show_list` — se não tiver, o sistema mostrará mensagem orientando a reconfigurar o token

### Resultado
- Nova aba "Instagram" no Marketing Hub
- Métricas do perfil em tempo real
- Gráficos de crescimento de seguidores e engajamento
- Top 10 posts mais engajados com thumbnails
- Tudo usando o mesmo token já configurado no Meta Ads

