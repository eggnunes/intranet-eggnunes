-- Tabela para controlar quais clientes já foram sincronizados do Google Sheets para o ADVBox
CREATE TABLE IF NOT EXISTS public.sheets_advbox_sync (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cpf VARCHAR(11) NOT NULL UNIQUE,
  advbox_customer_id VARCHAR(50) NOT NULL,
  client_name VARCHAR(255) NOT NULL,
  sheet_row_id INTEGER,
  synced_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Índices para busca rápida
CREATE INDEX IF NOT EXISTS idx_sheets_advbox_sync_cpf ON public.sheets_advbox_sync(cpf);
CREATE INDEX IF NOT EXISTS idx_sheets_advbox_sync_advbox_id ON public.sheets_advbox_sync(advbox_customer_id);

-- Não é necessário RLS pois é tabela de controle interno
-- Apenas service_role terá acesso

COMMENT ON TABLE public.sheets_advbox_sync IS 'Controla sincronização de clientes do Google Sheets para ADVBox';

-- Habilitar pg_cron e pg_net se não estiverem habilitados
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;