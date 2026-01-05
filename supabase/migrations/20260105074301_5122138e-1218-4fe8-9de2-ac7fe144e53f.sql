
-- =====================================================
-- INTEGRAÇÃO AUTOMÁTICA ENTRE MÓDULOS DA INTRANET
-- =====================================================

-- 1. Quando um pagamento RH é processado, criar lançamento financeiro automaticamente
CREATE OR REPLACE FUNCTION public.sync_rh_pagamento_to_financeiro()
RETURNS TRIGGER AS $$
DECLARE
  v_categoria_id UUID;
  v_setor_rh_id UUID;
  v_conta_id UUID;
  v_lancamento_id UUID;
  v_colaborador_nome TEXT;
BEGIN
  -- Apenas quando status muda para 'processado' ou 'pago'
  IF NEW.status IN ('processado', 'pago') AND (OLD IS NULL OR OLD.status != NEW.status) THEN
    -- Buscar categoria de "Folha de Pagamento" ou criar
    SELECT id INTO v_categoria_id FROM fin_categorias WHERE nome ILIKE '%folha%' OR nome ILIKE '%pagamento%colaborador%' LIMIT 1;
    IF v_categoria_id IS NULL THEN
      INSERT INTO fin_categorias (nome, tipo, grupo, cor, ativa)
      VALUES ('Folha de Pagamento', 'despesa', 'Pessoal', '#6366f1', true)
      RETURNING id INTO v_categoria_id;
    END IF;
    
    -- Buscar setor de RH ou criar
    SELECT id INTO v_setor_rh_id FROM fin_setores WHERE nome ILIKE '%rh%' OR nome ILIKE '%recursos%' LIMIT 1;
    IF v_setor_rh_id IS NULL THEN
      INSERT INTO fin_setores (nome, ativo)
      VALUES ('Recursos Humanos', true)
      RETURNING id INTO v_setor_rh_id;
    END IF;
    
    -- Buscar conta padrão (primeira ativa)
    SELECT id INTO v_conta_id FROM fin_contas WHERE ativa = true ORDER BY created_at LIMIT 1;
    
    -- Buscar nome do colaborador
    SELECT full_name INTO v_colaborador_nome FROM profiles WHERE id = NEW.colaborador_id;
    
    -- Se já tem lançamento vinculado, atualizar; senão, criar
    IF NEW.lancamento_financeiro_id IS NOT NULL THEN
      UPDATE fin_lancamentos SET
        valor = NEW.total_liquido,
        data_pagamento = NEW.data_pagamento,
        status = CASE WHEN NEW.data_pagamento IS NOT NULL THEN 'pago' ELSE 'pendente' END,
        updated_at = NOW()
      WHERE id = NEW.lancamento_financeiro_id;
    ELSE
      -- Criar lançamento financeiro
      INSERT INTO fin_lancamentos (
        tipo,
        categoria_id,
        setor_id,
        conta_origem_id,
        valor,
        descricao,
        data_lancamento,
        data_pagamento,
        origem,
        status,
        created_by
      ) VALUES (
        'despesa',
        v_categoria_id,
        v_setor_rh_id,
        v_conta_id,
        NEW.total_liquido,
        'Pagamento ' || TO_CHAR(NEW.mes_referencia, 'TMMONTH/YYYY') || ' - ' || COALESCE(v_colaborador_nome, 'Colaborador'),
        NEW.mes_referencia,
        NEW.data_pagamento,
        'escritorio',
        CASE WHEN NEW.data_pagamento IS NOT NULL THEN 'pago' ELSE 'pendente' END,
        NEW.created_by
      )
      RETURNING id INTO v_lancamento_id;
      
      -- Vincular ao pagamento
      UPDATE rh_pagamentos SET lancamento_financeiro_id = v_lancamento_id WHERE id = NEW.id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger para sincronizar pagamentos RH com financeiro
DROP TRIGGER IF EXISTS sync_rh_pagamento_to_financeiro_trigger ON rh_pagamentos;
CREATE TRIGGER sync_rh_pagamento_to_financeiro_trigger
  AFTER INSERT OR UPDATE ON rh_pagamentos
  FOR EACH ROW
  EXECUTE FUNCTION sync_rh_pagamento_to_financeiro();


