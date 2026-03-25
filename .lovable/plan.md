

## Adicionar botão "Voltar" na página Criar Pasta de Cliente

### Problema
A página `/criar-pasta-cliente` não tem botão de voltar para a página anterior ou menu principal.

### Solução

**Arquivo: `src/pages/CriarPastaCliente.tsx`**

1. Importar `useNavigate` de `react-router-dom` e `ArrowLeft` de `lucide-react`
2. Adicionar botão "Voltar" antes do título `<h1>`, usando `navigate(-1)` para voltar à página anterior
3. Layout: um `div` flex com o botão à esquerda do título existente

