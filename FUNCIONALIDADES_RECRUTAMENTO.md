# Sistema de Gestão de Recrutamento e Contratação

## Visão Geral
Sistema completo para gerenciamento de processos seletivos, banco de currículos e acompanhamento de candidatos desde a recepção do currículo até a contratação.

---

## 📋 FUNCIONALIDADES PRINCIPAIS

### 1. Gestão de Vagas
- **Criar novas vagas**: Cadastro com título, cargo, descrição e requisitos
- **Templates de posição**: Salvar e reutilizar descrições/requisitos de vagas anteriores
- **Sugestão com IA**: Geração automática de descrições e requisitos via inteligência artificial
- **Status da vaga**: Controle de vagas abertas/fechadas
- **Histórico de vagas**: Registro completo de todas as vagas criadas

### 2. Gestão de Candidatos

#### 2.1 Cadastro de Candidatos
- **Upload de currículos**: Suporte a PDF, DOC e DOCX
- **Upload em lote**: Processamento de múltiplos currículos simultaneamente
- **Extração automática com IA**: Análise do currículo para extrair:
  - Nome completo
  - E-mail
  - Telefone
  - Cargo pretendido
- **Cadastro manual**: Inserção manual de dados do candidato
- **Vinculação a vagas**: Associar candidato a uma vaga específica

#### 2.2 Pipeline de Recrutamento (Kanban)
Etapas do processo seletivo:
1. **Currículo Recebido** - Entrada inicial
2. **Entrevista Agendada** - Primeira entrevista marcada
3. **Entrevista Realizada** - Após primeira entrevista
4. **Aguardando Prova** - Candidato aguarda avaliação técnica
5. **Prova Realizada** - Após avaliação técnica
6. **Entrevista Presencial Agendada** - Entrevista presencial marcada
7. **Entrevista Presencial Realizada** - Após entrevista presencial
8. **Contratado** - Candidato aprovado e contratado
9. **Eliminado** - Candidato não aprovado

#### 2.3 Movimentação de Candidatos
- **Drag and Drop (Desktop)**: Arrastar cards entre colunas no Kanban
- **Menu de movimentação (Mobile)**: Botão para mover candidato entre etapas
- **Histórico de movimentações**: Registro completo de todas as mudanças de etapa

### 3. Visualizações

#### 3.1 Modo Lista
- Visualização em cards expandidos
- Informações detalhadas do candidato
- Botões de ação rápida
- Seleção para comparação

#### 3.2 Modo Kanban
- Visualização em colunas por etapa
- Cards compactos com informações essenciais
- Drag and drop para movimentação
- Barra de rolagem horizontal para navegar entre etapas

### 4. Filtros e Busca
- **Busca por texto**: Nome, e-mail, telefone
- **Filtro por etapa**: Visualizar candidatos de uma etapa específica
- **Filtro por vaga**: Ver candidatos de uma vaga específica
- **Filtro Banco de Talentos**: Candidatos sem vaga específica

### 5. Agendamento de Entrevistas
- **Tipos de entrevista**: Online ou Presencial
- **Data e hora**: Agendamento com data/horário específico
- **Duração**: Definir tempo da entrevista
- **Local/Link**: Endereço físico ou link de reunião virtual
- **Notas**: Observações para a entrevista
- **Status**: Agendada, Realizada, Cancelada

### 6. Sistema de Avaliação

#### 6.1 Feedback de Entrevistas
Critérios de avaliação (1-5 estrelas):
- Conhecimentos Técnicos
- Comunicação
- Fit Cultural
- Resolução de Problemas
- Experiência
- Motivação
- Avaliação Geral

#### 6.2 Recomendação
- Fortemente Recomendado
- Recomendado
- Talvez
- Não Recomendado
- Fortemente Não Recomendado

#### 6.3 Campos Adicionais
- Pontos fortes
- Pontos fracos
- Notas adicionais

### 7. Comparação de Candidatos
- **Seleção múltipla**: Marcar candidatos para comparar
- **Tela de comparação**: Visualizar candidatos lado a lado
- **Métricas comparativas**: Notas, avaliações, experiência
- **Exportação**: Baixar comparativo

