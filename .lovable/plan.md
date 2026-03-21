

## Reorganizar abas do Lead Tracking

### Mudanca solicitada

Reordenar as abas de 6 tabs individuais para 5 tabs com a seguinte estrutura:

**Ordem atual:** UTM | Formularios | URL Produto | Leads | Comparar | WhatsApp

**Nova ordem:**
1. **Formularios** — `LeadFormsManager`
2. **Leads** — `LeadsDashboard`
3. **Comparar** — `LeadCampaignComparison`
4. **URL Produto** — `LandingPageProductMappings`
5. **Configuracoes** — Nova aba que agrupa internamente:
   - Gerador UTM (`UTMGenerator`)
   - Webhook WhatsApp (`WhatsAppWebhookInfo`)

### Arquivo modificado

**`src/pages/LeadTracking.tsx`**
- Reordenar os `TabsTrigger` e `TabsContent` na nova sequencia
- Alterar `defaultValue` de `"utm"` para `"forms"`
- Alterar `grid-cols-6` para `grid-cols-5`
- Adicionar aba "Configuracoes" com icone `Settings`
- Dentro do `TabsContent` de configuracoes, renderizar ambos `UTMGenerator` e `WhatsAppWebhookInfo` empilhados (com Cards separados ou sub-tabs simples)
- Adicionar import de `Settings` do lucide-react

