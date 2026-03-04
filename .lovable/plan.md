

## Problema

A edge function `check-portuguese` envia arquivos DOCX como `image_url` para o Gemini, mas o Gemini **não suporta DOCX como entrada multimodal** — apenas imagens e PDFs. Isso causa erro 400 `Unsupported MIME type`.

## Solução

Extrair o texto de arquivos DOCX **no servidor** antes de enviar ao Gemini. Como DOCX é um arquivo ZIP contendo XMLs, podemos:

1. **Decodificar o base64** do arquivo DOCX
2. **Descompactar o ZIP** usando a API nativa `JSZip` ou parsing manual do XML
3. **Extrair o texto** do `word/document.xml` (o XML principal do DOCX)
4. **Para PDFs**: continuar usando o Gemini multimodal (já funciona)

### Mudanças no arquivo `supabase/functions/check-portuguese/index.ts`:

- Adicionar função `extractTextFromDocx(base64: string)` que:
  - Decodifica base64 → Uint8Array
  - Usa `fflate` (biblioteca leve de unzip disponível no Deno) para descompactar
  - Lê `word/document.xml` e extrai texto via regex (remove tags XML, preserva parágrafos)
- Alterar o fluxo do Step 1:
  - Se **PDF** → continua usando Gemini multimodal (como está)
  - Se **DOCX** → extrai texto localmente, pula a chamada multimodal do Gemini
- O Step 2 (análise gramatical) permanece inalterado — ele já recebe texto puro

### Dependência
- Usar `JSZip` via `https://esm.sh/jszip@3.10.1` (compatível com Deno) para descompactar o DOCX

### Fluxo revisado

```text
DOCX → base64 decode → unzip → parse XML → texto puro ─┐
PDF  → Gemini multimodal → texto puro ─────────────────┤
                                                        ├→ Step 2: Análise gramatical (Gemini Pro)
                                                        │
                                                        └→ Resultado com erros
```

Nenhuma mudança no frontend — apenas a edge function é atualizada.

