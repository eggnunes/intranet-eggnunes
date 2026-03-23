

# Substituir "Revisado" por "Viável/Inviável" + Salvar no Teams

## Resumo

Duas mudanças principais:
1. Trocar o status final "revisado" por "viavel" e "inviavel", para que o comercial saiba se deve elaborar proposta de honorários
2. Adicionar botão para salvar a análise de viabilidade como arquivo texto na pasta do cliente no Microsoft Teams/SharePoint

## Alterações

### 1. `src/pages/Viabilidade.tsx` — Atualizar status e ações

- Remover `revisado` do `statusConfig` e adicionar `viavel` e `inviavel`:
  - `viavel`: badge verde "Viável" com ícone CheckCircle
  - `inviavel`: badge vermelha "Inviável" com ícone XCircle
- Substituir `handleMarkRevisado` por `handleMarkViavel(id)` e `handleMarkInviavel(id)` que fazem update no status
- Na tabela, para clientes `em_analise`, mostrar dois botões: "Viável" (verde) e "Inviável" (vermelho)
- Atualizar stats cards: trocar "Revisados" por "Viáveis" + "Inviáveis" (ou combinar em "Finalizados")
- Atualizar filtros de status no Select e no dialog de edição
- Adicionar botão "Salvar no Teams" para clientes com parecer, que abre o `SaveToTeamsDialog` passando o conteúdo do parecer como arquivo `.txt` e o `clientName` para auto-navegação

### 2. `src/pages/ViabilidadeNovo.tsx` — Atualizar status no save

- Linha 278: manter lógica `em_analise` / `pendente` (sem mudança, pois viável/inviável é decisão posterior manual)

### 3. Salvar no Teams — Integração com `SaveToTeamsDialog`

- Importar `SaveToTeamsDialog` e `useTeamsUpload` em `Viabilidade.tsx`
- Ao clicar "Salvar no Teams" em um cliente:
  - Buscar o registro completo do cliente (com `parecer_viabilidade`, `descricao_caso`, etc.)
  - Montar um conteúdo texto com: nome, CPF, tipo de ação, descrição do caso, parecer, status, data
  - Converter para base64
  - Abrir `SaveToTeamsDialog` com `fileName="Viabilidade - {nome}.txt"`, `fileContent={base64}`, `clientName={nome}`
  - O dialog já auto-navega para a pasta do cliente no site Jurídico

## Arquivos modificados

| Arquivo | Alteração |
|---|---|
| `src/pages/Viabilidade.tsx` | Trocar "revisado" por "viavel"/"inviavel", adicionar botões de status + botão salvar no Teams |
| `src/pages/ViabilidadeNovo.tsx` | Sem mudança (status ao salvar já é pendente/em_analise) |

Nenhuma migração de banco necessária — o campo `status` é `text`, aceita qualquer valor.

