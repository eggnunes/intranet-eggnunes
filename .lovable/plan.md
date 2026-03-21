
## Preencher nome do cliente nas movimentações do DataJud

### Problema
O `destinatario` das publicações DataJud é sempre inserido vazio (`''`) na linha 191 do edge function. O enriquecimento com nomes de clientes do AdvBox (linhas ~320-370) só roda para registros do ComunicaPJe — nunca para DataJud. Resultado: 104 registros DataJud sem nome de cliente, apesar de os dados existirem no AdvBox.

### Solução
Alterar `supabase/functions/sync-pje-publicacoes/index.ts`:

1. **Antes de inserir os registros DataJud** (entre linhas 205-210), buscar os nomes dos clientes do `advbox_tasks` para todos os números de processo únicos e preencher `destinatario` diretamente nos objetos `toInsert` — em vez de inserir vazio e tentar enriquecer depois.

2. **Também corrigir os 104 registros existentes** sem cliente: após o upsert do DataJud, rodar um UPDATE nos registros DataJud que têm `destinatario` vazio, cruzando com `advbox_tasks.raw_data->lawsuit->customers`.

### Lógica concreta
```
- Coletar todos os process_numbers dos toInsert
- SELECT process_number, raw_data->'lawsuit'->'customers' FROM advbox_tasks WHERE process_number IN (...)
- Montar mapa: process_number → nomes dos clientes (joined por ", ")
- Antes do upsert, preencher toInsert[i].destinatario = clienteMap[numero_processo]
- Após upsert, UPDATE publicacoes_dje SET destinatario = ... WHERE meio = 'DataJud' AND destinatario IN ('', NULL)
```

### Arquivo alterado
- `supabase/functions/sync-pje-publicacoes/index.ts`
