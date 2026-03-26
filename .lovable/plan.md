

## Duas correções: Botão de voltar no TV Mode + Nomes dos clientes no Ranking

### 1. Botão de voltar no TV Mode

**Arquivo:** `src/pages/TVMode.tsx`

Adicionar um botão discreto no canto superior esquerdo (ou próximo ao relógio) com ícone de seta para voltar, que navega para a intranet (`/dashboard` ou a rota anterior). O botão terá opacidade reduzida para não atrapalhar a exibição na TV, ficando mais visível ao passar o mouse.

### 2. Nomes dos clientes no Ranking de Vendedores

**Arquivo:** `src/components/crm/CRMRanking.tsx`

**Problema:** Na linha 165, o `contactName` é buscado apenas do `crm_contacts` via `contact_id`. Muitos deals não têm `contact_id` vinculado (a sincronização nem sempre encontra o contato correspondente). O campo `name` do deal no RD Station geralmente contém o nome do cliente.

**Correção:** Usar o nome do contato quando disponível, mas fazer fallback para o `name` do deal (que vem do RD Station com o nome do cliente):

```typescript
// Antes (linha 165):
contactName: d.contact_id ? (contactMap.get(d.contact_id) || null) : null,

// Depois:
contactName: (d.contact_id ? contactMap.get(d.contact_id) : null) || d.name || null,
```

Isso garante que, mesmo sem `contact_id` vinculado, o nome do deal (que no RD Station é o nome do cliente) será exibido na coluna "Cliente".

### Resultado
- TV Mode terá botão de saída para voltar à intranet
- Ranking mostrará o nome do cliente usando o nome do deal como fallback quando o contato não está vinculado

