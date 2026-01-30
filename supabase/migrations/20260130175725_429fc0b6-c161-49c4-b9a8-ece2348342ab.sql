-- Corrigir a função sync_pagamento_to_profile que usa coluna errada 'motivo' ao invés de 'observacao'
CREATE OR REPLACE FUNCTION public.sync_pagamento_to_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Atualizar salário no perfil baseado no último pagamento
  UPDATE profiles SET
    salario = NEW.total_liquido,
    updated_at = NOW()
  WHERE id = NEW.colaborador_id;
  
  -- Registrar no histórico se valor mudou
  INSERT INTO rh_historico_salario (
    colaborador_id,
    salario_anterior,
    salario_novo,
    observacao
  )
  SELECT 
    NEW.colaborador_id,
    COALESCE((SELECT salario FROM profiles WHERE id = NEW.colaborador_id), 0),
    NEW.total_liquido,
    'Atualização automática via pagamento ' || TO_CHAR(NEW.mes_referencia, 'TMMONTH/YYYY')
  WHERE NOT EXISTS (
    SELECT 1 FROM rh_historico_salario 
    WHERE colaborador_id = NEW.colaborador_id 
    AND salario_novo = NEW.total_liquido
    AND created_at > NOW() - INTERVAL '1 day'
  );
  
  RETURN NEW;
END;
$function$;