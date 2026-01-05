
-- Adicionar foreign keys que faltaram
ALTER TABLE public.profiles ADD CONSTRAINT fk_profiles_cargo FOREIGN KEY (cargo_id) REFERENCES public.rh_cargos(id) ON DELETE SET NULL;

ALTER TABLE public.rh_pagamentos ADD CONSTRAINT fk_rh_pagamentos_colaborador FOREIGN KEY (colaborador_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.rh_pagamento_itens ADD CONSTRAINT fk_rh_pagamento_itens_pagamento FOREIGN KEY (pagamento_id) REFERENCES public.rh_pagamentos(id) ON DELETE CASCADE;

ALTER TABLE public.rh_pagamento_itens ADD CONSTRAINT fk_rh_pagamento_itens_rubrica FOREIGN KEY (rubrica_id) REFERENCES public.rh_rubricas(id) ON DELETE CASCADE;

ALTER TABLE public.rh_sugestoes_valores ADD CONSTRAINT fk_rh_sugestoes_colaborador FOREIGN KEY (colaborador_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.rh_sugestoes_valores ADD CONSTRAINT fk_rh_sugestoes_rubrica FOREIGN KEY (rubrica_id) REFERENCES public.rh_rubricas(id) ON DELETE CASCADE;

ALTER TABLE public.rh_pastas_documentos ADD CONSTRAINT fk_rh_pastas_colaborador FOREIGN KEY (colaborador_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.rh_documentos ADD CONSTRAINT fk_rh_documentos_colaborador FOREIGN KEY (colaborador_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.rh_documentos ADD CONSTRAINT fk_rh_documentos_pasta FOREIGN KEY (pasta_id) REFERENCES public.rh_pastas_documentos(id) ON DELETE SET NULL;
