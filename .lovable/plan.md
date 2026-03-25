

## Remover abas WhatsApp e Campanhas do CRM

### O que será feito
Remover as duas sub-abas sem utilidade do CRM principal: **WhatsApp** e **Campanhas**.

### Implementação

**Arquivo: `src/components/crm/CRMDashboard.tsx`**

1. **Remover imports** de `CRMWhatsAppLogs` e `CRMCampaigns` (linhas 18 e 22)
2. **Remover ícones não usados** (`MessageSquare`, `Megaphone`) do import de lucide-react
3. **Remover TabsTrigger** de "whatsapp" (linhas 319-322) e "campaigns" (linhas 327-330)
4. **Remover TabsContent** de "whatsapp" (linhas 496-498) e "campaigns" (linhas 504-506)

Nenhuma outra parte do sistema depende dessas abas — os componentes `CRMWhatsAppLogs.tsx` e `CRMCampaigns.tsx` continuarão existindo caso sejam necessários no futuro, apenas não serão mais renderizados.

