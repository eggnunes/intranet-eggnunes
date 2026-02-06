

# Plano: Assinatura de Contrato com 5 Signatarios no ZapSign

## Resumo

Atualizar o fluxo de assinatura de contratos para incluir 5 signatarios, com assinatura automatica para os 4 internos e assinatura manual apenas para o cliente.

## Correcao de Entendimento sobre Tokens

| Secret | Pessoa | Status |
|--------|--------|--------|
| `ZAPSIGN_USER_TOKEN` | **Rafael** (ja salvo) | Ja configurado |
| `ZAPSIGN_TOKEN_MARCOS` | Marcos | Novo - token: `31d2c9b0-ebd1-401c-9ab3-56fcc4016754` |
| `ZAPSIGN_TOKEN_DANIEL` | Daniel | Novo - token: `e3e23b45-1da9-46a4-a4ed-59fe538db2b5` |
| `ZAPSIGN_TOKEN_JHONNY` | Johnny | Novo - token: `26b68866-6f1c-4a9e-b261-c93ef62dd0b4` |
| `ZAPSIGN_TOKEN_LUCAS` | Lucas | Novo - token: `fe577425-5287-4116-ad99-7fe749efcf3d` |

## Regras de Autenticacao por Signatario

| Signatario | Tipo | Selfie | Foto Documento | Assinatura Tela |
|------------|------|--------|----------------|-----------------|
| Marcos (1o Contratado) | Automatica | NAO | NAO | SIM |
| Rafael (2o Contratado) | Automatica | NAO | NAO | SIM |
| Cliente (Contratante) | Manual | SIM | SIM | SIM |
| Testemunha 1 | Automatica | NAO | NAO | SIM |
| Testemunha 2 | Automatica | NAO | NAO | SIM |

## Fase 1: Salvar os 4 Novos Tokens como Secrets

Solicitar ao usuario que insira cada token como secret no backend:
- `ZAPSIGN_TOKEN_MARCOS`
- `ZAPSIGN_TOKEN_DANIEL`
- `ZAPSIGN_TOKEN_JHONNY`
- `ZAPSIGN_TOKEN_LUCAS`

## Fase 2: Banco de Dados - Novas Colunas em `zapsign_documents`

Adicionar colunas para rastrear os novos signatarios:

| Campo | Tipo | Descricao |
|-------|------|-----------|
| `marcos_signer_token` | text | Token do signatario Marcos no ZapSign |
| `marcos_signer_status` | text | Status da assinatura do Marcos |
| `rafael_signer_token` | text | Token do signatario Rafael no ZapSign |
| `rafael_signer_status` | text | Status da assinatura do Rafael |
| `witness1_name` | text | Nome da testemunha 1 |
| `witness1_signer_token` | text | Token do signatario testemunha 1 |
| `witness1_signer_status` | text | Status da assinatura da testemunha 1 |
| `witness2_name` | text | Nome da testemunha 2 |
| `witness2_signer_token` | text | Token do signatario testemunha 2 |
| `witness2_signer_status` | text | Status da assinatura da testemunha 2 |

O campo existente `office_signer_token`/`office_signer_status` sera renomeado conceitualmente para representar o Marcos (1o contratado), mas mantido por retrocompatibilidade. Os novos campos serao adicionados separadamente.

## Fase 3: Atualizacao da Edge Function `zapsign-integration`

### Mudancas principais

1. **Novos parametros de entrada**: campo `witnesses` com array de 2 testemunhas selecionadas

2. **5 signatarios para contratos** (nesta ordem):
   - Marcos Luiz Egg Nunes (Contratado) - `auth_mode: 'assinaturaTela'`, `require_selfie_photo: false`, `require_document_photo: false`
   - Rafael Egg Nunes (Contratado) - mesma configuracao do Marcos
   - Cliente (Contratante) - `require_selfie_photo: true`, `require_document_photo: true`
   - Testemunha 1 - mesma configuracao do Marcos
   - Testemunha 2 - mesma configuracao do Marcos

3. **Assinatura automatica em sequencia** apos criar o documento:
   - Marcos assina via `ZAPSIGN_TOKEN_MARCOS`
   - Rafael assina via `ZAPSIGN_USER_TOKEN` (token ja existente)
   - Testemunha 1 assina via token correspondente (Daniel/Johnny/Lucas)
   - Testemunha 2 assina via token correspondente (Daniel/Johnny/Lucas)

4. **Salvar no banco**: Registrar todos os tokens de signatarios nas novas colunas

