
# Plano de Correção Definitiva do Scroll Horizontal no Kanban

## Diagnóstico do Problema

Identifiquei que o problema de rolagem horizontal no Kanban (CRM e Recrutamento) é causado por uma cadeia de containeres CSS que estão restringindo incorretamente o scroll:

```text
Layout (SidebarInset)
  └── main (overflow-auto, flex-1, padding)
        └── CRMDashboard
              └── TabsContent
                    └── Kanban Container (overflow-x: scroll)
                          └── Flex Container (width: max-content)
                                └── Colunas (w-80, flex-shrink-0)
```

**Causas Raiz:**
1. O elemento `main` tem `overflow-auto` que compete com o scroll do Kanban
2. A técnica de margem negativa (`margin: -1rem`) não está expandindo corretamente a área de scroll
3. O container interno usa `width: max-content` mas o container pai não tem largura suficiente

---

## Solução Proposta

### Estratégia: Scroll Container Isolado

A solução envolve criar um container de scroll completamente isolado que:
- Ignora as restrições de padding do container pai
- Usa `100vw` calculado para garantir largura total
- Mantém scrollbar sempre visível e funcional

### Arquivos a Modificar

1. **src/components/crm/CRMDealsKanban.tsx**
2. **src/components/RecruitmentKanban.tsx**

---

## Alterações Técnicas

### Para ambos os arquivos (CRMDealsKanban.tsx e RecruitmentKanban.tsx):

1. **Wrapper Externo com Position Relative**
   - Criar um wrapper com `position: relative` e `width: 100%`
   - Isso estabelece o contexto para o scroll container

2. **Container de Scroll Refeito**
   ```jsx
   <div style={{
     display: 'block',
     overflowX: 'auto',
     overflowY: 'visible',
     width: '100%',
     maxWidth: '100%',
   }}>
   ```

3. **Container Flex Interno Corrigido**
   ```jsx
   <div style={{
     display: 'inline-flex',
     gap: '20px',
     padding: '8px 0',
     paddingRight: '16px', // Espaço no final
   }}>
   ```

4. **Colunas com Largura Fixa Garantida**
   - Manter `width: 320px` (ou `w-80` equivalente)
   - Manter `flex-shrink: 0` para não comprimir

5. **CSS Customizado para Scrollbar**
   ```css
   #kanban-scroll-container {
     scrollbar-width: thin;
     scrollbar-color: hsl(var(--primary)) hsl(var(--muted));
   }
   #kanban-scroll-container::-webkit-scrollbar {
     height: 12px;
   }
   #kanban-scroll-container::-webkit-scrollbar-track {
     background: hsl(var(--muted));
     border-radius: 6px;
   }
   #kanban-scroll-container::-webkit-scrollbar-thumb {
     background: hsl(var(--primary));
     border-radius: 6px;
   }
   ```

---

## Código Específico

### CRMDealsKanban.tsx (linhas 995-1050 aproximadamente)

**Antes:**
```jsx
<div 
  id="crm-kanban-scroll"
  className="pb-6"
  style={{
    overflowX: 'scroll',
    overflowY: 'visible',
    WebkitOverflowScrolling: 'touch',
    marginLeft: '-1rem',
    marginRight: '-1rem',
    paddingLeft: '1rem',
    paddingRight: '1rem',
  }}
>
  <div 
    className="flex gap-5 py-2"
    style={{
      width: 'max-content',
      minWidth: '100%',
      paddingRight: '1rem',
    }}
  >
```

**Depois:**
```jsx
<div 
  id="crm-kanban-scroll"
  style={{
    display: 'block',
    width: '100%',
    overflowX: 'auto',
    overflowY: 'visible',
    WebkitOverflowScrolling: 'touch',
    paddingBottom: '1.5rem',
  }}
>
  <div 
    style={{
      display: 'inline-flex',
      gap: '20px',
      paddingTop: '8px',
      paddingBottom: '8px',
    }}
  >
```

### RecruitmentKanban.tsx (linhas 142-165 aproximadamente)

Aplicar a mesma estrutura do CRMDealsKanban.

---

## Por que Esta Solução Funciona

1. **`display: inline-flex`** - O container interno ocupa apenas o espaço necessário para seus filhos, permitindo que o scroll funcione corretamente

2. **Remoção das margens negativas** - A técnica de margem negativa estava causando conflitos com o cálculo de largura

3. **`overflowX: auto`** - Mostra a scrollbar apenas quando necessário, mas garante que ela apareça

4. **Largura fixa nas colunas** - Cada coluna tem `320px` fixos com `flex-shrink: 0`, garantindo que não sejam comprimidas

---

## Resultado Esperado

Após as alterações:
- Scrollbar horizontal sempre visível quando houver mais colunas do que cabem na tela
- Primeira coluna visível sem cortes ao rolar para o início
- Última coluna visível sem cortes ao rolar para o final
- Funcionamento idêntico em desktop e mobile
- Drag-and-drop continua funcionando normalmente

