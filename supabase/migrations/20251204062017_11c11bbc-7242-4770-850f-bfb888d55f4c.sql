-- Tabela para conversas do assistente de IA
CREATE TABLE public.ai_conversations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL DEFAULT 'Nova conversa',
  model TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela para mensagens das conversas
CREATE TABLE public.ai_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES public.ai_conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  attachments JSONB DEFAULT '[]'::jsonb,
  images JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela para templates de prompts jurídicos
CREATE TABLE public.ai_prompt_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  prompt TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ai_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_prompt_templates ENABLE ROW LEVEL SECURITY;

-- Policies para ai_conversations
CREATE POLICY "Users can view their own conversations" 
ON public.ai_conversations FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own conversations" 
ON public.ai_conversations FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own conversations" 
ON public.ai_conversations FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own conversations" 
ON public.ai_conversations FOR DELETE 
USING (auth.uid() = user_id);

-- Policies para ai_messages
CREATE POLICY "Users can view messages of their conversations" 
ON public.ai_messages FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM public.ai_conversations 
  WHERE id = ai_messages.conversation_id AND user_id = auth.uid()
));

CREATE POLICY "Users can create messages in their conversations" 
ON public.ai_messages FOR INSERT 
WITH CHECK (EXISTS (
  SELECT 1 FROM public.ai_conversations 
  WHERE id = ai_messages.conversation_id AND user_id = auth.uid()
));

-- Policies para ai_prompt_templates (todos usuários aprovados podem ver)
CREATE POLICY "Approved users can view templates" 
ON public.ai_prompt_templates FOR SELECT 
USING (is_approved(auth.uid()));

CREATE POLICY "Admins can manage templates" 
ON public.ai_prompt_templates FOR ALL 
USING (has_role(auth.uid(), 'admin'));

-- Índices para performance
CREATE INDEX idx_ai_conversations_user_id ON public.ai_conversations(user_id);
CREATE INDEX idx_ai_messages_conversation_id ON public.ai_messages(conversation_id);

-- Trigger para updated_at
CREATE TRIGGER update_ai_conversations_updated_at
BEFORE UPDATE ON public.ai_conversations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Inserir templates jurídicos padrão
INSERT INTO public.ai_prompt_templates (title, category, prompt, description) VALUES
('Petição Inicial', 'Petições', 'Você é um advogado especialista. Elabore uma petição inicial completa com os seguintes elementos: qualificação das partes, exposição dos fatos, fundamentação jurídica, pedidos e requerimentos finais. O caso é sobre:', 'Template para criação de petições iniciais'),
('Contestação', 'Petições', 'Você é um advogado especialista em defesa. Elabore uma contestação completa contendo: preliminares (se houver), impugnação dos fatos, fundamentação jurídica da defesa e pedidos. O caso a contestar é:', 'Template para elaboração de contestações'),
('Recurso de Apelação', 'Recursos', 'Você é um advogado especialista em recursos. Elabore um recurso de apelação com: tempestividade, preparo, razões recursais com fundamentação legal e jurisprudencial, e pedido de reforma da sentença. A situação é:', 'Template para recursos de apelação'),
('Parecer Jurídico', 'Pareceres', 'Você é um jurista experiente. Elabore um parecer jurídico completo com: relatório do caso, questões jurídicas envolvidas, fundamentação doutrinária e jurisprudencial, e conclusão fundamentada. A consulta é sobre:', 'Template para pareceres jurídicos'),
('Contrato de Prestação de Serviços', 'Contratos', 'Você é um advogado especialista em contratos. Elabore um contrato de prestação de serviços completo com: qualificação das partes, objeto, obrigações, prazo, valor, forma de pagamento, rescisão e cláusulas gerais. Os detalhes são:', 'Template para contratos de serviços'),
('Notificação Extrajudicial', 'Notificações', 'Você é um advogado. Elabore uma notificação extrajudicial formal contendo: qualificação do notificante e notificado, exposição dos fatos, fundamentação legal, prazo para resposta e consequências do não cumprimento. O caso é:', 'Template para notificações extrajudiciais'),
('Resumo de Jurisprudência', 'Pesquisa', 'Você é um pesquisador jurídico. Analise e resuma as principais jurisprudências sobre o tema, identificando: tribunais, teses predominantes, argumentos relevantes e tendências. O tema é:', 'Template para pesquisa jurisprudencial'),
('Análise de Contrato', 'Análise', 'Você é um advogado especialista em contratos. Analise o contrato fornecido identificando: cláusulas abusivas, riscos jurídicos, pontos de atenção e sugestões de melhoria. O contrato a analisar é:', 'Template para análise contratual');