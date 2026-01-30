-- Limpar TODOS os dados do ADVBox para reimportar com IDs corretos
-- Ordem correta: primeiro advbox_financial_sync, depois fin_lancamentos

-- 1. Desabilitar trigger de auditoria temporariamente
ALTER TABLE fin_lancamentos DISABLE TRIGGER fin_lancamentos_audit;

-- 2. PRIMEIRO limpar tabela de sincronização (tem FK para fin_lancamentos)
DELETE FROM advbox_financial_sync;

-- 3. DEPOIS deletar todos os lançamentos vindos do ADVBox
DELETE FROM fin_lancamentos WHERE origem = 'advbox';

-- 4. Resetar status da sincronização para começar do zero
UPDATE advbox_sync_status 
SET 
  status = 'idle',
  last_offset = 0,
  total_processed = 0,
  total_created = 0,
  total_updated = 0,
  total_skipped = 0,
  completed_at = NULL,
  started_at = NULL,
  error_message = NULL,
  updated_at = NOW()
WHERE sync_type = 'financial';

-- 5. Reabilitar trigger de auditoria
ALTER TABLE fin_lancamentos ENABLE TRIGGER fin_lancamentos_audit;