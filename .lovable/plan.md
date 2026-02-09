
# Alteracao de Foto pelo Admin + Abater Reembolsos no Historico

## 1. Permitir Admin Alterar Foto do Colaborador

**Arquivo:** `src/components/rh/ColaboradorPerfilUnificado.tsx`

No cabecalho do perfil, onde aparece o Avatar (linhas 347-352), adicionar um botao de "Alterar Foto" visivel apenas para admins/socios. Ao clicar:
- Abre um input de arquivo (imagem, max 5MB)
- Faz upload para o storage `avatars` (mesmo bucket usado em Profile.tsx)
- Atualiza o `avatar_url` no perfil do colaborador via `supabase.from('profiles').update()`
- Atualiza o estado local para refletir a nova foto imediatamente

Logica de upload identica a ja existente em `src/pages/Profile.tsx` (linhas 577-606): upload para `avatars/{colaboradorId}/{timestamp}.{ext}`, obter URL publica, salvar no perfil.

Visualmente: um icone de camera ou botao "Alterar Foto" sobreposto ao avatar, visivel apenas quando `isAdmin || isSocio`.

---

## 2. Abater Reembolsos do Historico de Pagamentos e Dashboard

**Contexto:** A rubrica "Reembolso" tem ID `47d8ce78-a5c8-4eb4-8799-420a97e144db` e tipo `vantagem`. Quando um pagamento inclui essa rubrica, o valor do reembolso esta somado ao `total_liquido`, inflando o valor real pago ao colaborador.

**Solucao:** Nos locais onde se exibe o historico de pagamentos e metricas financeiras do colaborador, buscar os itens de pagamento que usam a rubrica de Reembolso e subtrair esse valor do total exibido.

### Arquivos a modificar:

**a) `src/components/rh/ColaboradorPerfilUnificado.tsx`**

- Ao buscar pagamentos (linha 153-158), tambem buscar `rh_pagamento_itens` filtrados pela rubrica de Reembolso para cada pagamento
- Criar uma query adicional: `SELECT pagamento_id, SUM(valor) as total_reembolso FROM rh_pagamento_itens WHERE rubrica_id = '47d8ce78-...' AND pagamento_id IN (...) GROUP BY pagamento_id`
- Subtrair `total_reembolso` do `total_liquido` e `total_vantagens` ao exibir na tabela (linha 615) e no grafico (linhas 196-207)
- Ajustar o calculo de `totalPago` e `mediaMensal` (linha 336-337) para usar os valores ajustados

**b) `src/components/rh/RHColaboradorDashboard.tsx`**

- Mesma logica: ao buscar pagamentos (linhas 126-131), buscar tambem itens de reembolso
- Subtrair reembolsos dos valores exibidos no grafico de evolucao e no card "Total Pago (12 meses)"

### Importante:
- Isso **NAO** altera os dados salvos no banco -- apenas a exibicao
- A folha de pagamento em `RHPagamentos.tsx` continua mostrando o valor completo (com reembolso), pois la e o registro contabil real
- Apenas o historico no perfil do colaborador e o dashboard individual abatam reembolsos da visualizacao

---

## Resumo de Alteracoes

| Arquivo | Mudanca |
|---|---|
| `ColaboradorPerfilUnificado.tsx` | Botao de alterar foto (admin/socio); Subtrair reembolsos do historico e grafico de pagamentos |
| `RHColaboradorDashboard.tsx` | Subtrair reembolsos do grafico e metricas de pagamentos |
