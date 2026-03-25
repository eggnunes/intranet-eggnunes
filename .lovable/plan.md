

## Expandir detalhes de contratos fechados por vendedor no Ranking CRM

### O que será feito
Ao clicar no card de cada vendedor no ranking, ele expande e mostra a lista de todos os contratos fechados por aquele vendedor no período selecionado, com detalhes como nome do cliente, produto, valor e data de fechamento.

### Implementação

**Arquivo: `src/components/crm/CRMRanking.tsx`**

1. **Buscar dados completos dos deals won**: Alterar a query de deals para incluir `id, name, value, closed_at, contact_id` (além de `owner_id, won`). Também buscar `crm_contacts` (id, name) para mapear o nome do cliente.

2. **Armazenar deals por vendedor**: Criar um `Map<string, Deal[]>` agrupando os deals won por `owner_id`, para acesso rápido ao expandir.

3. **Estado de expansão**: Adicionar `expandedSellerId` state. Ao clicar no card do vendedor, toggle entre expandido/colapsado.

4. **UI expandida**: Usar `Collapsible` do Radix (já existe em `ui/collapsible.tsx`). Dentro do card expandido, renderizar uma tabela/lista com:
   - Nome do cliente (do contato vinculado)
   - Nome do deal / Produto
   - Valor (R$)
   - Data de fechamento
   - Ícone `ChevronDown`/`ChevronUp` no card para indicar que é clicável

5. **Imports adicionais**: `Collapsible, CollapsibleContent, CollapsibleTrigger` de `@/components/ui/collapsible`, `ChevronDown` de `lucide-react`.

### Resultado esperado
- Clicar no card de um vendedor expande uma seção abaixo mostrando todos os contratos fechados com detalhes
- Clicar novamente fecha a seção
- Indicador visual (chevron) mostra que o card é clicável/expansível