### 8. Banco de Talentos
- **Pool de candidatos**: Candidatos sem vaga específica
- **Enviar para banco**: Mover candidato eliminado/não selecionado
- **Reativar candidato**: Vincular a nova vaga quando surgir oportunidade
- **Notas de talento**: Observações sobre potencial futuro
- **Filtros específicos**: Busca, ordenação, cargo

### 9. Gestão de Documentos

#### 9.1 Tipos de Documentos
- Currículo
- Certificados
- Diploma
- Comprovante de Residência
- Documento de Identidade
- Portfólio
- Carta de Recomendação
- Outros

#### 9.2 Funcionalidades
- Upload de múltiplos arquivos
- Visualização/preview de documentos
- Download de documentos
- Organização por tipo

### 10. Anotações e Histórico
- **Notas do candidato**: Registro de observações
- **Histórico de etapas**: Todas as movimentações registradas
- **Timestamps**: Data/hora de cada ação
- **Auditoria**: Registro de quem realizou cada ação

### 11. Eliminação de Candidatos

#### 11.1 Motivos de Eliminação
- Sem interesse do candidato
- Sem interesse do escritório
- Reprovado na entrevista
- Reprovado na prova
- Reprovado na entrevista presencial
- Outro motivo

#### 11.2 Registro
- Motivo obrigatório
- Notas opcionais
- Data de eliminação

### 12. Estatísticas e Métricas
- Total de candidatos
- Candidatos por etapa
- Taxa de conversão
- Tempo médio no processo
- Vagas abertas vs fechadas

### 13. Exportação de Dados
- **PDF**: Relatório de candidatos
- **Excel (XLSX)**: Planilha com dados completos
- **Seleção de campos**: Escolher quais dados exportar

### 14. Permissões de Acesso
- **Visualização**: Apenas ver candidatos e vagas
- **Edição**: Criar, editar, mover candidatos
- **Administração**: Gerenciar vagas e configurações

---

## 🎨 RECURSOS DE INTERFACE

### Design
- **Responsivo**: Funciona em desktop, tablet e mobile
- **Tema claro/escuro**: Suporte a modo noturno
- **Cores por etapa**: Identificação visual das etapas
- **Cards informativos**: Resumo de dados importantes

### Interatividade
- **Drag and Drop**: Movimentação intuitiva no Kanban
- **Modais**: Formulários em diálogos
- **Toasts**: Notificações de ações
- **Loading states**: Indicadores de carregamento
- **Progress bars**: Acompanhamento de uploads

### Acessibilidade
- **Atalhos de teclado**: Navegação via teclado
- **Tooltips**: Dicas de contexto
- **Labels**: Identificação clara de campos
- **Contraste**: Cores acessíveis

---

## 🔧 INTEGRAÇÕES

### Supabase (Backend)
- Armazenamento de dados
- Upload de arquivos
- Autenticação de usuários
- Políticas de segurança (RLS)

### Edge Functions
- `parse-resume`: Extração de dados do currículo com IA
- `suggest-job-opening`: Geração de descrições de vagas com IA

---

## 📊 TABELAS DO BANCO DE DADOS

- `recruitment_job_openings` - Vagas
- `recruitment_candidates` - Candidatos
- `recruitment_interviews` - Entrevistas
- `recruitment_interview_feedback` - Avaliações
- `recruitment_candidate_documents` - Documentos
- `recruitment_candidate_notes` - Anotações
- `recruitment_stage_history` - Histórico de etapas
- `recruitment_position_templates` - Templates de posição

---

## 📱 FLUXO DO USUÁRIO

```
1. Criar Vaga → 2. Receber Currículo → 3. Agendar Entrevista → 
4. Realizar Entrevista → 5. Avaliar Candidato → 6. Prova Técnica → 
7. Entrevista Presencial → 8. Decisão Final → 9. Contratação ou Banco de Talentos
```

---

*Documento gerado automaticamente pelo sistema Lovable*
*Data: Janeiro/2026*
