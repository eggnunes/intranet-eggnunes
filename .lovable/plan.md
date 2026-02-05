
# Plano: Configuração Completa do ZapSign

## Visão Geral

Vou solicitar os tokens necessários e configurar o sistema completo, incluindo:
1. Token de usuário para assinatura automática
2. Webhook para receber notificações de status

---

## Fase 1: Secrets a Configurar

| Secret | Descrição | Status |
|--------|-----------|--------|
| `ZAPSIGN_API_TOKEN` | Token da API do ZapSign | Já configurado |
| `ZAPSIGN_USER_TOKEN` | Token do usuário para assinatura automática | Será solicitado |

---

## Fase 2: Implementação da Assinatura Automática

Após você fornecer o token de usuário, implementarei as alterações nos arquivos:

### Edge Function (zapsign-integration)

Alterações:
- Adicionar segundo signatário (advogado) quando `documentType === 'contrato'`
- Advogado: sem exigência de selfie/documento
- Após criar documento, chamar `POST /api/v1/sign/` para assinar automaticamente

### ZapSignDialog.tsx

Alterações:
- Exibir aviso sobre assinatura automática do escritório em contratos
- Mostrar status de ambos signatários na resposta

### ContractGenerator.tsx

Alterações:
- Passar flag `includeOfficeSigner: true` para contratos

---

## Fase 3: Configuração do Webhook

O Webhook permite que o ZapSign notifique seu sistema quando:
- Um signatário assinar o documento
- O documento for completamente assinado
- Houver algum erro ou expiração

### Nova Edge Function: zapsign-webhook

Criar uma nova Edge Function para receber as notificações:

| Campo | Valor |
|-------|-------|
| URL do Webhook | `https://igzcajgwqfpcgybxanjo.supabase.co/functions/v1/zapsign-webhook` |
| Eventos | Documento assinado, todos assinaram, etc. |

### Nova Tabela: zapsign_documents

Para rastrear os documentos enviados e seu status:

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | uuid | Identificador único |
| document_token | text | Token do documento no ZapSign |
| document_type | text | contrato, procuracao, declaracao |
| document_name | text | Nome do documento |
| client_name | text | Nome do cliente |
| client_email | text | E-mail do cliente |
| status | text | pending, signed, completed, expired |
| sign_url | text | Link para assinatura |
| signed_file_url | text | URL do arquivo assinado |
| created_at | timestamp | Data de criação |
| updated_at | timestamp | Data de atualização |

---

## Fluxo Completo

```text
1. Gerar contrato na intranet
2. Enviar para ZapSign
   ├─ Documento criado com 2 signatários
   ├─ Advogado assina automaticamente via API
   └─ Cliente recebe link por e-mail
3. Webhook recebe notificação quando cliente assinar
4. Sistema atualiza status do documento
5. Arquivo assinado disponível para download
```

---

## Ordem de Implementação

1. **Solicitar ZAPSIGN_USER_TOKEN** - Token do seu perfil
2. **Atualizar Edge Function** - Lógica de múltiplos signatários
3. **Atualizar ZapSignDialog** - UI para contratos
4. **Criar tabela zapsign_documents** - Rastreamento
5. **Criar zapsign-webhook** - Receber notificações
6. **Atualizar ContractGenerator** - Passar flag

---

## Configuração no ZapSign

Após implementar, você precisará configurar o Webhook no painel do ZapSign:

1. Acesse Configurações > Integrações > Webhooks
2. Adicione um novo webhook com a URL fornecida
3. Selecione os eventos que deseja receber

---

## Resultado Esperado

- Contratos assinados automaticamente pelo escritório
- Cliente recebe link e assina
- Sistema recebe notificação quando cliente assinar
- Histórico de documentos enviados disponível
