
# Plano: Automação Completa do ZapSign

## Resumo

Simplificar a integração ZapSign para que, ao clicar em enviar, o documento seja criado e o e-mail seja disparado automaticamente para o cliente, sem necessidade de configuração manual.

---

## O Que Já Funciona (Confirmado)

A integração atual já opera 100% via API:
- O documento é criado na base do ZapSign automaticamente
- O link de assinatura é gerado e retornado
- Tudo acontece dentro da sua intranet

O que falta é apenas **ajustar os padrões** para maior automação.

---

## Mudanças Propostas

### 1. Autenticação como Padrão Fixo

| Configuração | Antes | Depois |
|--------------|-------|--------|
| Exigir selfie | Switch (padrão: ativo) | **Sempre ativo** (sem switch) |
| Exigir foto do documento | Switch (padrão: ativo) | **Sempre ativo** (sem switch) |

Resultado: Remover a seção de switches de autenticação e exibir apenas um aviso informativo.

### 2. Envio por E-mail Automático

| Configuração | Antes | Depois |
|--------------|-------|--------|
| Enviar por e-mail | Switch (padrão: desativado) | **Padrão ativado** |
| Enviar por WhatsApp | Switch (padrão: desativado) | Mantém desativado (futura implementação) |

Resultado: Se o cliente tiver e-mail, o ZapSign envia automaticamente.

### 3. Interface Simplificada

Antes (muitas opções):
```text
[Dados do documento]
[Dados de contato editáveis]
[Autenticação do signatário] ← REMOVER
  - Switch: Exigir selfie
  - Switch: Exigir foto do documento
[Envio automático]
  - Switch: Enviar por e-mail
  - Switch: Enviar por WhatsApp
```

Depois (simplificado):
```text
[Dados do documento]
[Dados de contato editáveis]
[Aviso] "Será exigido selfie e foto do documento"
[Envio automático]
  - E-mail: ativado por padrão
  - WhatsApp: preparado para futura implementação
```

---

## Arquivos a Modificar

### 1. ZapSignDialog.tsx

Alterações:
- Remover estados `requireSelfie` e `requireDocumentPhoto`
- Mudar `sendViaEmail` de `useState(false)` para `useState(true)`
- Remover seção "Autenticação do signatário" com os switches
- Adicionar Card informativo sobre autenticação obrigatória
- Enviar valores fixos `true` para selfie e documento na chamada da API

### 2. zapsign-integration (Edge Function)

Alterações:
- Forçar `require_selfie_photo: true` e `require_document_photo: true` independente do que vier do frontend
- Garantir consistência e segurança

---

## Fluxo Final do Usuário

```text
1. Gerar contrato/procuração
2. Clicar "Enviar para ZapSign"
3. Diálogo abre com:
   - Dados do cliente (nome, CPF)
   - Campo de e-mail (editável)
   - Campo de WhatsApp (para futuro)
   - Aviso: "Autenticação completa será exigida"
   - E-mail automático já ativado
4. Clicar "Enviar"
5. Documento criado + E-mail enviado automaticamente
6. Link de assinatura exibido (para backup manual)
```

---

## Detalhes Técnicos

### ZapSignDialog.tsx - Mudanças de Estado

```typescript
// ANTES
const [requireSelfie, setRequireSelfie] = useState(true);
const [requireDocumentPhoto, setRequireDocumentPhoto] = useState(true);
const [sendViaEmail, setSendViaEmail] = useState(false);

// DEPOIS
// Remover requireSelfie e requireDocumentPhoto (sempre true)
const [sendViaEmail, setSendViaEmail] = useState(true); // Padrão ativado
```

### ZapSignDialog.tsx - Chamada da API

```typescript
// ANTES
requireSelfie,
requireDocumentPhoto,

// DEPOIS
requireSelfie: true,      // Sempre fixo
requireDocumentPhoto: true, // Sempre fixo
```

### Edge Function - Garantia de Segurança

```typescript
// Forçar autenticação completa independente do request
const signer: Signer = {
  // ...outros campos
  require_selfie_photo: true,        // Fixo
  require_document_photo: true,      // Fixo
  send_automatic_email: body.sendViaEmail ?? true, // Padrão true agora
};
```

---

## Resultado Esperado

Ao aprovar este plano, a integração funcionará assim:

1. **Zero configuração necessária** - tudo automático
2. **E-mail enviado automaticamente** pelo ZapSign para o cliente
3. **Autenticação forte garantida** - selfie + documento sempre
4. **Link de backup disponível** - caso queira compartilhar manualmente
5. **Preparado para WhatsApp** - quando você implementar a API

O cliente receberá o e-mail diretamente do ZapSign com o link, clicará, tirará selfie, fotografará documento e assinará na tela.
