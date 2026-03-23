
# Corrigir erro genérico em “Sugerir tarefa com IA” mantendo Anthropic

## Diagnóstico
Analisei o fluxo e encontrei dois pontos distintos:

1. **Backend**
   - A função `suggest-task` continua chamando a **Anthropic** corretamente.
   - Os logs mostram que as chamadas chegaram na Anthropic e ela respondeu com:
     - `400 invalid_request_error`
     - mensagem: **“Your credit balance is too low…”**
   - Ou seja: o problema original era mesmo saldo/crédito da Anthropic, não troca de provedor.

2. **Frontend**
   - Em `src/components/TaskCreationForm.tsx`, o catch exibe sempre a mensagem genérica:
     - **“Não foi possível gerar sugestão.”**
   - Então, mesmo quando a função já retorna um erro claro, a UI “engole” a mensagem real.
   - Isso explica por que você só vê erro genérico.

## O que vou ajustar
### 1. Melhorar a função `suggest-task`
Manter Anthropic e reforçar o tratamento de erro para sempre devolver uma mensagem clara e padronizada, incluindo:
- crédito insuficiente
- autenticação inválida
- rate limit
- fallback com a mensagem retornada pela Anthropic quando houver

### 2. Corrigir a UI de criação de tarefa
Em `src/components/TaskCreationForm.tsx`:
- capturar corretamente o erro retornado por `supabase.functions.invoke`
- ler o corpo do erro da função
- exibir a mensagem real no toast, por exemplo:
  - “A API de IA está sem créditos...”
  - ou outra mensagem específica da Anthropic

### 3. Ajustar a lógica de sucesso/erro
Hoje a tela só trata sucesso quando `data && !data.error`, mas no erro HTTP ela cai no catch sem mostrar contexto.
Vou padronizar para:
- tratar `data?.error`
- tratar erro HTTP da função
- evitar toast genérico quando existir mensagem específica

## Arquivos a alterar
| Arquivo | Ação |
|---|---|
| `supabase/functions/suggest-task/index.ts` | Refinar retorno de erros da Anthropic |
| `src/components/TaskCreationForm.tsx` | Mostrar mensagem real do backend no toast |

## Resultado esperado
- A sugestão continuará usando **Anthropic**.
- Se os créditos já estiverem ativos, a sugestão voltará a funcionar normalmente.
- Se ainda houver qualquer bloqueio na Anthropic, você verá a **causa real** na tela, e não mais uma mensagem genérica.

## Observação importante
Pelos logs que vi, o backend ainda registrava “credit balance is too low” nas últimas tentativas analisadas. Então a correção precisa resolver **duas coisas ao mesmo tempo**:
- transparência da mensagem no frontend
- robustez do retorno da função

## Validação após implementação
- testar uma sugestão de tarefa real
- confirmar que, com crédito ativo, a resposta volta preenchida
- confirmar que, se a Anthropic falhar, o toast mostra a mensagem específica correta
