
-- Desabilitar trigger de auditoria temporariamente
ALTER TABLE fin_lancamentos DISABLE TRIGGER fin_lancamentos_audit;

-- Limpar lançamentos do ADVBox
DELETE FROM advbox_financial_sync;
DELETE FROM fin_lancamentos WHERE origem = 'advbox';

-- Resetar status de sincronização
UPDATE advbox_sync_status 
SET status = 'idle', 
    last_offset = 0, 
    total_processed = 0, 
    total_created = 0, 
    total_updated = 0, 
    total_skipped = 0,
    error_message = null,
    completed_at = null
WHERE sync_type = 'financial';

-- Reabilitar trigger
ALTER TABLE fin_lancamentos ENABLE TRIGGER fin_lancamentos_audit;
