

## Diferenciar aba "Campanhas" (geral) da aba "Meta Ads" (só Meta)

### Problema
As abas "Campanhas" e "Meta Ads" renderizam o mesmo componente `<MetaAdsTab>`, mostrando dados idênticos. "Campanhas" deveria ser uma visão consolidada (Google + Meta).

### Solução

**Arquivo: `src/pages/MarketingHub.tsx`**

Substituir o conteúdo da `TabsContent value="campanhas"` (linha 485-487) por uma visão consolidada que:

1. **Cards de resumo geral** — Somar métricas de Meta + Google:
   - Impressões totais, Cliques totais, Gasto total, Conversões totais, CPL médio
   - Badge indicando a plataforma de origem em cada métrica

2. **Tabela consolidada de campanhas** — Unir campanhas do Meta (já disponíveis via query `meta-ads` action `campaigns`) e Google (já disponíveis em `googleCampaigns`) numa única tabela:
   - Coluna "Plataforma" com badge colorido (Meta/Google)
   - Colunas: Nome, Plataforma, Status, Impressões, Cliques, CTR, CPC, Gasto
   - Ordenação padrão por gasto (decrescente)

3. **Gráfico de distribuição por plataforma** — Reutilizar o `PieChart` de distribuição já calculado em `platformDistribution`

4. **Buscar campanhas Meta** — Adicionar nova query usando `meta-ads` action `campaigns` (já existe para insights, mas precisa trazer campanhas para a aba geral). Os dados de campanhas Meta já são carregados pelo `MetaAdsTab`, mas para a aba consolidada serão buscados diretamente no `MarketingHub`.

### Detalhes técnicos

- Nova query `marketing-meta-campaigns` chamando edge function `meta-ads` com `action: 'campaigns'`
- Normalizar formato: Meta campaigns vêm com `{id, name, status, ...}` e Google campaigns com `{id, name, status, impressions, clicks, ...}`
- Para Meta, cruzar com `metaInsights` para obter métricas (impressões, cliques, gasto) por campaign_id
- Manter a aba "Meta Ads" inalterada (continua com `<MetaAdsTab>`)

