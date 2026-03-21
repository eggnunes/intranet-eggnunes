

## Viabilidade Jurídica — Escolha de IA e Análise Profunda

### Situação atual
- A edge function `analyze-viability` usa **Claude Sonnet 4** via API direta da Anthropic
- Não há opção de escolha de modelo pelo usuário
- O prompt é razoável mas pode ser mais profundo

### O que será feito

**1. Frontend (`src/pages/ViabilidadeNovo.tsx`)**
- Adicionar um seletor de IA antes do botão "Analisar Viabilidade" com duas opções:
  - **Claude (Análise Profunda)** — usa Claude Sonnet 4 via Anthropic API
  - **ChatGPT (Pesquisa Investigativa)** — usa OpenAI o3 via API direta (modelo de raciocínio avançado, equivalente à "pesquisa profunda")
- Enviar o campo `modelo` no body da requisição

**2. Edge Function (`supabase/functions/analyze-viability/index.ts`)**
- Receber o campo `modelo` (`claude` ou `chatgpt`)
- Manter a rota Claude existente (Anthropic API direta com `claude-sonnet-4-20250514`)
- Adicionar rota OpenAI usando `OPENAI_API_KEY` com modelo `o3` e reasoning effort `high` para análise profunda
- Expandir o system prompt para exigir análise mais detalhada: jurisprudência relevante, riscos processuais, estimativa de prazo e probabilidade de êxito
- Retornar também qual modelo foi usado na resposta

**3. Secrets necessários**
- `ANTHROPIC_API_KEY` — já configurado
- `OPENAI_API_KEY` — já configurado

### Arquivos alterados
- `src/pages/ViabilidadeNovo.tsx` — seletor de modelo + envio do campo
- `supabase/functions/analyze-viability/index.ts` — suporte a dois provedores + prompt aprimorado

