
-- Tabela para armazenar links de tribunais/sistemas processuais
CREATE TABLE public.tribunal_links (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  url TEXT NOT NULL,
  tribunal TEXT NOT NULL,
  sistema TEXT NOT NULL,
  categoria TEXT DEFAULT 'pje',
  ordem INTEGER DEFAULT 0,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.tribunal_links ENABLE ROW LEVEL SECURITY;

-- Políticas: todos aprovados podem ver, apenas admins podem editar
CREATE POLICY "Usuários aprovados podem ver links ativos"
ON public.tribunal_links
FOR SELECT
USING (is_approved(auth.uid()) AND ativo = true);

CREATE POLICY "Admins podem ver todos os links"
ON public.tribunal_links
FOR SELECT
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins podem criar links"
ON public.tribunal_links
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins podem atualizar links"
ON public.tribunal_links
FOR UPDATE
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins podem deletar links"
ON public.tribunal_links
FOR DELETE
USING (has_role(auth.uid(), 'admin'));

-- Trigger para updated_at
CREATE TRIGGER update_tribunal_links_updated_at
BEFORE UPDATE ON public.tribunal_links
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Inserir todos os links iniciais
INSERT INTO public.tribunal_links (nome, url, tribunal, sistema, categoria, ordem) VALUES
-- TJMG
('PJE TJMG 1º Grau', 'https://pje.tjmg.jus.br/pje/QuadroAviso/listViewQuadroAvisoMensagem.seam', 'TJMG', 'PJE', 'estadual', 1),
('PJE Recursal TJMG', 'https://pjerecursal.tjmg.jus.br/pje/QuadroAviso/listViewQuadroAvisoMensagem.seam', 'TJMG', 'PJE', 'estadual', 2),
('RUPE TJMG', 'https://pe.tjmg.jus.br/rupe/portaljus/intranet/principal.rupe', 'TJMG', 'RUPE', 'estadual', 3),
('E-Proc TJMG 1º Grau', 'https://eproc1g.tjmg.jus.br/eproc/', 'TJMG', 'E-Proc', 'estadual', 4),
('E-Proc TJMG 2º Grau', 'https://eproc2g.tjmg.jus.br/eproc/', 'TJMG', 'E-Proc', 'estadual', 5),

-- TRF1
('PJE TRF1 1º Grau', 'https://pje1g.trf1.jus.br/pje/QuadroAviso/listViewQuadroAvisoMensagem.seam', 'TRF1', 'PJE', 'federal', 10),
('PJE TRF1 2º Grau', 'https://pje2g.trf1.jus.br/pje/QuadroAviso/listViewQuadroAvisoMensagem.seam', 'TRF1', 'PJE', 'federal', 11),

-- TRF3
('PJE TRF3 1º Grau', 'https://pje1g.trf3.jus.br/pje/QuadroAviso/listViewQuadroAvisoMensagem.seam', 'TRF3', 'PJE', 'federal', 12),
('PJE TRF3 2º Grau', 'https://pje2g.trf3.jus.br/pje/QuadroAviso/listViewQuadroAvisoMensagem.seam', 'TRF3', 'PJE', 'federal', 13),

-- TRF5
('PJE TRF5 1º Grau', 'https://pje1g.trf5.jus.br/pje/QuadroAviso/listViewQuadroAvisoMensagem.seam', 'TRF5', 'PJE', 'federal', 14),
('PJE TRF5 2º Grau', 'https://pje2g.trf5.jus.br/pje/QuadroAviso/listViewQuadroAvisoMensagem.seam', 'TRF5', 'PJE', 'federal', 15),

-- TJDFT
('PJE TJDFT', 'https://pje.tjdft.jus.br/pje/QuadroAviso/listViewQuadroAvisoMensagem.seam', 'TJDFT', 'PJE', 'estadual', 20),
('PJE TJDFT 2ª Instância', 'https://pje2i.tjdft.jus.br/pje/QuadroAviso/listViewQuadroAvisoMensagem.seam', 'TJDFT', 'PJE', 'estadual', 21),

-- TJBA
('PJE TJBA', 'https://pje.tjba.jus.br/pje/Painel/painel_usuario/advogado.seam', 'TJBA', 'PJE', 'estadual', 22),
('PJE TJBA 2º Grau', 'https://pje2g.tjba.jus.br/pje/QuadroAviso/listViewQuadroAvisoMensagem.seam', 'TJBA', 'PJE', 'estadual', 23),

-- TJES
('PJE TJES', 'https://pje.tjes.jus.br/pje/QuadroAviso/listViewQuadroAvisoMensagem.seam', 'TJES', 'PJE', 'estadual', 24),

-- TJRJ
('PJE TJRJ 1º Grau', 'https://tjrj.pje.jus.br/1g/QuadroAviso/listViewQuadroAvisoMensagem.seam', 'TJRJ', 'PJE', 'estadual', 25),

-- TJPA
('PJE TJPA', 'https://pje.tjpa.jus.br/pje/Painel/painel_usuario/advogado.seam', 'TJPA', 'PJE', 'estadual', 26),

-- TJRO
('PJE TJRO', 'https://pjepg.tjro.jus.br/pje/QuadroAviso/listViewQuadroAvisoMensagem.seam', 'TJRO', 'PJE', 'estadual', 27),

-- TJPE
('PJE TJPE 1º Grau', 'https://pje.cloud.tjpe.jus.br/1g/home.seam', 'TJPE', 'PJE', 'estadual', 28),

-- TJPI
('PJE TJPI 1º Grau', 'https://pje.tjpi.jus.br/1g/QuadroAviso/listViewQuadroAvisoMensagem.seam', 'TJPI', 'PJE', 'estadual', 29),

-- TJPB
('PJE TJPB', 'https://pje.tjpb.jus.br/pje/QuadroAviso/listViewQuadroAvisoMensagem.seam', 'TJPB', 'PJE', 'estadual', 30),

-- TJMMG (Justiça Militar)
('E-Proc TJMMG 1º Grau', 'https://eproc.tjmmg.jus.br/eproc1g/', 'TJMMG', 'E-Proc', 'militar', 40),
('E-Proc TJMMG 2º Grau', 'https://eproc.tjmmg.jus.br/eproc2g/', 'TJMMG', 'E-Proc', 'militar', 41),

-- TRF6
('E-Proc TRF6 1º Grau', 'https://eproc1g.trf6.jus.br/eproc/', 'TRF6', 'E-Proc', 'federal', 50),
('E-Proc TRF6 2º Grau', 'https://eproc2g.trf6.jus.br/eproc/', 'TRF6', 'E-Proc', 'federal', 51),

-- Justiça Federal (JFES, JFRJ)
('E-Proc JFES', 'https://eproc.jfes.jus.br/eproc/', 'JFES', 'E-Proc', 'federal', 52),
('E-Proc JFRJ', 'https://eproc.jfrj.jus.br/eproc/', 'JFRJ', 'E-Proc', 'federal', 53),

-- TRF2
('E-Proc TRF2', 'https://eproc.trf2.jus.br/eproc/', 'TRF2', 'E-Proc', 'federal', 54),

-- TRF4
('E-Proc TRF4', 'https://eproc.trf4.jus.br/eproc2trf4/', 'TRF4', 'E-Proc', 'federal', 55),

-- Justiça Federal Sul (JFRS, JFSC, JFPR)
('E-Proc JFRS', 'https://eproc.jfrs.jus.br/eprocV2/', 'JFRS', 'E-Proc', 'federal', 56),
('E-Proc JFSC', 'https://eproc.jfsc.jus.br/eprocV2/', 'JFSC', 'E-Proc', 'federal', 57),
('E-Proc JFPR', 'https://eproc.jfpr.jus.br/eprocV2/', 'JFPR', 'E-Proc', 'federal', 58),

-- TJAC
('E-Proc TJAC 1º Grau', 'https://eproc1g.tjac.jus.br/eproc/', 'TJAC', 'E-Proc', 'estadual', 60),

-- TJSC
('E-Proc TJSC 1º Grau', 'https://eproc1g.tjsc.jus.br/eproc/index.php', 'TJSC', 'E-Proc', 'estadual', 61),
('E-Proc TJSC 2º Grau', 'https://eproc2g.tjsc.jus.br/eproc/externo_controlador.php?acao=principal', 'TJSC', 'E-Proc', 'estadual', 62),

-- TJTO
('E-Proc TJTO 1º Grau', 'https://eproc1.tjto.jus.br/eprocV2_prod_1grau/', 'TJTO', 'E-Proc', 'estadual', 63),
('E-Proc TJTO 2º Grau', 'https://eproc2.tjto.jus.br/eprocV2_prod_2grau/', 'TJTO', 'E-Proc', 'estadual', 64),

-- TJRS
('E-Proc TJRS 1º Grau', 'https://keycloak-eks.tjrs.jus.br/realms/eproc/protocol/openid-connect/auth?kc_idp_hint=tjrs&eproc_client_id=eproc-tjrs-1g&response_type=code&redirect_uri=https%3A%2F%2Feproc1g.tjrs.jus.br%2Feproc%2Fexterno_controlador.php%3Facao%3DSSO%2Fcallback&client_id=eproc-tjrs-1g&nonce=2585469a866c423ccf12552e71a9438a&state=1c92904d7a44d8c2904db93cff3e8dc3&scope=profile+openid', 'TJRS', 'E-Proc', 'estadual', 65),
('E-Proc TJRS 2º Grau', 'https://keycloak-eks.tjrs.jus.br/realms/eproc/protocol/openid-connect/auth?kc_idp_hint=tjrs&eproc_client_id=eproc-tjrs-2g&response_type=code&redirect_uri=https%3A%2F%2Feproc2g.tjrs.jus.br%2Feproc%2Fexterno_controlador.php%3Facao%3DSSO%2Fcallback&client_id=eproc-tjrs-2g&nonce=710f277badc3b0ea0a9f8bf151957506&state=4fd87a2f7dcdfe0bc9d7e91b07754272&scope=profile+openid', 'TJRS', 'E-Proc', 'estadual', 66),

-- TJAL e TJMS (Outros sistemas)
('Tarefas TJAL', 'https://www2.tjal.jus.br/tarefas-adv/', 'TJAL', 'Tarefas', 'estadual', 70),
('ESAJ TJMS', 'https://esaj.tjms.jus.br/tarefas-adv/', 'TJMS', 'ESAJ', 'estadual', 71);
