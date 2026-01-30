-- Inserir as 3 novas rubricas para Assistente Comercial
INSERT INTO rh_rubricas (nome, tipo, ordem, descricao, is_active)
VALUES 
  ('Repouso Remunerado', 'vantagem', 16, 'DSR sobre comissões para assistentes comerciais', true),
  ('Prêmio Comissão', 'vantagem', 17, 'Premiação adicional sobre comissões', true),
  ('DSR s/prêmio', 'vantagem', 18, 'Descanso semanal remunerado sobre prêmio', true)
ON CONFLICT DO NOTHING;