

# Adicionar aviso do número de recados e cadastrar automação de boleto

## Diagnóstico

Encontrei as mensagens originais no código. O **footer padrão** já existe em várias Edge Functions:

```
⚠️ *Este número é exclusivo para envio de avisos e informativos do escritório Egg Nunes Advogados Associados.*
Para entrar em contato conosco, utilize nosso canal oficial:
📞 WhatsApp Oficial: https://wa.me/553132268742

_Não responda esta mensagem._
```

**Problemas atuais:**
1. A automação de **aniversário** está cadastrada na tabela `whatsapp_automation_rules`, mas o template **não inclui o footer** de aviso.
2. A automação de **cobrança de boleto** **não está cadastrada** na tabela de automações — as mensagens existem apenas hardcoded nas Edge Functions (`send-defaulter-message` e `asaas-boleto-reminders`).

## Correção

### 1. Atualizar template de aniversário (UPDATE na tabela)
Adicionar o footer de aviso ao final do template existente na automação de aniversário.

### 2. Inserir automação de boleto (INSERT na tabela)
Cadastrar a mensagem de cobrança com o footer, usando o texto que já existia em `send-defaulter-message`. A automação ficará com `is_active = false` (cobrança permanece desativada conforme instrução anterior).

### 3. Garantir que a Edge Function de aniversário use o template completo
O código atual de `sendBirthdayViaZapi` já usa o `messageTemplate` da regra sem adicionar footer por fora — então o footer precisa estar no template da tabela (que é o que faremos).

### Arquivos alterados
- Nenhum arquivo de código será alterado — apenas dados na tabela `whatsapp_automation_rules` (UPDATE + INSERT).

