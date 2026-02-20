
-- Adicionar colunas de abatimento à tabela parceiros_pagamentos
ALTER TABLE public.parceiros_pagamentos 
  ADD COLUMN IF NOT EXISTS valor_bruto numeric,
  ADD COLUMN IF NOT EXISTS valor_abatimentos numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS descricao_abatimentos text,
  ADD COLUMN IF NOT EXISTS valor_liquido numeric,
  ADD COLUMN IF NOT EXISTS data_pagamento date;

-- Atualizar função de sincronização para usar valor_liquido
CREATE OR REPLACE FUNCTION public.sync_parceiro_pagamento_to_financeiro()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_categoria_id UUID;
  v_parceiro_nome TEXT;
  v_lancamento_id UUID;
  v_valor_efetivo NUMERIC;
BEGIN
  -- Buscar nome do parceiro
  SELECT nome_completo INTO v_parceiro_nome FROM public.parceiros WHERE id = NEW.parceiro_id;
  
  -- Usar valor_liquido se disponível, senão usar valor
  v_valor_efetivo := COALESCE(NEW.valor_liquido, NEW.valor);
  
  -- Buscar ou criar categoria de parceiros
  IF NEW.tipo = 'receber' THEN
    SELECT id INTO v_categoria_id FROM fin_categorias WHERE nome ILIKE '%parceiro%' AND tipo = 'receita' LIMIT 1;
    IF v_categoria_id IS NULL THEN
      INSERT INTO fin_categorias (nome, tipo, grupo, cor, ativa)
      VALUES ('Comissões de Parceiros (Receber)', 'receita', 'Receitas', '#22c55e', true)
      RETURNING id INTO v_categoria_id;
    END IF;
  ELSE
    SELECT id INTO v_categoria_id FROM fin_categorias WHERE nome ILIKE '%parceiro%' AND tipo = 'despesa' LIMIT 1;
    IF v_categoria_id IS NULL THEN
      INSERT INTO fin_categorias (nome, tipo, grupo, cor, ativa)
      VALUES ('Comissões de Parceiros (Pagar)', 'despesa', 'Despesas Operacionais', '#ef4444', true)
      RETURNING id INTO v_categoria_id;
    END IF;
  END IF;

  -- Lógica para UPDATE (marcando como pago ou editando valor)
  IF TG_OP = 'UPDATE' THEN
    -- Se já tem lançamento vinculado, atualizar
    IF NEW.lancamento_financeiro_id IS NOT NULL THEN
      UPDATE fin_lancamentos SET
        valor = v_valor_efetivo,
        data_vencimento = NEW.data_vencimento,
        data_pagamento = NEW.data_pagamento,
        status = NEW.status,
        observacao = COALESCE(NEW.descricao_abatimentos, observacao),
        updated_at = NOW()
      WHERE id = NEW.lancamento_financeiro_id;
    END IF;
    RETURN NEW;
  END IF;

  -- Lógica para INSERT
  IF NEW.lancamento_financeiro_id IS NOT NULL THEN
    UPDATE fin_lancamentos SET
      valor = v_valor_efetivo,
      data_vencimento = NEW.data_vencimento,
      data_pagamento = NEW.data_pagamento,
      status = NEW.status,
      updated_at = NOW()
    WHERE id = NEW.lancamento_financeiro_id;
  ELSE
    -- Criar novo lançamento
    INSERT INTO fin_lancamentos (
      tipo,
      categoria_id,
      valor,
      descricao,
      data_vencimento,
      data_pagamento,
      origem,
      status,
      observacao,
      created_by
    ) VALUES (
      CASE WHEN NEW.tipo = 'receber' THEN 'receita' ELSE 'despesa' END,
      v_categoria_id,
      v_valor_efetivo,
      'Comissão Parceiro: ' || v_parceiro_nome || 
        CASE WHEN NEW.total_parcelas > 1 THEN ' (' || NEW.parcela_atual || '/' || NEW.total_parcelas || ')' ELSE '' END,
      NEW.data_vencimento,
      NEW.data_pagamento,
      'cliente',
      NEW.status,
      COALESCE(NEW.descricao_abatimentos, NEW.observacoes),
      NEW.created_by
    )
    RETURNING id INTO v_lancamento_id;
    
    -- Vincular ao pagamento do parceiro
    NEW.lancamento_financeiro_id := v_lancamento_id;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Criar trigger de sincronização reversa: financeiro → parceiros
CREATE OR REPLACE FUNCTION public.sync_financeiro_to_parceiro_pagamento()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Apenas quando status muda para 'pago'
  IF NEW.status = 'pago' AND (OLD.status IS DISTINCT FROM NEW.status) THEN
    -- Atualizar parceiro_pagamento correspondente
    UPDATE public.parceiros_pagamentos
    SET 
      status = 'pago',
      data_pagamento = COALESCE(NEW.data_pagamento, CURRENT_DATE),
      updated_at = NOW()
    WHERE lancamento_financeiro_id = NEW.id
      AND status != 'pago';
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Dropar trigger existente se existir e recriar
DROP TRIGGER IF EXISTS trigger_sync_financeiro_to_parceiro ON public.fin_lancamentos;

CREATE TRIGGER trigger_sync_financeiro_to_parceiro
  AFTER UPDATE ON public.fin_lancamentos
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_financeiro_to_parceiro_pagamento();

-- Verificar/criar trigger da função existente em parceiros_pagamentos (INSERT e UPDATE)
DROP TRIGGER IF EXISTS trigger_sync_parceiro_pagamento ON public.parceiros_pagamentos;

CREATE TRIGGER trigger_sync_parceiro_pagamento
  BEFORE INSERT OR UPDATE ON public.parceiros_pagamentos
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_parceiro_pagamento_to_financeiro();
