

## Sincronizar busca global com o menu lateral (fonte única de verdade)

### Problema
A lista de itens buscáveis em `Layout.tsx` é hardcoded e separada do menu lateral (`AppSidebar.tsx`). Quando novas funcionalidades são adicionadas ao sidebar, a busca não é atualizada. Há ~20 itens faltando na busca.

### Solução
Extrair a definição dos grupos de menu para um arquivo compartilhado. Tanto o `AppSidebar` quanto o `Layout` importam a mesma fonte. Qualquer item novo no menu aparece automaticamente na busca.

### Implementação

**1. Criar `src/lib/menuData.ts`**
- Exportar a interface `MenuItemDef` e `MenuGroupDef` (mover de AppSidebar)
- Exportar uma função `getMenuGroups(isAdmin, isSocio, counts)` que retorna os 11 grupos de menu com todos os itens (o mesmo array que está hoje nas linhas 171-323 do AppSidebar)
- Cada item ganha um campo opcional `searchDescription` para a busca (ex: "Chat com IA", "Gestão de leads")

**2. Atualizar `src/components/AppSidebar.tsx`**
- Remover as interfaces e o array `menuGroups` inline
- Importar `getMenuGroups` de `@/lib/menuData`
- Chamar `getMenuGroups(isAdmin, isSocio, { criticalTasksCount, pendingUsersCount })` no `useMemo`
- Resto do componente permanece igual

**3. Atualizar `src/components/Layout.tsx`**
- Remover o array `allSearchableItems` hardcoded (linhas 137-183)
- Importar `getMenuGroups` de `@/lib/menuData`
- Gerar os itens buscáveis dinamicamente a partir dos grupos filtrados:
  ```
  const searchableItems = filteredGroups.flatMap(g =>
    g.items.map(i => ({ path: i.path, label: i.label, description: i.searchDescription || '', category: g.label }))
  )
  ```
- O `CommandDialog` usa esse array derivado em vez do hardcoded

### Itens que serão adicionados automaticamente (faltam hoje)
Corretor de Português, Gerador de QR Code, TV Mode, Marketing Hub, Contratos, Parceiros, Distribuição de Tarefas, Controle de Prazos, Movimentações Advbox, Publicações DJE, Portais de Tribunais, Dashboard Financeiro, Asaas, Gestão de Cobranças, Financeiro Admin, Dashboard RH, Pesquisa de Humor, Gestão de Folgas, Viabilidade, Novo Cliente Viabilidade, Notificações, Mensagens Encaminhadas, Cadastros Úteis, Criar Pasta de Cliente

### Resultado
- Fonte única de verdade para menu e busca
- Qualquer item adicionado ao sidebar aparece automaticamente na busca
- Zero manutenção futura na lista de busca

