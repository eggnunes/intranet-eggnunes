

## Buscar todos os andamentos + Normalizar títulos genéricos

### Problemas identificados

1. **Poucos andamentos (56)**: A página de Tradução lê apenas do `localStorage` (`advbox-movements-full-cache`). Se o cache estiver incompleto ou desatualizado, mostra poucos itens. Precisa buscar diretamente da API do ADVBox quando o cache não tem dados suficientes.

2. **Títulos com detalhes específicos**: Andamentos como "Audiência de conciliação designada para 15/03/2026 às 14h" devem ser normalizados para apenas "Audiência de conciliação designada" — removendo datas, horários, nomes de partes, valores, etc.

### Alterações

#### 1. `src/pages/TraducaoAndamentos.tsx`

**Buscar dados diretamente da API (não apenas cache)**:
- Ao carregar, primeiro tenta o localStorage
- Se tiver poucos resultados (< 100), chama `supabase.functions.invoke('advbox-integration/movements-full')` para buscar todos
- Atualiza o cache local após buscar

**Normalizar títulos** — função `normalizeTitle(title)`:
- Remove datas (`15/03/2026`, `15.03.2026`, `março de 2026`)
- Remove horários (`às 14h`, `14:00`, `14h30`)
- Remove números de processo (`0000000-00.0000.0.00.0000`)
- Remove valores monetários (`R$ 1.000,00`)
- Remove nomes próprios após preposições (`para o(a) Sr(a). João da Silva`)
- Remove textos entre parênteses que contenham datas/nomes específicos
- Faz trim e remove espaços/pontuação duplicados no final
- Exemplo: `"Audiência de conciliação designada para o dia 15/03/2026"` → `"Audiência de conciliação designada"`

**Deduplicar após normalização**: Agrupar títulos normalizados com `new Set()`, gerando a lista final sem repetições

#### 2. `supabase/functions/translate-movement/index.ts`

**Atualizar prompt da IA** para instruir:
- "Não inclua datas, nomes de partes, valores ou qualquer informação específica de um caso na tradução"
- "A tradução deve ser genérica e servir para qualquer cliente/processo"
- Exemplo no prompt: "Audiência de conciliação designada" → tradução genérica

### Arquivos modificados
- `src/pages/TraducaoAndamentos.tsx` — busca via API + normalização de títulos
- `supabase/functions/translate-movement/index.ts` — prompt atualizado

### Resultado
- Todos os andamentos do ADVBox são buscados (não depende de cache local incompleto)
- Títulos normalizados sem datas, nomes, valores — genéricos para qualquer cliente
- IA gera traduções genéricas que servem para todos os processos

