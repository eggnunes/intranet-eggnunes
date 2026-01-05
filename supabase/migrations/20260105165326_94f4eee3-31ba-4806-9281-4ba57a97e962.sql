
-- Atualizar subcategorias existentes com nomes mais específicos
UPDATE fin_subcategorias 
SET nome = 'Bonificação por Cumprimento de Metas' 
WHERE id = '2581d0ed-010e-493e-9159-18ce63d9f1b2';

UPDATE fin_subcategorias 
SET nome = 'Distribuição de Lucro' 
WHERE id = '833a123e-fdd8-492b-ba23-bfa79e703aa8';

UPDATE fin_subcategorias 
SET nome = 'Antecipação de Lucro' 
WHERE id = '0fd0fca3-ae06-4f44-a6de-2d386fd2255e';

UPDATE fin_subcategorias 
SET nome = 'Honorários Mensais' 
WHERE id = '52277859-b2a5-45d1-9953-2816ffb9cf50';

-- Adicionar subcategorias novas
INSERT INTO fin_subcategorias (nome, categoria_id) VALUES
  ('Gratificação Anual', '28fb381c-87e8-474b-b036-f9b71f23b46d'),
  ('Distribuição de Lucro Trimestral', '28fb381c-87e8-474b-b036-f9b71f23b46d'),
  ('Reembolso', '28fb381c-87e8-474b-b036-f9b71f23b46d'),
  ('Férias', '28fb381c-87e8-474b-b036-f9b71f23b46d'),
  ('Comissão', '28fb381c-87e8-474b-b036-f9b71f23b46d'),
  ('Comissão de Indicação de Clientes', '28fb381c-87e8-474b-b036-f9b71f23b46d'),
  ('Pró-Labore', '28fb381c-87e8-474b-b036-f9b71f23b46d');

-- Criar mapeamento entre rubricas de RH e subcategorias financeiras
CREATE TABLE IF NOT EXISTS public.rh_rubrica_subcategoria_mapping (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  rubrica_nome TEXT NOT NULL UNIQUE,
  subcategoria_id UUID REFERENCES fin_subcategorias(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.rh_rubrica_subcategoria_mapping ENABLE ROW LEVEL SECURITY;

-- Política para admins e sócios (usando position)
CREATE POLICY "Admins podem gerenciar mapeamento rubricas" 
ON public.rh_rubrica_subcategoria_mapping 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
    AND (position = 'socio' OR email = 'rafael@eggnunes.com.br')
  )
);

CREATE POLICY "Usuários autenticados podem ler mapeamento" 
ON public.rh_rubrica_subcategoria_mapping 
FOR SELECT 
USING (auth.uid() IS NOT NULL);

-- Função de sincronização do pagamento com financeiro rateado
CREATE OR REPLACE FUNCTION public.sync_pagamento_to_financeiro_rateado()
RETURNS TRIGGER AS $$
DECLARE
  v_categoria_id UUID;
  v_setor_id UUID;
  v_colaborador_nome TEXT;
  v_item RECORD;
  v_subcategoria_id UUID;
  v_mes_formatado TEXT;
BEGIN
  -- Só sincronizar quando recibo foi gerado
  IF (NEW.recibo_gerado = TRUE AND (OLD IS NULL OR OLD.recibo_gerado = FALSE)) THEN
    
    -- Verificar se já existe lançamento para este pagamento
    IF EXISTS (
      SELECT 1 FROM fin_lancamentos 
      WHERE observacao LIKE '%[RH-PAG:' || NEW.id || ']%'
    ) THEN
      RETURN NEW;
    END IF;
    
    SELECT id INTO v_categoria_id 
    FROM fin_categorias 
    WHERE nome = 'Pessoal e Folha de Pagamento' 
    LIMIT 1;
    
    SELECT id INTO v_setor_id 
    FROM fin_setores 
    WHERE nome ILIKE '%recursos humanos%' OR nome ILIKE '%rh%' 
    LIMIT 1;
    
    IF v_setor_id IS NULL THEN
      INSERT INTO fin_setores (nome) VALUES ('Recursos Humanos')
      RETURNING id INTO v_setor_id;
    END IF;
    
    SELECT full_name INTO v_colaborador_nome
    FROM profiles 
    WHERE id = NEW.colaborador_id;
    
    v_mes_formatado := TO_CHAR(NEW.mes_referencia::DATE, 'MM/YYYY');
    
    FOR v_item IN 
      SELECT pi.*, r.nome as rubrica_nome, r.tipo as rubrica_tipo
      FROM rh_pagamento_itens pi
      JOIN rh_rubricas r ON r.id = pi.rubrica_id
      WHERE pi.pagamento_id = NEW.id AND pi.valor > 0
    LOOP
      SELECT m.subcategoria_id INTO v_subcategoria_id
      FROM rh_rubrica_subcategoria_mapping m
      WHERE m.rubrica_nome = v_item.rubrica_nome;
      
      IF v_subcategoria_id IS NULL THEN
        SELECT s.id INTO v_subcategoria_id
        FROM fin_subcategorias s
        WHERE s.categoria_id = v_categoria_id
          AND (
            LOWER(s.nome) LIKE '%' || LOWER(v_item.rubrica_nome) || '%'
            OR LOWER(v_item.rubrica_nome) LIKE '%' || LOWER(s.nome) || '%'
          )
        LIMIT 1;
      END IF;
      
      IF v_item.rubrica_tipo = 'vantagem' THEN
        INSERT INTO fin_lancamentos (
          tipo, origem, categoria_id, subcategoria_id, valor,
          data_vencimento, data_pagamento, status, descricao, observacao, setor_id, created_by
        ) VALUES (
          'despesa', 'escritorio', v_categoria_id, v_subcategoria_id, v_item.valor,
          COALESCE(NEW.data_pagamento, NEW.mes_referencia)::DATE,
          NEW.data_pagamento::DATE,
          'pago',
          v_item.rubrica_nome || ' - ' || v_colaborador_nome || ' (' || v_mes_formatado || ')',
          '[RH-PAG:' || NEW.id || '] Pagamento automático gerado pelo sistema de RH',
          v_setor_id, NEW.created_by
        );
      END IF;
    END LOOP;
    
    INSERT INTO integration_sync_log (source_module, target_module, action, entity_id, entity_type, details)
    VALUES ('rh_pagamentos', 'fin_lancamentos', 'create', NEW.id::TEXT, 'pagamento_rateado',
      jsonb_build_object('colaborador', v_colaborador_nome, 'mes_referencia', v_mes_formatado, 'total_liquido', NEW.total_liquido)
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trigger_sync_pagamento_to_financeiro ON rh_pagamentos;
DROP TRIGGER IF EXISTS trigger_sync_pagamento_to_profile ON rh_pagamentos;
DROP TRIGGER IF EXISTS trigger_sync_pagamento_rateado ON rh_pagamentos;

CREATE TRIGGER trigger_sync_pagamento_rateado
AFTER UPDATE ON rh_pagamentos
FOR EACH ROW
EXECUTE FUNCTION sync_pagamento_to_financeiro_rateado();
