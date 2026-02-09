
# Correcao do Erro 402 na Integracao ZapSign

## Diagnostico

O erro **402 (Payment Required)** retornado pela API do ZapSign tem um significado especifico conforme a documentacao oficial:

> **402 PAYMENT REQUIRED** - O cliente nao possui um plano de API ativo. No ambiente de producao, e obrigatorio ter um plano mensal para usar a API. Acesse Configuracoes > Planos e Precos.

Isso indica que o **plano de API do ZapSign expirou ou nao esta ativo** na conta utilizada. O token de API (`ZAPSIGN_API_TOKEN`) esta configurado corretamente, mas a conta precisa ter um plano de API ativo para criar documentos em producao.

**Acao necessaria do usuario:** Acessar o painel do ZapSign em Configuracoes > Planos e Precos e verificar/renovar o plano de API.

## Problemas de Codigo Identificados

Alem da questao do plano, existem **3 problemas tecnicos** no codigo que precisam ser corrigidos para melhorar a experiencia e evitar erros futuros:

---

## 1. Headers CORS Incompletos

O edge function `zapsign-integration` utiliza headers CORS basicos que nao incluem todos os headers enviados pelo cliente Supabase, o que pode causar falhas intermitentes.

**Arquivo:** `supabase/functions/zapsign-integration/index.ts`

**Atual:**
```text
'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
```

**Corrigido:**
```text
'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version'
```

---

## 2. Repasse Direto do Status HTTP do ZapSign

Atualmente, quando o ZapSign retorna um erro (como 402), a edge function repassa esse status diretamente ao cliente. O SDK do Supabase interpreta qualquer status diferente de 2xx como erro da funcao, gerando a mensagem generica "Edge Function returned a non-2xx status code" sem mostrar os detalhes uteis do erro.

**Correcao:** Retornar sempre status **200** da edge function, com os detalhes do erro no corpo da resposta em formato JSON. Isso permite que o frontend exiba mensagens especificas e uteis ao usuario.

**Arquivo:** `supabase/functions/zapsign-integration/index.ts`

Exemplo do tratamento melhorado:

```text
if (!response.ok) {
  // Em vez de: { status: response.status }
  // Retornar: { status: 200, com erro detalhado no body }
  return new Response(
    JSON.stringify({
      error: 'Erro ao criar documento no ZapSign',
      details: responseText,
      zapSignStatus: response.status,
      userMessage: response.status === 402
        ? 'O plano de API do ZapSign esta inativo ou expirado. Verifique o plano em Configuracoes > Planos no painel do ZapSign.'
        : response.status === 401
        ? 'Token de API do ZapSign invalido ou expirado.'
        : 'Erro inesperado na API do ZapSign. Tente novamente.'
    }),
    { status: 200, headers: corsHeaders }
  );
}
```

---

## 3. Mensagem de Erro Generica no Frontend

O componente `ZapSignDialog.tsx` exibe apenas a mensagem tecnica do erro sem diferenciar tipos de problema. Precisa tratar especificamente os erros vindos do ZapSign para orientar o usuario.

**Arquivo:** `src/components/ZapSignDialog.tsx`

**Correcao:** Verificar o campo `userMessage` na resposta de erro e exibir mensagem amigavel:

```text
if (data?.error) {
  const friendlyMessage = data.userMessage || data.details || data.error;
  throw new Error(friendlyMessage);
}
```

---

## Resumo das Alteracoes

| Arquivo | Alteracao |
|---------|----------|
| `supabase/functions/zapsign-integration/index.ts` | Atualizar CORS headers, retornar status 200 com erro detalhado no body, adicionar mensagens amigaveis por codigo HTTP |
| `src/components/ZapSignDialog.tsx` | Exibir mensagem amigavel (`userMessage`) ao usuario em caso de erro |

## Importante

Apos aplicar as correcoes de codigo, **voce precisa verificar o plano de API no painel do ZapSign** (Configuracoes > Planos e Precos) para garantir que o plano esta ativo. Sem um plano ativo, o erro 402 continuara ocorrendo independentemente das melhorias no codigo.
