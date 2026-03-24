

## Visualizar análise de viabilidade ao clicar no cliente

### Problema
Na tabela de viabilidade, o nome do cliente é texto estático. Não há como visualizar o parecer/análise diretamente -- apenas salvar no Teams.

### Solução
Adicionar um Dialog que abre ao clicar no nome do cliente na tabela, exibindo todos os detalhes da análise.

### Implementação

**Arquivo: `src/pages/Viabilidade.tsx`**

1. **Novo estado** para controlar o dialog de visualização:
   - `viewingCliente: ViabilidadeCliente | null`

2. **Tornar o nome clicável** na TableCell (linha 326):
   - Trocar texto simples por um `button` com estilo de link (`text-primary underline cursor-pointer`)
   - Ao clicar, setar `viewingCliente` com o cliente correspondente

3. **Novo Dialog de visualização** com o conteúdo completo:
   - Nome, CPF, Status (badge colorido)
   - Tipo de Ação
   - Data de cadastro
   - Descrição do caso (se houver)
   - **Parecer de Viabilidade** renderizado com formatação (negrito para títulos com `**`)
   - Observações
   - Botões: "Salvar no Teams" e "Fechar"
   - Se não houver parecer, exibir mensagem "Nenhuma análise realizada ainda"

4. **Renderização do parecer** com formatação markdown básica:
   - Converter linhas que começam com `**` em títulos em negrito
   - Converter `- ` em itens de lista
   - Preservar quebras de linha

