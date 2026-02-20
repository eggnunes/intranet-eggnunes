

## Redesenho do RotaDoc: Pré-visualização, IA por arquivo, reordenação e processamento final

### O que o usuário quer

O fluxo atual é: **upload → processar tudo direto → baixar resultado**. O novo fluxo pedido é:

```text
Upload → Pré-visualização unificada (com drag&drop para reordenar)
       → Botões por arquivo: [IA Recortar] [IA Rotacionar] [Manual Recortar] [Manual Rotacionar]
       → Clicar na miniatura → ampliar para ver resultado
       → Escolher: "Juntar em 1 PDF" ou "Manter separados"
       → Processar → Baixar
```

---

### Análise do código atual

**Problema identificado nos PDFs:** o `process-documents` é chamado com `mergeAll: true` no lote, independente da opção do usuário. Isso provavelmente causa erro quando PDFs grandes chegam em lote — a edge function tenta fazer merge no servidor. A refatoração resolverá isso.

**O que já existe e será reaproveitado:**
- `FilePreview.tsx` — já tem drag&drop, botão de auto-crop por IA (Wand2), editor manual (ImageCropEditor), setas de mover
- `ImageCropEditor.tsx` — editor completo com crop, rotação, flip
- `auto-crop-document` edge function — retorna crop + rotation por imagem
- `process-documents` edge function — converte imagens para PDF
- `applyCrop()`, `handleAutoCrop()`, `handleBatchAutoCrop()` — lógica de recorte já funcional

**O que será criado/modificado:**
1. Novo componente `RotaDocPreview.tsx` — a tela de pré-visualização central
2. Novo componente `RotaDocFileCard.tsx` — card de cada arquivo com miniaturas maiores e botões de IA
3. Novo componente `RotaDocLightbox.tsx` — modal de ampliação ao clicar na miniatura
4. Modificação de `RotaDoc.tsx` — novo fluxo em etapas
5. Modificação de `ProcessingStatus.tsx` — adicionar visualização de PDFs processados

---

### Novo Fluxo em Etapas

**Etapa 1 — Upload:** igual ao atual (FileUpload)

**Etapa 2 — Pré-visualização e ajuste (NOVO):** aparece após selecionar arquivos, antes de processar

**Etapa 3 — Processamento:** ao clicar em "Processar" após revisar

**Etapa 4 — Download:** igual ao atual

---

### Componente `RotaDocFileCard.tsx` (novo)

Cada arquivo terá um card maior com:

```
┌─────────────────────────────────────────────┐
│  [═] Drag handle                 [↑][↓][✕]  │
│                                              │
│  ┌────────────────────┐                      │
│  │                    │  📄 nome_arquivo.jpg │
│  │   MINIATURA        │  1.2 MB • image/jpeg │
│  │   (clicável para   │                      │
│  │    ampliar)        │  IA:                 │
│  │                    │  [✨ Recortar IA]    │
│  │                    │  [🔄 Rotacionar IA]  │
│  └────────────────────┘                      │
│                                              │
│  Manual:                                     │
│  [✂️ Recortar Manual] [↻ Rot. 90°]          │
└─────────────────────────────────────────────┘
```

**Detalhes dos botões:**
- **Recortar IA** (`Wand2`): chama `auto-crop-document`, aplica crop automaticamente, atualiza miniatura
- **Rotacionar IA** (`Sparkles`/`RotateCw`): chama a mesma `auto-crop-document` mas aplica apenas a rotação sugerida (ignora crop)
- **Recortar Manual** (`Crop`): abre `ImageCropEditor` existente
- **Rotacionar 90°** (`RotateCw`): rotaciona o arquivo +90° manualmente no cliente (sem IA)
- **Para PDFs:** mostrar ícone de PDF com número de páginas; botões de IA ficam desabilitados (IA só funciona em imagens); apenas botões de ordem/remoção disponíveis

---

### Componente `RotaDocLightbox.tsx` (novo)

Dialog/modal que abre ao clicar na miniatura:
- Exibe a imagem em tamanho grande (até 80vw x 80vh)
- Botão fechar
- Mostra nome do arquivo
- Para PDFs: mostra ícone grande com nome