-- 2. Quando um contrato é criado/atualizado, criar receita no financeiro
CREATE OR REPLACE FUNCTION public.sync_contrato_to_financeiro()
RETURNS TRIGGER AS $$
DECLARE
  v_categoria_id UUID;
  v_conta_id UUID;
  v_cliente_id UUID;
  v_lancamento_id UUID;
BEGIN
  -- Apenas quando status é 'ativo' e tem valor
  IF NEW.status = 'ativo' AND NEW.valor_total IS NOT NULL AND NEW.valor_total > 0 THEN
    
    -- Buscar ou criar categoria de "Honorários"
    SELECT id INTO v_categoria_id FROM fin_categorias WHERE nome ILIKE '%honorário%' OR nome ILIKE '%contrato%' LIMIT 1;
    IF v_categoria_id IS NULL THEN
      INSERT INTO fin_categorias (nome, tipo, grupo, cor, ativa)
      VALUES ('Honorários Advocatícios', 'receita', 'Receitas', '#22c55e', true)
      RETURNING id INTO v_categoria_id;
    END IF;
    
    -- Buscar conta padrão
    SELECT id INTO v_conta_id FROM fin_contas WHERE ativa = true ORDER BY created_at LIMIT 1;
    
    -- Buscar ou criar cliente no financeiro
    SELECT id INTO v_cliente_id FROM fin_clientes WHERE nome ILIKE NEW.client_name LIMIT 1;
    IF v_cliente_id IS NULL THEN
      INSERT INTO fin_clientes (nome, cpf_cnpj, email, telefone, ativo)
      VALUES (NEW.client_name, NEW.client_cpf, NEW.client_email, NEW.client_phone, true)
      RETURNING id INTO v_cliente_id;
    END IF;
    
    -- Verificar se já existe lançamento para este contrato
    SELECT id INTO v_lancamento_id FROM fin_lancamentos 
    WHERE descricao ILIKE '%' || NEW.id::TEXT || '%' AND tipo = 'receita' LIMIT 1;
    
    IF v_lancamento_id IS NULL AND (OLD IS NULL OR OLD.status != 'ativo') THEN
      -- Criar receita
      INSERT INTO fin_lancamentos (
        tipo,
        categoria_id,
        cliente_id,
        conta_origem_id,
        valor,
        descricao,
        data_lancamento,
        origem,
        status,
        produto_rd_station,
        created_by
      ) VALUES (
        'receita',
        v_categoria_id,
        v_cliente_id,
        v_conta_id,
        NEW.valor_total,
        'Contrato: ' || NEW.product_name || ' - ' || NEW.client_name || ' [' || NEW.id || ']',
        COALESCE(NEW.created_at::date, CURRENT_DATE),
        'cliente',
        'pendente',
        NEW.product_name,
        NEW.created_by
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger para sincronizar contratos com financeiro
DROP TRIGGER IF EXISTS sync_contrato_to_financeiro_trigger ON fin_contratos;
CREATE TRIGGER sync_contrato_to_financeiro_trigger
  AFTER INSERT OR UPDATE ON fin_contratos
  FOR EACH ROW
  EXECUTE FUNCTION sync_contrato_to_financeiro();


-- 3. Quando um deal CRM é ganho, criar contrato e receita
CREATE OR REPLACE FUNCTION public.sync_crm_deal_won()
RETURNS TRIGGER AS $$
DECLARE
  v_contato_nome TEXT;
  v_contato_email TEXT;
  v_contato_phone TEXT;
  v_contrato_exists BOOLEAN;
BEGIN
  -- Apenas quando won muda para true
  IF NEW.won = true AND (OLD IS NULL OR OLD.won IS DISTINCT FROM NEW.won) THEN
    
    -- Buscar dados do contato
    SELECT name, email, phone INTO v_contato_nome, v_contato_email, v_contato_phone
    FROM crm_contacts WHERE id = NEW.contact_id;
    
    -- Verificar se já existe contrato
    SELECT EXISTS(SELECT 1 FROM fin_contratos WHERE 
      client_name = v_contato_nome AND product_name = COALESCE(NEW.product_name, NEW.name)
    ) INTO v_contrato_exists;
    
    IF NOT v_contrato_exists AND v_contato_nome IS NOT NULL THEN
      -- Criar contrato automaticamente
      INSERT INTO fin_contratos (
        client_id,
        client_name,
        client_email,
        client_phone,
        product_name,
        valor_total,
        status,
        created_by
      ) VALUES (
        0, -- client_id placeholder
        v_contato_nome,
        v_contato_email,
        v_contato_phone,
        COALESCE(NEW.product_name, NEW.name),
        NEW.value,
        'ativo',
        NEW.owner_id
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger para sincronizar deals ganhos com contratos
DROP TRIGGER IF EXISTS sync_crm_deal_won_trigger ON crm_deals;
CREATE TRIGGER sync_crm_deal_won_trigger
  AFTER UPDATE ON crm_deals
  FOR EACH ROW
  EXECUTE FUNCTION sync_crm_deal_won();


-- 4. Atualizar perfil quando houver pagamento (último pagamento registrado)
CREATE OR REPLACE FUNCTION public.sync_pagamento_to_profile()
RETURNS TRIGGER AS $$
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
    motivo,
    created_by
  )
  SELECT 
    NEW.colaborador_id,
    COALESCE((SELECT salario FROM profiles WHERE id = NEW.colaborador_id), 0),
    NEW.total_liquido,
    'Atualização automática via pagamento ' || TO_CHAR(NEW.mes_referencia, 'TMMONTH/YYYY'),
    NEW.created_by
  WHERE NOT EXISTS (
    SELECT 1 FROM rh_historico_salario 
    WHERE colaborador_id = NEW.colaborador_id 
    AND salario_novo = NEW.total_liquido
    AND created_at > NOW() - INTERVAL '1 day'
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger para atualizar perfil quando houver pagamento
DROP TRIGGER IF EXISTS sync_pagamento_to_profile_trigger ON rh_pagamentos;
CREATE TRIGGER sync_pagamento_to_profile_trigger
  AFTER INSERT ON rh_pagamentos
  FOR EACH ROW
  WHEN (NEW.status IN ('processado', 'pago'))
  EXECUTE FUNCTION sync_pagamento_to_profile();


-- 5. Criar tabela de log de integrações para auditoria
CREATE TABLE IF NOT EXISTS public.integration_sync_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  source_table TEXT NOT NULL,
  source_id UUID NOT NULL,
  target_table TEXT NOT NULL,
  target_id UUID,
  action TEXT NOT NULL,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS para log de integrações
ALTER TABLE public.integration_sync_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view integration logs" ON integration_sync_log;
CREATE POLICY "Admins can view integration logs"
  ON integration_sync_log FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND (profiles.position = 'socio' OR profiles.email = 'rafael@eggnunes.com.br')
    )
  );


-- 6. Função para registrar log de integração
CREATE OR REPLACE FUNCTION public.log_integration_sync(
  p_source_table TEXT,
  p_source_id UUID,
  p_target_table TEXT,
  p_target_id UUID,
  p_action TEXT,
  p_details JSONB DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_log_id UUID;
BEGIN
  INSERT INTO integration_sync_log (source_table, source_id, target_table, target_id, action, details)
  VALUES (p_source_table, p_source_id, p_target_table, p_target_id, p_action, p_details)
  RETURNING id INTO v_log_id;
  
  RETURN v_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- Notificar sobre atualização
INSERT INTO intranet_updates (title, description, category, created_by)
VALUES (
  'Integração Automática entre Módulos',
  'Agora os módulos da intranet estão completamente integrados! Pagamentos de RH geram lançamentos financeiros automaticamente, contratos ativos criam receitas no financeiro, e negócios ganhos no CRM criam contratos automaticamente. Todas as informações sincronizam com o perfil do colaborador.',
  'feature',
  'd322e9aa-84eb-4b42-960c-7732d8a60bce'
);
