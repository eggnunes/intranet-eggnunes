

## Plano: Correção de mensagens de aniversário e limites de boletos Asaas

### Problema 1: Mensagens de aniversário falhando

**Diagnóstico:** A função `chatguru-birthday-messages` não possui logs recentes, o que indica que a invocação está falhando antes de executar ou retornando erro silencioso. O problema principal é a chamada interna `supabase.functions.invoke('advbox-integration/customer-birthdays')` feita com um cliente Supabase criado com a Service Role Key, mas passando o header de Authorization do usuário manualmente. Isso pode gerar conflito na autenticação.

**Correção:**
- Alterar `chatguru-birthday-messages/index.ts` para buscar aniversários diretamente da tabela `advbox_customers_cache` no banco (que já contém os dados sincronizados), em vez de invocar a edge function `advbox-integration` internamente (que é propensa a falhas de autenticação e timeout)
- Isso elimina a dependência de uma chamada função-para-função, que é frágil
- Manter toda a lógica de envio via ChatGuru e logging existente

### Problema 2: Limite de boletos Asaas (máximo 12)

**Diagnóstico:** No arquivo `AsaasNovaCobranca.tsx`, linha 858:
```
Array.from({ length: billingType === 'CREDIT_CARD' ? 20 : 11 }, (_, i) => i + 2)
```
Para boleto, gera apenas opções de 2 a 12 parcelas. Para cartão, gera de 2 a 21.

**Correção:**
- Boleto: Expandir para até 60 parcelas (limite da API Asaas para boleto)
- Cartão: Manter até 21 parcelas (limite Asaas para cartão de crédito)
- Ajustar a validação correspondente (linha 498-500) para aceitar os novos limites
- Atualizar o select dropdown para usar scroll e mostrar todas as opções

### Arquivos modificados
- `supabase/functions/chatguru-birthday-messages/index.ts` — buscar aniversários direto do banco
- `src/components/financeiro/asaas/AsaasNovaCobranca.tsx` — expandir limites de parcelas

