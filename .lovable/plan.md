

## Correção: Agente de IA não analisa documentos anexados

### Problema raiz
O código de processamento de anexos (linhas 118-135 da edge function `chat-with-agent`) apenas lista o **nome** dos arquivos PDF/DOCX sem extrair o conteúdo. Somente arquivos de texto puro (.txt, .csv) têm seu conteúdo decodificado e injetado no prompt. Como o modelo recebe apenas "- contrato.pdf (application/pdf)" sem o texto do documento, ele inventa a resposta.

### Solução

**1. Extrair texto de PDFs na edge function `chat-with-agent/index.ts`**

- Importar a biblioteca `pdf-parse` (via esm.sh) para extrair texto de arquivos PDF a partir do base64
- Para arquivos DOCX, decodificar o base64 e usar `mammoth` (via esm.sh) para extrair texto
- Injetar o texto extraído no contexto da mensagem, da mesma forma que já é feito para .txt/.csv
- Limitar a 80.000 caracteres por arquivo para não estourar o contexto do modelo

**2. Adicionar instrução anti-alucinação no system prompt**

No bloco do system prompt (linha 32), adicionar regra explícita:

```
## REGRA CRÍTICA
- NUNCA invente, fabrique ou suponha informações que não foram fornecidas.
- Quando o usuário anexar um documento, sua resposta DEVE ser baseada EXCLUSIVAMENTE no conteúdo desse documento.
- Se não conseguir ler ou interpretar o conteúdo do documento, informe isso claramente ao usuário em vez de inventar uma resposta.
- Se a informação solicitada não estiver presente no documento, diga explicitamente que não encontrou essa informação.
```

**3. Melhorar o processamento de anexos**

Expandir a lógica de decodificação para cobrir:
- `.pdf` → extrair texto via pdf-parse
- `.docx` → extrair texto via mammoth  
- `.json`, `.xml`, `.md`, `.html` → decodificar base64 como texto (mesmo tratamento de .txt/.csv)
- Outros formatos → informar no contexto que o arquivo foi anexado mas o conteúdo não pôde ser extraído

### Detalhes técnicos

- Bibliotecas: `import pdf from "https://esm.sh/pdf-parse@1.1.1"` e `import mammoth from "https://esm.sh/mammoth@1.8.0"`
- O base64 do arquivo será convertido para `Uint8Array` via `Uint8Array.from(atob(base64), c => c.charCodeAt(0))` antes de passar ao parser
- Fallback: se a extração falhar, incluir mensagem no contexto dizendo "Não foi possível extrair o conteúdo de [nome_arquivo]"

