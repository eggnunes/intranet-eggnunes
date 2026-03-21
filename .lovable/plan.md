

## Correções na Caixinha de Desabafo

### 1. Ícone do olho — adicionar tooltip

Os ícones `Eye` (verde) e `EyeOff` (vermelho/laranja) nas linhas 473-477 indicam se a mensagem foi enviada **identificada** ou **anônima**. Falta um tooltip para explicar isso.

**Correção:** Envolver cada ícone com `<Tooltip>` do shadcn:
- `EyeOff` (laranja) → tooltip: "Mensagem anônima"
- `Eye` (verde) → tooltip: "Remetente identificado"

### 2. Botão "Ver" remetente — esconder com gesto secreto

O botão `Ver` nas linhas 592-609 é visível demais. Substituir por um **gesto secreto**: clicar 3 vezes rapidamente no ícone do `UserX` (avatar anônimo) revela o remetente. Sem nenhum botão, texto ou indicação visual de que isso é possível.

**Implementação:**
- Remover o `<Button>` "Ver"/"Ocultar" completamente
- Adicionar um contador de cliques rápidos no ícone do avatar (triple-click em < 1 segundo)
- Ao completar o triple-click, faz toggle do `showSender`
- Nenhuma pista visual — apenas quem sabe do gesto consegue revelar

### Arquivo a editar
- `src/pages/CaixinhaDesabafo.tsx`

