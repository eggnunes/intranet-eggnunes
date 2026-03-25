-- Mark Fechamento stage as won
UPDATE crm_deal_stages SET is_won = true WHERE LOWER(name) = 'fechamento';

-- Fix all deals in won stages: set won=true and populate closed_at
UPDATE crm_deals 
SET won = true, 
    closed_at = COALESCE(closed_at, stage_changed_at, updated_at, created_at, NOW())
WHERE stage_id IN (SELECT id FROM crm_deal_stages WHERE is_won = true)
  AND (won = false OR closed_at IS NULL);