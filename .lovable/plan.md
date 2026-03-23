# Nova Aba "Relatório por Anúncios" no Marketing Hub

## O que será feito

Criar uma aba "Leads por Anúncio" no Marketing Hub que cruza dados de anúncios do Meta Ads com leads capturados (`captured_leads`), permitindo ver quais anúncios de quais campanhas estão gerando leads e quais não estão — com opção de pausar/ativar anúncios diretamente.

---

## Componentes

### 1. Edge Function: `meta-ads` — Nova action `ad_insights`

Adicionar uma action que busca dados no nível de **anúncio** (ad) da Meta API v25.0:

- Endpoint: `/{actId}/ads?fields=id,name,status,campaign_id,adset_id,adset{name},campaign{name}` 
- Endpoint: `/{actId}/insights?level=ad&fields=ad_name,ad_id,adset_name,adset_id,campaign_name,campaign_id,impressions,clicks,spend,actions,ctr,cpc`
- Também adicionar action `update_ad_status` para pausar/ativar anúncios individuais

### 2. Novo componente: `src/components/marketing/AdPerformanceReport.tsx`

Dashboard com:

- **Filtros**: Período (7/30/90 dias ou custom), Campanha (dropdown), Conjunto de Anúncios (dropdown), "Só com leads" / "Só sem leads"
- **Cards resumo**: Total de anúncios ativos, anúncios com leads, anúncios sem leads, CPL médio
- **Tabela principal** agrupada por campanha:
  - Colunas: Anúncio, Conjunto, Status, Impressões, Cliques, Gasto, Leads (cruzado com `captured_leads.utm_term`), CPL, Ações (Pausar/Ativar)
  - Cruzamento: `captured_leads.utm_term` = nome do anúncio (conforme template UTM do Meta Ads)
  - Ordenação por qualquer coluna
- **Gráfico de barras**: Top anúncios por leads
- **Gráfico de pizza**: Distribuição de leads por campanha

### 3. MarketingHub.tsx — Nova aba

Adicionar tab "Anúncios" com ícone na lista de tabs existente, renderizando o novo componente.

---

## Lógica de cruzamento de dados

O template UTM do Meta Ads já configurado mapeia:

- `utm_campaign` → `{{campaign.name}}`  
- `utm_content` → `{{adset.name}}`  
- `utm_term` → `{{ad.name}}`

O cruzamento será feito assim:

1. Buscar insights da Meta API no nível de anúncio
2. Buscar `captured_leads` no período, filtrados por `utm_source` contendo facebook/meta/instagram
3. Para cada anúncio, contar leads onde `utm_term` = nome do anúncio
4. Exibir lado a lado: métricas do Meta + leads reais capturados

---

## Arquivos afetados


| Arquivo                                            | Ação                                                              |
| -------------------------------------------------- | ----------------------------------------------------------------- |
| `supabase/functions/meta-ads/index.ts`             | **Editar** — Adicionar actions `ad_insights` e `update_ad_status` |
| `src/components/marketing/AdPerformanceReport.tsx` | **Criar** — Componente completo do relatório                      |
| `src/pages/MarketingHub.tsx`                       | **Editar** — Adicionar aba "Anúncios"                             |
