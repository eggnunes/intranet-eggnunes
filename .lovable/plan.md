

# Plano: Assinatura de Contrato com 5 Signatarios no ZapSign

## Status: ✅ IMPLEMENTADO

## Resumo

Fluxo de assinatura de contratos atualizado para incluir 5 signatarios, com assinatura automatica para os 4 internos e assinatura manual apenas para o cliente.

## Tokens Configurados

| Secret | Pessoa | Status |
|--------|--------|--------|
| `ZAPSIGN_USER_TOKEN` | **Rafael** | ✅ Configurado |
| `ZAPSIGN_TOKEN_MARCOS` | Marcos | ✅ Configurado |
| `ZAPSIGN_TOKEN_DANIEL` | Daniel | ✅ Configurado |
| `ZAPSIGN_TOKEN_JHONNY` | Johnny | ✅ Configurado |
| `ZAPSIGN_TOKEN_LUCAS` | Lucas | ✅ Configurado |

## Fases Implementadas

- ✅ Fase 1: Tokens salvos como secrets
- ✅ Fase 2: Migração SQL (novas colunas em zapsign_documents)
- ✅ Fase 3: Edge Function zapsign-integration (5 signatários, assinatura automática sequencial)
- ✅ Fase 4: ZapSignDialog (seleção de testemunhas + status expandido)
- ✅ Fase 5: Webhook atualizado para reconhecer novos tokens
- ✅ Fase 6: Âncoras no PDF (contrato padrão)

## Pendente

- Âncoras no contrato BSB (formato diferente com 4 escritórios contratados)
