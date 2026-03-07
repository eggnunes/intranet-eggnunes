

# Diagnóstico: Conclusão de Tarefas no ADVBox via API

## Problema Identificado

Após análise aprofundada da documentação oficial da API do ADVBox (https://api.softwareadvbox.com.br), identifiquei a causa raiz do problema:

**A API do ADVBox NÃO possui endpoint para concluir/atualizar tarefas.**

A API disponibiliza apenas **2 endpoints** para tarefas (Posts):
- `GET /posts` — Listar tarefas
- `POST /posts` — Criar nova tarefa

Não existe `PUT /posts/{id}`, `PATCH /posts/{id}`, nem `/posts/{id}/complete`. O código atual tenta chamar `/posts/${task_id}/complete` (linha 1457 da edge function), que é um endpoint inexistente, resultando em erro.

## Confirmação

A página de referência da API lista explicitamente:

| Recurso | Endpoints | Operações |
|---------|-----------|-----------|
| Posts   | 2         | Listar e Criar |

Isso é uma **limitação da API do ADVBox** — ela não expõe funcionalidade de atualização ou conclusão de tarefas via API.

## Solução Proposta

Como não é possível concluir a tarefa no ADVBox via API, a melhor abordagem é:

1. **Marcar localmente como concluída** na tabela `advbox_tasks` (já funciona)
2. **Informar o usuário** de que a conclusão no ADVBox não é possível via API, mostrando um aviso claro na interface
3. **Ajustar o comportamento**: em vez de chamar o endpoint inexistente e falhar, atualizar apenas o banco local e exibir um toast informando que a conclusão foi registrada na intranet mas precisa ser feita manualmente no ADVBox

### Alterações

**Arquivo: `src/pages/TarefasAdvbox.tsx`**
- Modificar `handleCompleteTask` para atualizar diretamente na tabela `advbox_tasks` (status = 'completed', completed_at = now) em vez de chamar a edge function
- Exibir toast informativo: "Tarefa concluída na intranet. A conclusão no ADVBox deve ser feita manualmente (limitação da API)."

**Arquivo: `supabase/functions/advbox-integration/index.ts`**
- Remover ou comentar o case `complete-task` que chama endpoint inexistente
- Adicionar case alternativo que apenas retorna erro informativo sobre a limitação

### Resultado
- O botão "Concluir" funcionará sem erros, atualizando o status localmente
- O usuário será informado da limitação da API do ADVBox
- Quando a sincronização periódica rodar, se a tarefa for concluída manualmente no ADVBox, o status será atualizado automaticamente

