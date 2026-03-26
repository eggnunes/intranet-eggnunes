

## Corrigir busca de código JusBrasil — emails novos não aparecem

### Problema
A função usa `$search="jusbrasil"` na Microsoft Graph API. O parâmetro `$search` depende do **índice de busca do Microsoft 365**, que tem um atraso de indexação (pode levar minutos a horas). Emails recém-chegados não aparecem nos resultados de busca, fazendo a função retornar sempre o mesmo código antigo.

### Solução
Trocar `$search` por `$filter` com data recente + `$orderby=receivedDateTime desc`. Isso consulta os emails diretamente (sem depender do índice de busca), garantindo que emails novos apareçam imediatamente.

### Alterações

**Arquivo:** `supabase/functions/fetch-jusbrasil-code/index.ts`

1. **Remover `$search`** e usar `$filter` com janela de 24 horas + `$orderby=receivedDateTime desc`
2. **Buscar mais emails** (`$top=50`) para compensar a filtragem que será feita em código (já que não podemos filtrar por remetente no `$filter`)
3. **Remover o sort manual** em JS (já vem ordenado pela API)
4. **Remover header `ConsistencyLevel: eventual`** (necessário apenas para `$search`)

Lógica da query:
```
$filter=receivedDateTime ge {24h atrás}
$orderby=receivedDateTime desc
$top=50
$select=subject,body,receivedDateTime,from
```

A filtragem por remetente "jusbrasil" continua sendo feita no `extractCodes()` (já implementada).

### Resultado
- Emails recém-chegados aparecem imediatamente na busca
- O código mais recente do JusBrasil será retornado corretamente
- Sem dependência do índice de busca do Microsoft 365

