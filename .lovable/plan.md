

## Correção: Erro "Failed to fetch" nos Agentes de IA

### Problema identificado

A edge function `chat-with-agent` está crashando no boot por causa da biblioteca `pdf-parse` importada via `esm.sh`. Esta biblioteca tenta ler um arquivo de teste (`test/data/05-versions-space.pdf`) ao ser carregada, e esse arquivo não existe no ambiente de edge functions. O erro nos logs:

```
path not found: .../chat-with-agent/test/data/05-versions-space.pdf
```

Isso faz a função falhar completamente, resultando em "Failed to fetch" para o usuário.

### Solução

Substituir a importação do `pdf-parse` via `esm.sh` por uma abordagem que não dependa desse arquivo de teste. A solução é usar `npm:pdf-parse` (importação via npm specifier do Deno) que não tem esse problema, ou usar a biblioteca `pdf-lib` / `pdfjs-dist` como alternativa.

A forma mais confiável é usar o specifier `npm:pdf-parse` em vez de `https://esm.sh/pdf-parse@1.1.1`, pois o Deno resolve dependências npm sem os problemas de path do esm.sh.

### Implementação

**Arquivo: `supabase/functions/chat-with-agent/index.ts`**

- Linha 3: Trocar `import pdf from "https://esm.sh/pdf-parse@1.1.1"` por uma implementação manual de extração de PDF usando `https://cdn.jsdelivr.net/npm/pdfjs-dist@4.0.379/build/pdf.mjs` (pdfjs-dist funciona no Deno sem arquivos de teste), **ou** usar a abordagem de importar via `npm:` specifier
- A solução mais simples e testada: trocar para `npm:pdf-parse@1.1.1` que funciona no Deno edge runtime sem o problema do arquivo de teste

### Arquivo modificado
- **`supabase/functions/chat-with-agent/index.ts`** — trocar import do pdf-parse

