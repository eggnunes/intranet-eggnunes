

# Correção: Adicionar `.trim()` nas credenciais da Z-API

## Problema Identificado

Os secrets da Z-API (`ZAPI_INSTANCE_ID`, `ZAPI_TOKEN`, `ZAPI_CLIENT_TOKEN`) estão sendo lidos diretamente do ambiente sem nenhum tratamento de espaços em branco. Se houver espaços, tabs ou quebras de linha no inicio ou fim dos valores armazenados, a URL da API fica com formato invalido, causando o erro **"404: Instance not found"**.

A instancia esta **Conectada** e com assinatura **PAGA** no painel da Z-API, confirmando que as credenciais sao validas.

## Solucao

Adicionar `.trim()` em todas as leituras dos secrets da Z-API, em todas as Edge Functions que os utilizam. Tambem adicionar logging de debug temporario para confirmar que os valores estao corretos.

## Funcoes que serao corrigidas

1. **`zapi-send-message/index.ts`** - Funcao principal de envio de mensagens
2. **`asaas-boleto-reminders/index.ts`** - Lembretes de boletos
3. **`chatguru-birthday-messages/index.ts`** - Mensagens de aniversario
4. **`zapsign-integration/index.ts`** - Notificacao de assinatura de documentos

## Detalhes Tecnicos

### Alteracao em cada funcao

Onde hoje o codigo faz:
```text
const ZAPI_INSTANCE_ID = Deno.env.get('ZAPI_INSTANCE_ID');
const ZAPI_TOKEN = Deno.env.get('ZAPI_TOKEN');
const ZAPI_CLIENT_TOKEN = Deno.env.get('ZAPI_CLIENT_TOKEN');
```

Sera alterado para:
```text
const ZAPI_INSTANCE_ID = (Deno.env.get('ZAPI_INSTANCE_ID') || '').trim();
const ZAPI_TOKEN = (Deno.env.get('ZAPI_TOKEN') || '').trim();
const ZAPI_CLIENT_TOKEN = (Deno.env.get('ZAPI_CLIENT_TOKEN') || '').trim();
```

### Logging de debug (temporario)

Sera adicionado em cada funcao um log que mostra o comprimento dos valores e os primeiros/ultimos caracteres (sem expor os valores completos):

```text
console.log(`[Z-API] Credentials - Instance ID length: ${ZAPI_INSTANCE_ID.length}, Token length: ${ZAPI_TOKEN.length}`);
console.log(`[Z-API] Instance ID starts with: ${ZAPI_INSTANCE_ID.substring(0, 4)}... ends with: ...${ZAPI_INSTANCE_ID.substring(ZAPI_INSTANCE_ID.length - 4)}`);
```

### Teste apos deploy

Apos o deploy, sera feito um teste de conexao chamando a acao `test-connection` da funcao `zapi-send-message` para verificar se o erro 404 foi resolvido.

## Arquivos a serem modificados

| Arquivo | Alteracao |
|---|---|
| `supabase/functions/zapi-send-message/index.ts` | Adicionar `.trim()` nas linhas 33-35 + logging |
| `supabase/functions/asaas-boleto-reminders/index.ts` | Adicionar `.trim()` nas linhas 82-84 + logging |
| `supabase/functions/chatguru-birthday-messages/index.ts` | Adicionar `.trim()` nas linhas de credenciais + logging |
| `supabase/functions/zapsign-integration/index.ts` | Adicionar `.trim()` nas linhas 409-411 + logging |

