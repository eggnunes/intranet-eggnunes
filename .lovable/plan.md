

## Correção: Perda de dados ao navegar para outra página com o dialog aberto

### Problema real
O problema **não** é fechar o dialog — é navegar para outra página pela sidebar enquanto o dialog de contrato/procuração está aberto. Quando isso acontece, o componente `SetorComercial` inteiro é desmontado pelo React Router, e todo o estado local dos formulários é destruído sem que o `onOpenChange` seja disparado.

### Solução
Adicionar **auto-save periódico** (a cada 30 segundos) enquanto o dialog estiver aberto e houver dados preenchidos, mais um **save no cleanup do useEffect** (quando o componente desmonta). Isso cobre dois cenários:

1. **Navegar para outra página** — o useEffect cleanup salva antes de desmontar
2. **Perda de conexão ou crash** — o auto-save periódico garante que no máximo 30s de trabalho são perdidos

### Implementação

**`ContractGenerator.tsx`** — Adicionar useEffect com:
- `setInterval` de 30s que chama a lógica de salvar rascunho silenciosamente (se houver dados)
- Cleanup function que salva ao desmontar (`return () => { salvarRascunho(); clearInterval(); }`)
- Usar `useRef` para guardar os valores atuais dos campos (refs não ficam stale no cleanup)

**`ProcuracaoGenerator.tsx`** — Mesmo padrão:
- `setInterval` de 30s + cleanup no unmount
- `useRef` para os valores atuais

### Detalhes técnicos
- Usar `useRef` para armazenar os valores mais recentes dos campos (`contraPartida`, `objetoContrato`, etc.) porque closures de cleanup do useEffect capturam valores stale
- O save no cleanup será **síncrono-fire-and-forget** (não espera resposta, pois o componente já está desmontando)
- Não exibir toasts no auto-save periódico/cleanup para não poluir a interface

### Arquivos modificados
- **`src/components/ContractGenerator.tsx`** — useEffect com interval + cleanup + useRef
- **`src/components/ProcuracaoGenerator.tsx`** — useEffect com interval + cleanup + useRef

