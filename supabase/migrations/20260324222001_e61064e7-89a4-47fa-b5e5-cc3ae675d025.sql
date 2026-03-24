
-- 1. Optimize audit_trigger_fn to store only diffs on UPDATE
CREATE OR REPLACE FUNCTION public.audit_trigger_fn()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_usuario_nome TEXT;
  v_acao TEXT;
  v_descricao TEXT;
  v_usuario_id UUID;
  v_dados_anteriores JSONB;
  v_dados_novos JSONB;
  v_old_json JSONB;
  v_new_json JSONB;
  v_key TEXT;
  v_ignored_keys TEXT[] := ARRAY['updated_at', 'created_at'];
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_acao := 'criar';
    v_descricao := 'Registro criado em ' || TG_TABLE_NAME;
    v_dados_anteriores := NULL;
    v_dados_novos := to_jsonb(NEW);
  ELSIF TG_OP = 'UPDATE' THEN
    v_acao := 'editar';
    v_descricao := 'Registro atualizado em ' || TG_TABLE_NAME;
    -- Calculate diff: only changed fields
    v_old_json := to_jsonb(OLD);
    v_new_json := to_jsonb(NEW);
    v_dados_anteriores := '{}'::jsonb;
    v_dados_novos := '{}'::jsonb;
    FOR v_key IN SELECT jsonb_object_keys(v_new_json)
    LOOP
      IF NOT (v_key = ANY(v_ignored_keys)) AND (v_old_json->v_key IS DISTINCT FROM v_new_json->v_key) THEN
        v_dados_anteriores := v_dados_anteriores || jsonb_build_object(v_key, v_old_json->v_key);
        v_dados_novos := v_dados_novos || jsonb_build_object(v_key, v_new_json->v_key);
      END IF;
    END LOOP;
    -- Skip if nothing actually changed
    IF v_dados_novos = '{}'::jsonb THEN
      RETURN NEW;
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    v_acao := 'excluir';
    v_descricao := 'Registro excluído de ' || TG_TABLE_NAME;
    v_dados_anteriores := to_jsonb(OLD);
    v_dados_novos := NULL;
  END IF;

  IF TG_OP = 'DELETE' THEN
    v_usuario_id := auth.uid();
  ELSE
    BEGIN
      v_usuario_id := COALESCE(NEW.created_by, NEW.user_id, auth.uid());
    EXCEPTION WHEN undefined_column THEN
      v_usuario_id := auth.uid();
    END;
  END IF;

  SELECT full_name INTO v_usuario_nome FROM public.profiles WHERE id = v_usuario_id;

  INSERT INTO public.audit_log (tabela, registro_id, acao, descricao, dados_anteriores, dados_novos, usuario_id, usuario_nome)
  VALUES (
    TG_TABLE_NAME,
    CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NEW.id END,
    v_acao, v_descricao, v_dados_anteriores, v_dados_novos, v_usuario_id,
    COALESCE(v_usuario_nome, 'Sistema')
  );

  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$function$;

-- 2. Optimize fin_audit_trigger to store only diffs on UPDATE
CREATE OR REPLACE FUNCTION public.fin_audit_trigger()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_dados_anteriores JSONB;
  v_dados_novos JSONB;
  v_old_json JSONB;
  v_new_json JSONB;
  v_key TEXT;
  v_ignored_keys TEXT[] := ARRAY['updated_at', 'created_at'];
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.fin_auditoria (tabela, registro_id, acao, dados_novos, usuario_id)
    VALUES (TG_TABLE_NAME, NEW.id, 'criar', to_jsonb(NEW), COALESCE(NEW.created_by, auth.uid()));
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    v_old_json := to_jsonb(OLD);
    v_new_json := to_jsonb(NEW);
    v_dados_anteriores := '{}'::jsonb;
    v_dados_novos := '{}'::jsonb;
    FOR v_key IN SELECT jsonb_object_keys(v_new_json)
    LOOP
      IF NOT (v_key = ANY(v_ignored_keys)) AND (v_old_json->v_key IS DISTINCT FROM v_new_json->v_key) THEN
        v_dados_anteriores := v_dados_anteriores || jsonb_build_object(v_key, v_old_json->v_key);
        v_dados_novos := v_dados_novos || jsonb_build_object(v_key, v_new_json->v_key);
      END IF;
    END LOOP;
    IF v_dados_novos = '{}'::jsonb THEN
      NEW.updated_at = NOW();
      RETURN NEW;
    END IF;
    INSERT INTO public.fin_auditoria (tabela, registro_id, acao, dados_anteriores, dados_novos, usuario_id)
    VALUES (TG_TABLE_NAME, NEW.id, 'editar', v_dados_anteriores, v_dados_novos, COALESCE(NEW.updated_by, auth.uid()));
    NEW.updated_at = NOW();
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.fin_auditoria (tabela, registro_id, acao, dados_anteriores, usuario_id)
    VALUES (TG_TABLE_NAME, OLD.id, 'deletar', to_jsonb(OLD), auth.uid());
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$function$;

-- 3. Remove audit triggers from CRM tables
DROP TRIGGER IF EXISTS audit_crm_contacts ON public.crm_contacts;
DROP TRIGGER IF EXISTS audit_crm_deals ON public.crm_deals;

-- 4. Enable pg_cron and pg_net extensions
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
