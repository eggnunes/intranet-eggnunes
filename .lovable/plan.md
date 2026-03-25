

## Incluir link de assinatura na mensagem de lembrete ZapSign

### O que será feito
Atualizar o template de lembrete e a lógica de envio para incluir o link de assinatura (`sign_url`) do documento pendente na mensagem enviada ao cliente via WhatsApp.

### Implementação

**1. Atualizar template na tabela `whatsapp_templates`**

Substituir o trecho "basta acessar o link que lhe foi enviado anteriormente" pelo placeholder `{link_assinatura}`:

```
Olá, {nome}! Tudo bem? 😊

Passando para lembrar que o seu {tipo_documento} ainda está pendente de assinatura. 

Para assinar, basta acessar o link abaixo. É rápido e seguro!

🔗 {link_assinatura}

⚠️ *Este número é exclusivo para envio de avisos e informativos do escritório Egg Nunes Advogados Associados.*
Para entrar em contato conosco, utilize nosso canal oficial:
📞 WhatsApp Oficial: https://wa.me/553132268742

_Não responda esta mensagem._
```

**2. Componente `CRMZapSignContracts.tsx`**

Na função `handleSendReminder`, adicionar replace de `{link_assinatura}` com `doc.sign_url`. Se `sign_url` estiver vazio, substituir por texto informativo ("link enviado por e-mail"):

```typescript
const linkAssinatura = doc.sign_url || 'O link foi enviado anteriormente por e-mail.';

const message = template.content
  .replace(/{nome}/g, firstName)
  .replace(/{tipo_documento}/g, tipoDoc)
  .replace(/{link_assinatura}/g, linkAssinatura);
```

Também validar: se não há `sign_url` nem `client_phone`, exibir toast de erro antes de enviar.

### Arquivos modificados
- **Dados (update)** — template `/lembrete-assinatura` atualizado com `{link_assinatura}`
- **`src/components/crm/CRMZapSignContracts.tsx`** — adicionar replace do link na mensagem

