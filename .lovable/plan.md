

## Converter arquivo para PDF e salvar na mesma pasta do Teams

### O que será feito
Adicionar um botão "Converter para PDF" nos arquivos do Teams (Word, Excel, PowerPoint, etc.) que utiliza a API Microsoft Graph para converter o arquivo em PDF e salvar na mesma pasta, sem apagar o original.

### Como funciona
A API Microsoft Graph oferece endpoint de conversão nativo: `GET /drives/{driveId}/items/{itemId}/content?format=pdf` — retorna o conteúdo do arquivo convertido em PDF. Funciona para `.docx`, `.doc`, `.xlsx`, `.xls`, `.pptx`, `.ppt`, `.odt`, `.ods`, `.odp`.

### Alterações

#### 1. Edge function: nova action `convert-to-pdf`
**Arquivo:** `supabase/functions/microsoft-teams/index.ts`

- Recebe `driveId`, `itemId`, `fileName`, `folderId`
- Chama `GET /drives/{driveId}/items/{itemId}/content?format=pdf` para obter o binário PDF
- Faz upload do PDF na mesma pasta com nome `{nomeOriginal}.pdf` (ex: `contrato.docx` → `contrato.pdf`)
- Retorna o item criado

#### 2. Frontend: botão de converter
**Arquivo:** `src/pages/ArquivosTeams.tsx`

- Adicionar função `handleConvertToPdf(item)` que:
  - Chama a nova action `convert-to-pdf`
  - Mostra toast de progresso e sucesso
  - Recarrega a lista de arquivos
- Adicionar botão com ícone `FileOutput` na lista de arquivos (ao lado de download) — visível apenas para tipos convertíveis (Word, Excel, PowerPoint)
- Adicionar botão "Converter para PDF" também no modal de preview
- Função helper `canConvertToPdf(item)` para verificar extensões suportadas

### Arquivos modificados
- `supabase/functions/microsoft-teams/index.ts` — nova action `convert-to-pdf`
- `src/pages/ArquivosTeams.tsx` — botão e lógica de conversão

### Resultado
- Ao navegar nos arquivos do Teams pela intranet, arquivos Office terão botão "Converter para PDF"
- O PDF é salvo na mesma pasta do arquivo original
- O arquivo original permanece intacto

