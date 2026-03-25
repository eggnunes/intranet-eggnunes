

## Correções nas Mensagens Internas

### Problemas identificados

1. **Mensagens cortadas**: O balão de mensagem tem `max-w-[85%]` mas na tela a mensagem está sendo cortada na lateral direita. O container pai precisa permitir overflow adequado.

2. **Janela de edição muito pequena**: O Textarea de edição tem `min-h-[60px]` — insuficiente para mensagens longas. Precisa ser maior e redimensionável.

3. **Formatação perdida ao colar**: O campo de digitação usa `<Input>` (linha única), que elimina quebras de linha. Ao colar texto com parágrafos, tudo vira uma linha só. Precisa ser substituído por `<Textarea>` para preservar a formatação.

---

### Mudanças

**Arquivo: `src/pages/Mensagens.tsx`**

**1. Substituir Input por Textarea no campo de digitação (linha ~1735)**
- Trocar `<Input>` por `<Textarea>` para suportar múltiplas linhas e preservar quebras de parágrafo ao colar
- Ajustar altura mínima e permitir crescimento automático
- Manter envio com Enter (shift+Enter para nova linha)
- Manter as mesmas props (placeholder, value, onChange, disabled)

**2. Ampliar a Textarea de edição de mensagem (linha ~1341-1346)**
- Aumentar `min-h-[60px]` para `min-h-[120px]` 
- Adicionar `max-h-[300px]` com overflow auto para mensagens muito longas
- Aumentar a largura do balão durante edição removendo o `max-w-[85%]` ou expandindo para `max-w-[95%]`

**3. Corrigir mensagens cortadas no balão (linha ~1310-1316)**
- Aumentar `max-w-[85%]` para `max-w-[90%]` no balão
- Garantir que o container do chat tenha padding adequado para não cortar nas bordas
- Verificar que `break-words` está funcionando corretamente no `renderMessageContent`

**4. Ajuste no envio com Textarea**
- Interceptar `onKeyDown`: Enter sozinho envia a mensagem, Shift+Enter insere nova linha
- Converter o `<form onSubmit>` para funcionar com o novo comportamento

