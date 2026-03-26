

## Edição de Avisos + Verificação do botão "Documentos Úteis"

### Análise

1. **Botão "Docs Úteis"**: Já existe (linhas 593-606) — cada anexo tem um botão `BookmarkPlus` que chama `handleSaveToUsefulDocs`. Funciona corretamente, salvando na tabela `useful_documents`. Está visível para todos os usuários.

2. **Edição de avisos**: Não existe nenhum botão de editar. Administradores só podem fixar/desafixar e excluir.

### Alterações

**Arquivo:** `src/pages/MuralAvisos.tsx`

#### Adicionar funcionalidade de edição:
- Novo estado `editingAnnouncement` para armazenar o aviso sendo editado
- Novo estado `editDialogOpen` para controlar o dialog de edição
- Reutilizar o mesmo formulário do dialog de criação, pré-preenchido com os dados do aviso
- Função `handleEdit` que abre o dialog com dados preenchidos
- Função `handleUpdate` que faz `update` na tabela `announcements`
- Permitir também adicionar/remover anexos durante a edição (carregar anexos existentes)
- Botão de editar (ícone `Pencil`) ao lado dos botões de fixar/excluir, visível para administradores

#### Ajuste no botão "Docs Úteis":
- Botão já existe e funciona. Vou garantir que está visível também para anexos de imagem e vídeo (atualmente os botões de ação aparecem para todos os anexos na seção de `flex-wrap` no final)

### Arquivos modificados
- `src/pages/MuralAvisos.tsx` — dialog de edição, botão editar, lógica de update

### Resultado
- Administradores poderão editar título, conteúdo, tipo, fixação e anexos de qualquer aviso
- Botão "Docs Úteis" permanece funcional para todos os anexos

