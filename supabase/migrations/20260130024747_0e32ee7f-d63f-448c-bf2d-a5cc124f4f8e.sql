-- Desabilitar trigger de auditoria temporariamente para limpeza
ALTER TABLE fin_lancamentos DISABLE TRIGGER fin_lancamentos_audit;

-- Limpar tabela de backup/sync primeiro (por causa da FK)
DELETE FROM advbox_financial_sync;

-- Agora limpar registros advbox existentes
DELETE FROM fin_lancamentos WHERE origem = 'advbox';

-- Resetar status da sincronização
UPDATE advbox_sync_status 
SET status = 'idle',
    last_offset = 0,
    total_processed = 0,
    total_created = 0,
    total_updated = 0,
    total_skipped = 0,
    error_message = NULL,
    completed_at = NULL,
    started_at = NULL,
    updated_at = NOW()
WHERE sync_type = 'financial';

-- Reabilitar trigger de auditoria
ALTER TABLE fin_lancamentos ENABLE TRIGGER fin_lancamentos_audit;