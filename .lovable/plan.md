

## Plano: Corrigir Assinaturas Automáticas e Posicionamento no ZapSign

### Diagnóstico

Após análise do código e da documentação da API do ZapSign, identifiquei **2 problemas distintos**:

---

### Problema 1: Assinaturas automáticas não funcionam

**Causa raiz**: O código envia o campo `signer_token` (string singular) na chamada de auto-assinatura, porém a API do ZapSign espera o campo `signer_tokens` (array). Por isso, a API ignora o pedido e as assinaturas de Marcos, Rafael, Daniel e Johnny ficam "Pendente".

A documentação da API diz:
- Endpoint: `POST /api/v1/sign/`
- Campos: `user_token` (string) + `signer_tokens` (array de strings)

O código atual envia:
```json
{ "user_token": "xxx", "signer_token": "yyy" }
```

Deveria enviar:
```json
{ "user_token": "xxx", "signer_tokens": ["yyy"] }
```

**Correção no `supabase/functions/zapsign-integration/index.ts`**:
- Na funcao `autoSign` (linha 91-93), trocar `signer_token` por `signer_tokens` como array

---

### Problema 2: Todas as assinaturas ficam no canto esquerdo

**Causa raiz**: No `ContractGenerator.tsx`, todos os textos ancora do ZapSign (`<<<<assinatura_contratado1>>>>`, `<<<<assinatura_contratante>>>>`, etc.) sao renderizados na mesma posicao: `marginLeft` (linha 1489). Como o ZapSign posiciona a assinatura exatamente onde encontra o texto ancora no PDF, todas as assinaturas ficam alinhadas a esquerda.

**Correção no `src/components/ContractGenerator.tsx`** (linhas 1486-1492):
- Identificar qual ancora esta sendo renderizada e posicionar de acordo:
  - `assinatura_contratado1`, `assinatura_contratado2`, `assinatura_contratante` → centralizado (`pageWidth / 2`)
  - `assinatura_testemunha1` → esquerda (`col1X`, aproximadamente `marginLeft + 10`)
  - `assinatura_testemunha2` → direita (`col2X`, aproximadamente `pageWidth / 2 + 10`)

---

### Alteracoes Tecnicas

**Arquivo 1: `supabase/functions/zapsign-integration/index.ts`**

Funcao `autoSign` (linhas 84-95):
```typescript
// ANTES:
body: JSON.stringify({
  user_token: userToken,
  signer_token: signerToken,
})

// DEPOIS:
body: JSON.stringify({
  user_token: userToken,
  signer_tokens: [signerToken],
})
```

**Arquivo 2: `src/components/ContractGenerator.tsx`**

Bloco de renderizacao de ancoras ZapSign (linhas 1486-1492):
```typescript
// ANTES:
if (trimmedLine.startsWith('<<<<') && trimmedLine.endsWith('>>>>')) {
  doc.setFontSize(1);
  doc.setTextColor(255, 255, 255);
  doc.text(trimmedLine, marginLeft, yPos);  // Tudo na esquerda
  ...
}

// DEPOIS:
if (trimmedLine.startsWith('<<<<') && trimmedLine.endsWith('>>>>')) {
  doc.setFontSize(1);
  doc.setTextColor(255, 255, 255);
  
  // Posicionar ancora de acordo com o tipo de signatario
  let anchorX = pageWidth / 2; // Padrao: centralizado
  if (trimmedLine.includes('testemunha1')) {
    anchorX = marginLeft + 10; // Esquerda
  } else if (trimmedLine.includes('testemunha2')) {
    anchorX = pageWidth / 2 + 10; // Direita
  }
  
  doc.text(trimmedLine, anchorX, yPos);
  ...
}
```

---

### Resultado Esperado

| Aspecto | Antes | Depois |
|---------|-------|--------|
| Auto-assinatura Marcos | Pendente (falha silenciosa) | Assinado automaticamente |
| Auto-assinatura Rafael | Pendente (falha silenciosa) | Assinado automaticamente |
| Auto-assinatura testemunhas | Pendente (falha silenciosa) | Assinado automaticamente |
| Posicao Contratados (1 e 2) | Esquerda | Centralizada |
| Posicao Contratante (cliente) | Esquerda | Centralizada |
| Posicao Testemunha 1 | Esquerda | Esquerda (mantida) |
| Posicao Testemunha 2 | Esquerda | Direita |

