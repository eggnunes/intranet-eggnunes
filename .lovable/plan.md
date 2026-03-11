

# Plano: Verificação Direta sem Pop-up

## Pedido do Áudio
A coordenadora quer que ao clicar "Verificar", a verificação seja feita **direto**, sem abrir o dialog de confirmação. O pop-up adiciona um passo desnecessário e o processamento está lento.

## Alterações em `src/pages/ControlePrazos.tsx`

### 1. Verificação instantânea (sem dialog)
- Substituir o `onClick={() => openVerifyDialog(task)}` do botão "Verificar" por uma chamada direta que insere na `prazo_verificacoes` com status `verificado` e sem observações
- Manter o botão "Rever" (quando já verificado) abrindo o dialog normalmente, para permitir alterar status/observações
- Adicionar um estado `verifyingId` para mostrar loading no botão específico enquanto processa

### 2. Otimização de performance
- Após inserir a verificação, atualizar o estado local (`verificacoes`) em vez de refazer `fetchData()` completo — isso elimina o tempo de espera da recarga total
- O dialog de verificação continua existindo apenas para o caso "Rever" (quando já tem verificação anterior)

### Resumo
- **Clique em "Verificar"** → insere direto como `verificado`, atualiza estado local, sem dialog
- **Clique em "Rever"** → abre dialog normalmente para editar status/observações
- Atualização otimista do estado local para feedback instantâneo

