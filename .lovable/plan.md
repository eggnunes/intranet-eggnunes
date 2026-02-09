

# Corretor de Portugues - Ferramenta de Revisao Gramatical

## Resumo

Criar uma ferramenta no menu "Inteligencia Artificial" que permite upload de PDF/DOCX, analisa o texto com IA (Lovable AI / Gemini) e apresenta um relatorio detalhado de erros de portugues, sem gerar documento corrigido.

---

## Arquivos a Criar

### 1. `src/components/corretor/types.ts`
Tipos TypeScript para a feature:
- `ErroPortugues`: trecho, erro, tipo (ortografia | concordancia | regencia | pontuacao | crase | acentuacao | coesao | outro), sugestao, localizacao
- `AnaliseResult`: lista de erros, resumo por categoria, total

### 2. `src/components/corretor/CorretorUpload.tsx`
Componente de upload com drag-and-drop:
- Aceita apenas PDF e DOCX (max 20MB)
- Converte arquivo para base64 ao selecionar
- Botao "Analisar" que dispara a edge function
- Barra de progresso durante processamento (componente Progress existente)

### 3. `src/components/corretor/CorretorReport.tsx`
Relatorio de erros encontrados:
- Resumo geral com badges coloridos por categoria (ex: vermelho para ortografia, amarelo para pontuacao)
- Tabela/lista detalhada com: trecho, descricao do erro, sugestao, localizacao
- Filtro por tipo de erro
- Botao de exportar relatorio (CSV ou texto)

### 4. `src/pages/CorretorPortugues.tsx`
Pagina principal usando Layout existente:
- Titulo e descricao
- CorretorUpload para selecao do arquivo
- CorretorReport para exibicao dos resultados
- Estados: idle, uploading, analyzing, done, error

### 5. `supabase/functions/check-portuguese/index.ts`
Edge function com dois passos:
1. **Extracao de texto**: Envia o arquivo base64 para `google/gemini-2.5-flash` pedindo para extrair todo o texto do documento
2. **Analise gramatical**: Envia o texto extraido para `google/gemini-2.5-pro` com prompt especializado em revisao de portugues brasileiro (norma culta), usando **tool calling** para retornar JSON estruturado

O prompt instruira o modelo a:
- Atuar como revisor especialista em lingua portuguesa brasileira
- Categorizar erros em: ortografia, concordancia, regencia, pontuacao, crase, acentuacao, coesao, outro
- Ignorar nomes proprios, termos juridicos tecnicos e citacoes legais
- Indicar localizacao aproximada (paragrafo, pagina)
- NAO corrigir, apenas listar erros

Tratamento de erros 429 (rate limit) e 402 (creditos) com mensagens amigaveis.

---

## Arquivos a Modificar

### 6. `src/components/AppSidebar.tsx`
Adicionar item no grupo "INTELIGENCIA ARTIFICIAL":
```text
{ icon: SpellCheck, path: '/corretor-portugues', label: 'Corretor de Portugues' }
```

### 7. `src/App.tsx`
Adicionar rota protegida:
```text
/corretor-portugues -> CorretorPortugues (dentro de ProtectedRoute)
```

### 8. `supabase/config.toml`
Registrar a nova edge function:
```text
[functions.check-portuguese]
verify_jwt = false
```

---

## Detalhes Tecnicos

### Tool Calling (Structured Output)
A edge function usara tool calling para garantir resposta JSON tipada:

```text
tools: [{
  type: "function",
  function: {
    name: "report_errors",
    parameters: {
      type: "object",
      properties: {
        erros: {
          type: "array",
          items: {
            properties: {
              trecho: { type: "string" },
              erro: { type: "string" },
              tipo: { type: "string", enum: [...] },
              sugestao: { type: "string" },
              localizacao: { type: "string" }
            }
          }
        }
      }
    }
  }
}]
```

### Fluxo de Dados

```text
Usuario -> Upload PDF/DOCX (base64)
  -> Edge Function check-portuguese
    -> Gemini Flash: extrai texto
    -> Gemini Pro: analisa erros (tool calling)
  -> Retorna JSON com lista de erros
  -> Frontend renderiza relatorio
```

### Cores dos Badges por Tipo
- Ortografia: vermelho
- Concordancia: laranja
- Regencia: amarelo
- Pontuacao: azul
- Crase: roxo
- Acentuacao: rosa
- Coesao: verde
- Outro: cinza

