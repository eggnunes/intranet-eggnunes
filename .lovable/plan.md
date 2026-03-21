

## Mover "Aniversários Clientes" de RH para Produção Jurídica

### Problema
O item "Aniversários Clientes" está no grupo "Recursos Humanos" do sidebar, mas deveria estar em "Produção Jurídica" pois os dados vêm do ADVBox.

### Alteração

**Arquivo: `src/components/AppSidebar.tsx`**
- Remover `{ icon: Cake, path: '/aniversarios-clientes', label: 'Aniversários Clientes' }` do grupo `rh`
- Adicionar ao grupo `producao-juridica`, no final do bloco ADVBox (após "Publicações ADVBox" e antes do bloco não-ADVBox)

