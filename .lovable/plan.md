

## Corrigir Cursor Pulando nos Campos de Valor do Rateio (RH Pagamentos)

### Problema

No campo de **valor (R$)** do rateio em RH Pagamentos, o valor exibido usa `toLocaleString('pt-BR', { minimumFractionDigits: 2 })`. Isso significa que ao digitar "1", o campo imediatamente formata para "1,00" e o cursor pula para depois dos centavos. O usuario nao consegue digitar naturalmente (ex: "1500" vai virando "1,00" -> "10,00" em vez de "1500").

O mesmo problema existe no componente `RateioLancamento.tsx` (financeiro), onde `formatCurrencyInput` tambem forca 2 casas decimais.

### Causa Raiz

- **Linha 1340 de `RHPagamentos.tsx`**: `rateio.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })` forca formatacao completa a cada tecla.
- **`RateioLancamento.tsx` linha ~156**: `formatCurrencyInput` faz o mesmo: `value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })`.

O sistema ja tem a funcao `maskCurrency` em `src/lib/masks.ts` que faz exatamente o que e necessario: formata progressivamente sem forcar casas decimais ate o usuario digitar a virgula.

### Solucao

#### 1. `src/components/rh/RHPagamentos.tsx` (campo valor do rateio, ~linha 1335-1349)

- Trocar o `value` de `rateio.valor.toLocaleString(...)` para usar um estado intermediario de display com `maskCurrency`.
- Criar um estado `rateioDisplayValues` (objeto `Record<string, string>`) para armazenar o texto digitado de cada rateio.
- No `onChange`: aplicar `maskCurrency` ao input, guardar no display, e converter com `parseCurrency` para o valor numerico.
- No `value`: usar `rateioDisplayValues[rateio.id]` em vez de formatar do numero.
- Inicializar os display values quando rateios mudam por percentual (recalculo inverso).

#### 2. `src/components/financeiro/RateioLancamento.tsx` (campo valor, ~linha 147-160)

- Mesmo padrao: trocar `formatCurrencyInput(rateio.valor)` por estado de display com `maskCurrency`.
- Aplicar `maskCurrency` no onChange e `parseCurrency` para converter.

#### 3. Campo de percentual (ambos os arquivos)

- O campo de percentual tem problema similar mas menor. Aplicar a mesma logica com display intermediario para consistencia.

### Detalhes Tecnicos

**Estado novo em `RHPagamentos.tsx`:**
```
const [rateioDisplayValues, setRateioDisplayValues] = useState<Record<string, string>>({});
```

**Campo valor refatorado:**
- `value={rateioDisplayValues[rateio.id] ?? (rateio.valor > 0 ? maskCurrency(rateio.valor.toLocaleString(...)) : '')}`
- `onChange`: aplica `maskCurrency`, salva display, converte com `parseCurrency`, atualiza rateio numerico.

**Quando percentual muda e recalcula valor:** atualizar tambem o display value correspondente usando `maskCurrency` do valor calculado.

### Arquivos a Modificar

1. `src/components/rh/RHPagamentos.tsx` — campo valor e percentual do rateio
2. `src/components/financeiro/RateioLancamento.tsx` — campo valor e percentual do rateio

