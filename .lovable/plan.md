
## Diagnóstico

O problema está visível no código atual de `src/pages/AgenteChatPage.tsx`:

1. O resumo ainda está sendo cortado manualmente:
   - hoje existe `agent.objective.length > 120 ? agent.objective.slice(0, 120) + '...' : agent.objective`
   - por isso o texto no centro continua truncado

2. O layout do estado vazio está “empurrando” o chat para baixo:
   - o container principal usa altura fixa `calc(100vh - 8rem)`
   - a área vazia usa `h-full` + `justify-center` + `py-20`
   - isso cria um bloco muito alto no meio e deixa o composer colado na base da tela

3. Ainda existe espaçamento vertical excessivo entre:
   - o resumo do agente
   - “Envie uma mensagem para começar”
   - a caixa de mensagem

## Plano de correção

### 1. Ajustar a estrutura vertical da página
Em `src/pages/AgenteChatPage.tsx`:
- trocar a estratégia de altura fixa por uma estrutura mais estável com `flex`, `min-h-0` e distribuição correta do espaço interno
- fazer a área do chat ocupar o espaço disponível sem “forçar” o input para o rodapé visual
- subir o composer alguns pixels, reduzindo a sensação de que ele está colado na parte de baixo

### 2. Corrigir o estado vazio do chat
Na tela sem mensagens:
- remover o truncamento manual do `objective`
- exibir o texto completo do resumo do agente
- limitar pela largura do bloco, não por corte de caracteres
- reduzir o espaço vazio entre o resumo, a frase “Envie uma mensagem para começar” e o campo de mensagem
- reposicionar esse conteúdo um pouco mais para cima, em vez de centralizar exageradamente na altura total

### 3. Manter o header limpo
No topo:
- manter apenas ícone + nome do agente
- não recolocar resumo no header
- preservar os botões de histórico e nova conversa

### 4. Refinar o espaçamento do composer
Na área de envio:
- ajustar `mt`, `pt` e `pb` do bloco inferior
- garantir que os botões de anexo, microfone e envio continuem totalmente visíveis
- evitar que a borda superior e o padding façam o campo parecer “afundado” no fim da página

## Resultado esperado

Depois da correção:
- o resumo aparecerá só no centro da tela inicial
- o texto do resumo não ficará cortado
- haverá menos espaço em branco desnecessário
- a caixa de mensagem ficará visualmente mais acima
- o chat continuará com anexo e microfone visíveis

## Arquivo a ajustar
- `src/pages/AgenteChatPage.tsx`
