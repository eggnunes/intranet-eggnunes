

## Adicionar cadastro manual de andamentos na Tradução de Andamentos

### O que será feito
Adicionar um botão "Cadastrar Andamento" que abre um dialog para o usuário digitar manualmente um título de andamento. Ao cadastrar, o andamento é adicionado à lista e automaticamente a IA sugere uma tradução para ele.

### Alterações

**Arquivo:** `src/pages/TraducaoAndamentos.tsx`

1. **Importar** `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogTrigger` e ícone `Plus`
2. **Novo state**: `showAddDialog`, `newTitle` (texto digitado), `addingManual` (loading)
3. **Função `handleAddManual`**:
   - Normaliza o título digitado com `normalizeTitle()`
   - Verifica se já existe na lista (evitar duplicata)
   - Adiciona ao `uniqueTitles` e `editValues`
   - Fecha o dialog
   - Chama automaticamente `handleSuggestAI(normalizedTitle)` para sugerir tradução com IA
4. **Dialog de cadastro**: campo de texto para o título + botão "Cadastrar e Sugerir Tradução"
5. **Botão** ao lado do botão "Sugerir todas com IA" no header

### Resultado
- Usuário pode cadastrar andamentos manualmente que não vieram do ADVBox
- Ao cadastrar, a IA sugere automaticamente uma tradução humanizada
- Andamento cadastrado aparece na lista e pode ser editado normalmente

