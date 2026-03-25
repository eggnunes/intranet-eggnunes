

## Correção: Auto-save de progresso ao sair da aba de Contratos/Procuração

### Problema identificado
Os componentes `ContractGenerator` e `ProcuracaoGenerator` são modais (Dialogs). Quando o usuário fecha o modal ou navega para outra aba, todo o estado local (useState) é perdido. O `ContractGenerator` tem um botão manual de "Salvar Rascunho", mas o usuário precisa lembrar de clicar. O `ProcuracaoGenerator` não tem nenhum sistema de rascunho.

### Solução
Implementar **auto-save automático** em ambos os componentes, usando duas estratégias complementares:

1. **Auto-save ao fechar o dialog** — salvar automaticamente no banco quando o modal fecha (se houver dados preenchidos)
2. **Auto-load ao abrir o dialog** — carregar automaticamente o rascunho existente quando o modal abre (sem precisar clicar em botão)
3. **Criar tabela de rascunhos para Procuração** — nova tabela `procuracao_drafts` para persistir o progresso da procuração

### Arquivos e mudanças

**1. Migração SQL — Tabela `procuracao_drafts`**

```sql
CREATE TABLE procuracao_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  client_id INTEGER NOT NULL,
  client_name TEXT,
  qualification TEXT,
  tem_poderes_especiais BOOLEAN DEFAULT false,
  poderes_especiais TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, client_id)
);
```

Com RLS para autenticados e auto-update do `updated_at`.

**2. `ContractGenerator.tsx` — 2 mudanças**

- **Auto-save ao fechar**: Interceptar `onOpenChange(false)` para chamar `salvarRascunho()` silenciosamente antes de fechar, caso haja dados preenchidos (contraPartida ou objetoContrato não vazios)
- **Auto-load ao abrir**: No useEffect que verifica rascunho existente, se encontrar um, carregar automaticamente (chamar `carregarRascunho` logo após detectar o draft, sem necessidade de clique manual)

**3. `ProcuracaoGenerator.tsx` — 3 mudanças**

- Adicionar estados de rascunho (salvando, carregando, rascunhoExistente)
- Implementar `salvarRascunhoProcuracao()` que salva na tabela `procuracao_drafts`
- **Auto-save ao fechar**: Interceptar fechamento do dialog para salvar automaticamente
- **Auto-load ao abrir**: Carregar rascunho automaticamente ao abrir o dialog

### Comportamento esperado

1. Usuário abre o gerador de contrato/procuração e começa a preencher
2. Se sair da aba (fechar o modal), o progresso é salvo automaticamente no banco
3. Ao reabrir o modal para o mesmo cliente, os dados são restaurados automaticamente
4. Nenhuma ação manual necessária — o processo é transparente
5. O botão manual de "Salvar Rascunho" continua disponível no ContractGenerator

