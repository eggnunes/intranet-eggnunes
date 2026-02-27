

## Plano: Evolução do Módulo de Decisões Favoráveis

### 1. Migração de banco de dados

Adicionar novas colunas na tabela `favorable_decisions`:
- `reu` (text, nullable) - Réu da ação
- `regiao` (text, nullable) - Região do tribunal
- `materia` (text, nullable) - Matéria (civil, trabalhista, previdenciário, etc.)
- `resultado` (text, nullable) - Procedente/Improcedente/Parcialmente procedente
- `decisao_texto` (text, nullable) - Texto/trecho da decisão em si
- `ai_analysis` (jsonb, nullable) - Dados da análise de IA (categorização automática)
- `notify_team` (boolean, default false) - Se deseja notificar equipe
- `notify_message` (text, nullable) - Trecho da decisão para notificação

### 2. Edge function para análise de IA

Criar `supabase/functions/analyze-decision/index.ts`:
- Recebe observation/decisao_texto e campos existentes
- Usa Lovable AI (gemini-3-flash-preview) para categorizar automaticamente: réu, matéria, resultado, região
- Retorna JSON estruturado com os campos preenchidos

### 3. Refatorar a página em abas (Tabs)

Reorganizar `src/pages/DecisoesFavoraveis.tsx` com duas abas principais:
- **Decisões**: Conteúdo atual (listagem, cadastro, filtros)
- **Jurimetria**: Dashboard com gráficos e análises

### 4. Novos filtros de pesquisa

Expandir os filtros existentes para incluir:
- Réu
- Tribunal/Região
- Matéria
- Resultado (Procedente/Improcedente)
- Período (data início/fim)

### 5. Formulário de cadastro atualizado

Adicionar ao formulário existente:
- Campo "Réu"
- Campo "Região"
- Select "Matéria" (civil, trabalhista, previdenciário, tributário, administrativo, etc.)
- Select "Resultado" (procedente, improcedente, parcialmente procedente)
- Textarea "Texto/Trecho da Decisão"
- Checkbox "Notificar equipe" + Textarea condicional para o trecho a notificar
- Botão "Analisar com IA" que preenche automaticamente campos via edge function

### 6. Notificação à equipe

Ao salvar com `notify_team = true`:
- Inserir registro em `user_notifications` para todos os usuários aprovados
- Incluir o trecho da decisão na mensagem da notificação

### 7. Aba Jurimetria - Dashboard

Criar componente `src/components/JurimetriaDashboard.tsx` com:
- Gráfico de pizza: distribuição por matéria
- Gráfico de barras: decisões por tribunal/região
- Gráfico de barras: procedência vs improcedência
- Gráfico de linha: evolução temporal de decisões
- Cards de KPIs: taxa de procedência, tribunal com mais vitórias, matéria mais frequente
- Filtros próprios (período, matéria, tribunal)
- Usa recharts (já instalado)

### Arquivos modificados/criados
- **Migração SQL**: novos campos na tabela
- `supabase/functions/analyze-decision/index.ts` (novo)
- `src/components/JurimetriaDashboard.tsx` (novo)
- `src/pages/DecisoesFavoraveis.tsx` (refatorado com tabs, filtros, formulário)

