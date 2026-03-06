

# Plano: Corrigir férias da Jordânia

## Problema
1. **Saldo fantasma**: A tabela `vacation_balance` tem registros antigos (2025: 4 dias usados, 2026: 2 dias usados) que não foram limpos quando as solicitações foram excluídas. A exclusão de `vacation_requests` não recalcula automaticamente o `vacation_balance`.
2. **Configuração especial desatualizada**: O `SPECIAL_USER_PERIODS` para a Jordânia (ID `1b5787c3-c10d-4e0b-8699-83d0a2215dea`) está configurado com período `2023-10-01` a `2024-09-30` com 20 dias, mas o correto segundo o usuário é:
   - **Período estagiária**: 15/01/2024 a 30/09/2024, 15 dias úteis, 100% gozado
   - **Período atual (assistente→advogada)**: a partir de 01/10/2024, 20 dias úteis (período aquisitivo de 01/10/2024 a 30/09/2025)

## Solução

### 1. Limpar `vacation_balance` — SQL (data fix)
Deletar os dois registros fantasma da Jordânia na tabela `vacation_balance`.

### 2. Corrigir `SPECIAL_USER_PERIODS` — Código
Atualizar a configuração em `src/pages/Ferias.tsx` (linhas 142-153):

```typescript
'1b5787c3-c10d-4e0b-8699-83d0a2215dea': {
  periods: [
    {
      start: '2024-01-15',
      end: '2024-09-30',
      totalDays: 15,
      note: 'Estágio (15/01/2024 a 30/09/2024) - Totalmente gozado',
      fullyUsed: true
    }
  ],
  regularPeriodsStartFrom: '2024-10-01'
}
```

Isso faz com que:
- O primeiro período apareça como 15 dias / 15 dias usados (100% gozado) no gráfico
- Os períodos regulares de 20 dias comecem a partir de 01/10/2024

### Resultado
- O gráfico mostrará o período de estágio como totalmente gozado (15/15 dias)
- O período aquisitivo 01/10/2024 a 30/09/2025 terá 20 dias disponíveis (0 usados, já que tudo foi apagado)
- Não haverá mais "2 dias fantasma"