---

### Botão "IA: Rotacionar e Recortar todos" (lote)

No cabeçalho da lista, um botão "✨ Aplicar IA em todos" que:
1. Processa cada imagem sequencialmente com `auto-crop-document`
2. Aplica tanto o crop quanto a rotação sugerida
3. Exibe barra de progresso
4. **Tenta reordenar** os arquivos com base no tipo de documento detectado pela IA (agrupando por `documentType` retornado)

---

### Seção de opções e processamento

Após a lista de arquivos, substituir o card atual de opções por:

```
┌─────────────────────────────────────────────┐
│  Opções de saída                             │
│                                              │
│  ○ Juntar tudo em 1 PDF único                │
│  ○ Manter documentos separados               │
│                                              │
│  [  Processar Documentos  ]                  │
└─────────────────────────────────────────────┘
```

---

### Correção do erro com PDFs grandes (problema relatado)

O erro do colaborador provavelmente ocorre porque:
1. A edge function `process-documents` recebe PDFs grandes e tenta processá-los junto com imagens
2. O `mergeAll: true` é sempre enviado ao servidor mesmo quando o usuário não quer mesclar

**Correção:**
- Enviar `mergeAll: false` para a edge function sempre (cada arquivo vira 1 PDF individualmente no servidor)
- O merge final é feito **no cliente** com `pdf-lib` (já existe essa lógica em `RotaDoc.tsx` linhas 212-236), mas apenas se o usuário escolher "Juntar em 1 PDF"
- Para PDFs já existentes (não imagens), incluí-los diretamente no merge sem reprocessar pelo servidor — apenas imagens passam pela edge function

---

### Arquivos a criar/modificar

| Arquivo | Tipo | Descrição |
|---|---|---|
| `src/components/RotaDocFileCard.tsx` | Criar | Card individual com miniatura clicável, botões IA e manual por arquivo, drag handle |
| `src/components/RotaDocLightbox.tsx` | Criar | Modal de ampliação da miniatura |
| `src/pages/RotaDoc.tsx` | Modificar | Novo fluxo em etapas, usar os novos componentes, corrigir lógica de merge |
| `src/components/FilePreview.tsx` | Manter | Ainda usado pelo novo componente como referência de lógica |
| `src/components/ProcessingStatus.tsx` | Manter | Sem mudanças necessárias |

> **Nota:** `FilePreview.tsx` não será deletado pois a lógica de `applyCrop`, `getImageDimensions` etc. será extraída para uso nos novos componentes. A lógica de AI crop e rotação manual será replicada no `RotaDocFileCard.tsx` de forma especializada.

---

### Comportamento da Rotação Manual (90° por clique)

Para a rotação manual via botão:
1. Carregar o File como imagem no canvas
2. Girar 90° no sentido horário
3. Exportar como novo File
4. Atualizar a miniatura imediatamente

Isso funciona para imagens JPG/PNG. Para PDFs, exibir aviso de que rotação manual em PDF não está disponível (usar o editor da IA após conversão).

---

### Comportamento da IA separado: Crop vs Rotação

Atualmente `auto-crop-document` retorna ambos `rotation` e `cropX/Y/W/H`. Para os dois botões separados:
- **[IA Recortar]**: aplica `cropX, cropY, cropWidth, cropHeight` + `rotation`
- **[IA Rotacionar]**: aplica apenas `rotation` (sem alterar o crop — equivale a cropX=0, cropY=0, cropWidth=100, cropHeight=100 com rotação)

Ambos chamam a mesma edge function, mas com lógica de aplicação diferente no cliente.

---

### Resultado esperado

1. Usuário sobe os arquivos
2. Aparece lista de cards com miniaturas maiores
3. Clica em "✨ Aplicar IA em todos" → IA recorta, rotaciona e tenta reordenar
4. Clica em cada miniatura para ver resultado ampliado
5. Para arquivos que ficaram errados: usa botões manuais de cada card
6. Arrasta cards para reordenar se necessário
7. Escolhe "1 PDF único" ou "separados"
8. Clica "Processar" → resultado final disponível para download

