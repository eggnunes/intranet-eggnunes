

# Plano: Melhorias no Controle de Prazos

## Pedidos dos Áudios

**Áudio 1**: Tarefas são abertas em "pastas" (lawsuits) no ADVBox que às vezes não têm número de processo, mas têm nome do cliente. O sistema já extrai o nome do cliente de `raw_data.lawsuit.customers[0].name`, porém o campo `process_number` sendo nulo não é impeditivo — o sistema já mostra "Sem número". O dado do cliente já está sendo puxado corretamente. Nenhuma alteração estrutural necessária aqui, o sistema já funciona assim.

**Áudio 2**: A coordenadora quer poder **verificar em bloco** — selecionar várias tarefas (ex: todas de um colaborador específico) e concluir/verificar todas de uma vez, em vez de clicar uma por uma.

**Mensagem do chat**: "o sistema de prazos tem que sempre puxar as tarefas do ADVBox e tem tarefas que às vezes não tem número de processo ainda só tem o nome da pessoa" — confirma o áudio 1.

## Alterações em `src/pages/ControlePrazos.tsx`

### 1. Verificação em Bloco (Bulk Verify)
- Adicionar estado `selectedTaskIds: Set<string>` para rastrear tarefas selecionadas
- Adicionar **checkbox** na header da tabela (selecionar todos da página) e em cada linha (tarefas verificáveis)
- Adicionar botão **"Verificar Selecionados"** que aparece quando há tarefas selecionadas
- Ao clicar, abre dialog de verificação que aplica o status/observações para todas as selecionadas de uma vez
- Inserir múltiplos registros na tabela `prazo_verificacoes` em batch

### 2. Garantir exibição de tarefas sem número de processo
- O código atual já faz isso corretamente (mostra "Sem número")
- O `cliente_nome` já é extraído de `rawData.lawsuit?.customers?.[0]?.name`
- Não há filtro que exclua tarefas sem `process_number`
- Nenhuma mudança necessária neste ponto — apenas confirmar que funciona

### Resumo de Mudanças
- **Arquivo**: `src/pages/ControlePrazos.tsx`
- **Adições**: Checkbox de seleção múltipla, botão "Verificar Selecionados", lógica de inserção em batch na `prazo_verificacoes`

