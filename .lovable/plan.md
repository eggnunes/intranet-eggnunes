
## Corrigir de vez a tela de Mensagens cortada + eliminar o 404 no preview

### O que eu identifiquei
Há dois pontos bem prováveis no código atual:

1. **A tela de Mensagens está presa a uma altura rígida**
   - Em `src/pages/Mensagens.tsx` existe um wrapper com `h-[calc(100vh-8rem)]`.
   - Em layouts com sidebar + header + áreas com `ScrollArea`, isso costuma voltar a quebrar quando a viewport muda, o zoom muda ou algum conteúdo interno cresce.

2. **O layout da conversa está permitindo overflow horizontal**
   - A tela usa vários containers `flex` sem proteção completa de shrink (`min-w-0` / `min-h-0`).
   - Isso bate com o sintoma do print: a área da conversa empurra para a direita e a página passa a ter barra horizontal, “cortando” a tela.

3. **O 404 no centro do preview indica que algum caminho inválido está sendo aberto**
   - No app, o 404 central vem do `NotFound.tsx`.
   - Como não apareceu log snapshot agora, os candidatos mais fortes são:
     - alguma navegação indevida para rota inexistente
     - algum link/recurso da tela de mensagens abrindo URL errada no preview

---

## Plano de correção

### 1. Reestruturar a altura da página de Mensagens
**Arquivo:** `src/pages/Mensagens.tsx`

Vou remover a dependência da altura rígida da página e trocar por uma estrutura mais estável para app com sidebar:

- substituir o wrapper principal por uma composição com `flex`, `flex-1`, `min-h-0`
- garantir que a área central da tela use a altura disponível real do layout, sem “estourar”
- usar `100dvh` apenas se necessário, mas priorizando a altura herdada do `Layout`

**Resultado esperado:** a tela não ficará mais cortada ao mudar tamanho/escala da janela.

---

### 2. Travar o overflow horizontal da interface de chat
**Arquivos:** `src/pages/Mensagens.tsx` e, se necessário, `src/components/Layout.tsx`

Vou ajustar os blocos principais da página para encolherem corretamente dentro do espaço disponível:

- adicionar `min-w-0` nos painéis de lista e chat
- adicionar `min-h-0` nas áreas com scroll
- revisar o container principal da conversa para impedir que conteúdo interno “empurre” a página
- garantir que anexos, previews e bolhas de mensagem respeitem largura máxima e façam wrap/truncate corretamente

**Resultado esperado:** some a barra horizontal da tela e a conversa passa a caber inteira em desktop normal.

---

### 3. Ajustar a área das mensagens para não voltar a quebrar
**Arquivo:** `src/pages/Mensagens.tsx`

Vou revisar especificamente os elementos que mais costumam causar esse retorno do bug:

- bolhas com `max-w-[90%]`
- blocos de áudio/documentos com largura mínima fixa
- cabeçalho do chat
- previews de anexos
- combinação `overflow-hidden` + `ScrollArea`

A correção será feita para manter leitura boa sem “empurrar” a largura total da página.

---

### 4. Investigar e corrigir a origem do 404
**Arquivos principais:** `src/pages/NotFound.tsx`, `src/components/ProtectedRoute.tsx`, `src/pages/Mensagens.tsx`

Vou revisar os pontos que podem estar levando o preview a abrir rota inválida:

- navegação/redirecionamento de autenticação
- links internos renderizados com `href`
- links de anexos/arquivos dentro das mensagens
- qualquer URL montada de forma incorreta que esteja caindo no catch-all `path="*"`

**Correção prática:**
- impedir navegação acidental para rota inexistente
- corrigir qualquer link interno/externo mal montado
- se o 404 estiver vindo de recurso de anexo, corrigir a URL gerada/consumida

**Resultado esperado:** o aviso 404 deixa de aparecer no centro do preview.

---

## Arquivos que eu devo mexer
- `src/pages/Mensagens.tsx`
- `src/components/Layout.tsx` (se o ajuste estrutural precisar ser reforçado no layout)
- `src/pages/NotFound.tsx` e/ou `src/components/ProtectedRoute.tsx` (apenas se a origem do 404 for rota)

---

## Resultado final esperado
- a página de **Mensagens Internas** volta a ocupar a tela corretamente
- sem corte lateral
- sem necessidade de reduzir muito a tela para enxergar tudo
- sem barra horizontal indevida
- sem o 404 aparecendo no centro do preview
