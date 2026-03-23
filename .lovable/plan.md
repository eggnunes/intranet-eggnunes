

# Atualizar chave ANTHROPIC_API_KEY

## Diagnóstico confirmado

Testei a Edge Function `suggest-task` agora e a Anthropic retornou:

> "Your credit balance is too low to access the Anthropic API"

A chave que aparece como **"Never used"** na sua imagem confirma que ela **nunca foi usada** — ou seja, a chave configurada no backend ainda e a antiga, que nao tem credito.

## Solucao

Preciso que voce me forneça a nova chave de API da Anthropic para eu atualizar o segredo `ANTHROPIC_API_KEY` no backend. Vou usar a ferramenta de adicionar segredo para solicitar a chave.

## Passo unico

1. Atualizar o segredo `ANTHROPIC_API_KEY` com a nova chave que voce criou na Anthropic (a que aparece como "Never used")
2. Testar a funcao `suggest-task` para confirmar que funciona

Nenhum arquivo de codigo precisa ser alterado — apenas o segredo.

