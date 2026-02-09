
# Ajuste das Mensagens de Lembrete de Boleto e Correcao do Nome do Escritorio

## Resumo
Ajustar o tom das mensagens de lembrete de vencimento de boleto (antes e no dia do vencimento) para serem mais amigaveis, sem mencao a juros e multa. Incluir o link de pagamento do Asaas nas mensagens para facilitar o acesso do cliente. Corrigir o nome do escritorio em todas as funcoes que ainda usam variantes incorretas.

---

## 1. Ajuste das Mensagens de Lembrete (antes do vencimento e no dia)

### Arquivo: `supabase/functions/asaas-boleto-reminders/index.ts`

**Mensagem `before_10` (10 dias antes)** - Ajuste leve:
- Remover: "para evitar contratempos"
- Manter tom amigavel de simples lembrete
- Adicionar link de pagamento do Asaas (invoiceUrl)

**Mensagem `before_5` (5 dias antes)** - Ajuste necessario:
- Remover: "para evitar encargos adicionais"
- Trocar por linguagem de simples lembrete

**Mensagem `due_date` (no dia do vencimento)** - Ajuste principal:
- Remover: "para evitar juros e multa por atraso"
- Trocar por linguagem de lembrete amigavel, sem pressao

**Mensagens `after_2`, `after_5`, `after_10` (apos vencimento)** - Manter a linguagem sobre encargos:
- Estas ja sao mensagens de cobranca e devem mencionar possibilidade de juros e multa

### Exemplo das mensagens ajustadas

**10 dias antes:**
"Informamos que voce possui um boleto no valor de R$ X com vencimento previsto para DD/MM/AAAA (daqui a 10 dias). Segue o link para pagamento: [link]. Caso ja tenha efetuado o pagamento, desconsidere esta mensagem."

**5 dias antes:**
"Seu boleto no valor de R$ X vence em DD/MM/AAAA (daqui a 5 dias). Segue o link para facilitar o pagamento: [link]. Se ja efetuou o pagamento, desconsidere esta mensagem."

**No dia do vencimento:**
"Seu boleto no valor de R$ X vence hoje (DD/MM/AAAA). Segue o link para pagamento: [link]. Caso ja tenha efetuado o pagamento, desconsidere esta mensagem."

**Apos vencimento (manter tom firme):**
- Manter as referencias a "encargos adicionais" e "medidas administrativas" que ja existem, pois sao mensagens de cobranca

---

## 2. Link de Pagamento do Asaas

A API do Asaas retorna dois campos uteis em cada cobranca:
- `invoiceUrl`: Link da fatura online (ex: https://www.asaas.com/i/080225913252) - permite pagamento por boleto, PIX ou cartao
- `bankSlipUrl`: Link direto do PDF do boleto

### Implementacao
- Na funcao `buildReminderMessage`, adicionar um parametro `invoiceUrl` opcional
- Ao buscar os pagamentos da API do Asaas, capturar o campo `invoiceUrl` de cada payment
- Incluir o link na mensagem como: "Acesse o link para pagamento: [invoiceUrl]"
- O `invoiceUrl` ja vem pronto do Asaas, nao precisa de chamada extra

---

## 3. Correcao do Nome do Escritorio

### Ocorrencias encontradas e correcoes:

| Arquivo | Texto atual | Correcao |
|---------|-------------|----------|
| `supabase/functions/send-notification-email/index.ts` | "Egg Nunes Advogados - Sistema de Gestao Interna" (17 ocorrencias no footer) | "Egg Nunes Advogados Associados - Sistema de Gestao Interna" |
| `supabase/functions/send-notification-email/index.ts` | "equipe do Egg Nunes Advogados" (1 ocorrencia) | "equipe do Egg Nunes Advogados Associados" |
| `supabase/functions/send-financial-summary/index.ts` | "Egg Nunes Advocacia" | "Egg Nunes Advogados Associados" |
| `supabase/functions/send-financial-summary/index.ts` | "Egg Nunes Financeiro" (remetente email) | "Egg Nunes Advogados Associados - Financeiro" |

**Nota:** As funcoes de WhatsApp (birthday, defaulter, boleto-reminders) ja usam o nome correto "Egg Nunes Advogados Associados".

---

## 4. Arquivos a Modificar

| Arquivo | Mudancas |
|---------|----------|
| `supabase/functions/asaas-boleto-reminders/index.ts` | Ajustar textos dos lembretes pre-vencimento, adicionar parametro invoiceUrl, incluir link de pagamento nas mensagens |
| `supabase/functions/send-notification-email/index.ts` | Corrigir todas as 18 ocorrencias do nome do escritorio para "Egg Nunes Advogados Associados" |
| `supabase/functions/send-financial-summary/index.ts` | Corrigir nome "Egg Nunes Advocacia" e remetente "Egg Nunes Financeiro" |

Nenhum arquivo novo sera criado. Nenhuma alteracao de banco de dados e necessaria.
