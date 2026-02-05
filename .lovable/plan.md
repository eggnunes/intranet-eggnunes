
# Plano: Múltiplos Signatários e Assinatura Automática do Advogado no ZapSign

## Objetivo
Implementar suporte a múltiplos signatários nos contratos, adicionando automaticamente o advogado do escritório como segundo signatário com assinatura automática via API.

---

## Análise do Cenário

| Tipo de Documento | Signatários | Autenticação |
|-------------------|-------------|--------------|
| Procuração | Apenas cliente | Selfie + Documento (obrigatório) |
| Declaração | Apenas cliente | Selfie + Documento (obrigatório) |
| Contrato | Cliente + Advogado | Cliente: Selfie + Documento / Advogado: Apenas assinatura na tela |

---

## Recursos Necessários do ZapSign

### 1. Múltiplos Signatários
A API do ZapSign já suporta múltiplos signatários no array `signers` ao criar o documento.

### 2. Assinatura Automática via API
Endpoint: `POST https://api.zapsign.com.br/api/v1/sign/`

Pré-requisitos:
- `user_token` do advogado (obtido em Configurações > Meu Perfil no ZapSign)
- O signatário (advogado) deve estar registrado como usuário na conta ZapSign
- O e-mail do signatário deve ser vazio ou igual ao do usuário que vai assinar
- Dados do perfil configurados (nome, assinatura, visto)

---

## Implementação Proposta

### Fase 1: Nova Secret Necessária

| Secret | Descrição |
|--------|-----------|
| `ZAPSIGN_USER_TOKEN` | Token do advogado/escritório para assinatura automática |

O `ZAPSIGN_API_TOKEN` já está configurado. Será necessário adicionar o `ZAPSIGN_USER_TOKEN` do perfil do advogado que vai assinar automaticamente.

### Fase 2: Modificações na Edge Function

**Arquivo: `supabase/functions/zapsign-integration/index.ts`**

Alterações:
1. Aceitar novo parâmetro `includeOfficeSigner: boolean` (indica se deve incluir o advogado)
2. Quando `documentType === 'contrato'` e `includeOfficeSigner === true`:
   - Adicionar segundo signatário (advogado do escritório)
   - Configurar autenticação simplificada para o advogado (sem selfie/documento)
   - Após criar o documento, chamar endpoint de assinatura automática para o advogado

Fluxo técnico:
```text
1. Criar documento com 2 signatários
   ├─ Signatário 1 (Cliente): selfie + documento obrigatórios
   └─ Signatário 2 (Advogado): apenas assinatura na tela

2. Receber resposta com tokens dos signatários

3. Automaticamente assinar pelo advogado
   POST /api/v1/sign/
   {
     "user_token": "<ZAPSIGN_USER_TOKEN>",
     "signer_tokens": ["<token do signatário advogado>"]
   }

4. Retornar apenas o link do cliente (advogado já assinou)
```

### Fase 3: Modificações no Dialog

**Arquivo: `src/components/ZapSignDialog.tsx`**

Alterações:
1. Para `documentType === 'contrato'`: exibir aviso de que a assinatura do escritório será incluída automaticamente
2. Adicionar informação visual de que o documento terá 2 signatários
3. Na resposta de sucesso, exibir status de ambos signatários

### Fase 4: Dados do Advogado Signatário

Utilizar dados fixos do escritório para o signatário advogado:
- Nome: "Egg Nunes Advocacia" ou nome de um advogado específico
- E-mail: Vazio ou e-mail configurado no perfil ZapSign
- Qualification: "Contratado"

---

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `supabase/functions/zapsign-integration/index.ts` | Adicionar lógica de múltiplos signatários e assinatura automática |
| `src/components/ZapSignDialog.tsx` | Atualizar UI para indicar assinatura automática do escritório em contratos |
| `src/components/ContractGenerator.tsx` | Passar flag `includeOfficeSigner` para o dialog |

---

## Interface Modificada

O diálogo para contratos mostrará:

```text
┌─────────────────────────────────────────────────────────┐
│ Enviar para Assinatura Digital                          │
├─────────────────────────────────────────────────────────┤
│ [Dados do documento]                                    │
│ [Dados do cliente]                                      │
│                                                         │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ 📝 Assinatura do Escritório (automática)            │ │
│ │ Este contrato será assinado automaticamente pelo    │ │
│ │ escritório assim que você clicar em enviar.         │ │
│ │ O cliente receberá o link e ao assinar, o contrato  │ │
│ │ estará completo.                                    │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ [Enviar para ZapSign]                                   │
└─────────────────────────────────────────────────────────┘
```

---

## Detalhes Técnicos

### Edge Function - Novo Fluxo

```typescript
// Configurar signatários
const signers: Signer[] = [clientSigner];

// Para contratos, adicionar advogado
if (body.documentType === 'contrato' && body.includeOfficeSigner) {
  const officeSigner: Signer = {
    name: 'Egg Nunes Advocacia',
    email: '', // Vazio para permitir assinatura via API
    auth_mode: 'assinaturaTela',
    require_selfie_photo: false, // Sem exigência
    require_document_photo: false, // Sem exigência
    qualification: 'Contratado',
    send_automatic_email: false, // Não enviar e-mail
  };
  signers.push(officeSigner);
}

// Criar documento
const response = await fetch(`${ZAPSIGN_API_URL}/docs/`, { ... });
const data = await response.json();

// Assinar automaticamente pelo escritório
if (body.includeOfficeSigner && data.signers?.length > 1) {
  const ZAPSIGN_USER_TOKEN = Deno.env.get('ZAPSIGN_USER_TOKEN');
  const officeSignerToken = data.signers[1].token;
  
  await fetch(`${ZAPSIGN_API_URL}/sign/`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${ZAPSIGN_API_TOKEN}` },
    body: JSON.stringify({
      user_token: ZAPSIGN_USER_TOKEN,
      signer_tokens: [officeSignerToken]
    })
  });
}
```

---

## Próximos Passos

1. **Você precisará fornecer o `ZAPSIGN_USER_TOKEN`**:
   - Acesse o ZapSign
   - Vá em Configurações > Meu Perfil
   - No final da página, habilite "Assinatura via API"
   - Copie o token gerado

2. Após fornecer o token, implementarei as alterações nos arquivos

---

## Resultado Esperado

**Para Procuração/Declaração**:
- Comportamento atual mantido (apenas cliente assina)

**Para Contrato**:
- 2 signatários configurados automaticamente
- Advogado assina instantaneamente via API
- Cliente recebe link e assina quando quiser
- Quando cliente assinar, documento fica 100% concluído