5. **Retorno atualizado**: incluir status individual de cada assinatura no resultado

### Mapeamento de tokens por testemunha

```text
'daniel' -> ZAPSIGN_TOKEN_DANIEL
'jhonny' -> ZAPSIGN_TOKEN_JHONNY
'lucas'  -> ZAPSIGN_TOKEN_LUCAS
```

## Fase 4: Interface - Selecao de Testemunhas no ZapSignDialog

### Novo campo no dialogo (apenas para contratos)

Adicionar secao "Testemunhas" com 3 checkboxes:
- Daniel
- Johnny
- Lucas

Regras:
- Exatamente 2 devem estar selecionadas para enviar
- Por padrao, as 2 primeiras vem pre-selecionadas (Daniel e Johnny)
- Validacao impede envio sem exatamente 2 selecionadas

### Aviso atualizado sobre assinaturas

Substituir o aviso atual "Assinatura automatica do escritorio" por um aviso mais detalhado:

```text
"O contrato sera assinado automaticamente por:
 - Marcos Luiz Egg Nunes (1o Contratado)
 - Rafael Egg Nunes (2o Contratado)  
 - 2 Testemunhas selecionadas
 
 O cliente recebera o link para completar sua assinatura."
```

### Status apos envio bem-sucedido

Exibir status individual de cada signatario:

```text
Marcos Luiz Egg Nunes (Contratado)    [Assinado]
Rafael Egg Nunes (Contratado)         [Assinado]
[Nome do Cliente] (Contratante)       [Aguardando]
Daniel (Testemunha)                   [Assinado]
Johnny (Testemunha)                   [Assinado]
```

## Fase 5: Atualizacao do Webhook `zapsign-webhook`

Atualizar a logica para reconhecer os novos tokens de signatarios:

```text
if signer_token == marcos_signer_token -> atualizar marcos_signer_status
if signer_token == rafael_signer_token -> atualizar rafael_signer_status
if signer_token == witness1_signer_token -> atualizar witness1_signer_status
if signer_token == witness2_signer_token -> atualizar witness2_signer_status
if signer_token == client_signer_token -> atualizar client_signer_status + sincronizar ADVBox
```

A sincronizacao com ADVBox continua sendo disparada APENAS quando o **cliente** assina.

## Fase 6: Ancoras no PDF (Posicionamento de Assinaturas)

### ContractGenerator.tsx

Na geracao do PDF, inserir textos ancora invisiveis (fonte 1pt, cor branca) nas posicoes de assinatura:

| Posicao | Ancora |
|---------|--------|
| Linha do 1o Contratado | `<<<<assinatura_contratado1>>>>` |
| Linha do 2o Contratado | `<<<<assinatura_contratado2>>>>` |
| Linha do Contratante | `<<<<assinatura_contratante>>>>` |
| Linha da Testemunha 1 | `<<<<assinatura_testemunha1>>>>` |
| Linha da Testemunha 2 | `<<<<assinatura_testemunha2>>>>` |

Na Edge Function, cada signatario tera o campo `signature_placement` apontando para sua ancora correspondente, garantindo posicionamento correto independente do tamanho do documento.

## Arquivos a Serem Modificados

| Arquivo | Alteracao |
|---------|-----------|
| Migracao SQL | Adicionar novas colunas em `zapsign_documents` |
| `supabase/functions/zapsign-integration/index.ts` | 5 signatarios, assinatura automatica sequencial, ancoras |
| `supabase/functions/zapsign-webhook/index.ts` | Reconhecer novos tokens de signatarios |
| `src/components/ZapSignDialog.tsx` | Selecao de testemunhas + status expandido |
| `src/components/ContractGenerator.tsx` | Inserir textos ancora invisiveis no PDF |

## Fluxo Completo

```text
1. Usuario gera contrato no sistema
2. PDF e gerado com textos ancora invisiveis nas posicoes de assinatura
3. Usuario clica "Enviar para ZapSign"
4. Dialogo exibe selecao de testemunhas (2 de 3: Daniel, Johnny, Lucas)
5. Usuario confirma e envia
6. Edge Function cria documento no ZapSign com 5 signatarios
7. Assinaturas automaticas executadas em sequencia:
   Marcos -> Rafael -> Testemunha 1 -> Testemunha 2
8. Cliente recebe link por e-mail (unica assinatura pendente)
9. Cliente assina com selfie + foto do documento
10. Webhook recebe notificacao e sincroniza com ADVBox
```

