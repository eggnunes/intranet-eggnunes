## ✅ Preencher nome do cliente nas movimentações do DataJud

Corrigido em `supabase/functions/sync-pje-publicacoes/index.ts`:
- Antes do upsert, busca nomes dos clientes no AdvBox e preenche `destinatario`
- Após o upsert, corrige retroativamente registros DataJud existentes sem nome
