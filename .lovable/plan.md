
# Comentarios Internos, Tags, Responsaveis e Filtros no WhatsApp Avisos

## Resumo
Adicionar ao modulo WhatsApp Avisos: comentarios internos visiveis apenas para colaboradores (com marcacao de colegas via @), sistema de tags coloridas por contato, edicao de nome do contato, atribuicao de responsaveis e setores, filtros avancados na lista de conversas, e notificacoes em tempo real quando alguem for mencionado.

---

## 1. Banco de Dados - Novas Tabelas e Colunas

### Tabela `whatsapp_internal_comments`
Armazena comentarios internos que aparecem na timeline da conversa, mas nao sao enviados ao cliente.

| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | uuid (PK) | Identificador |
| conversation_id | uuid (FK -> whatsapp_conversations) | Conversa relacionada |
| author_id | uuid (FK -> profiles) | Quem escreveu o comentario |
| content | text | Texto do comentario |
| created_at | timestamptz | Data/hora |

### Tabela `whatsapp_comment_mentions`
Registra quais colaboradores foram marcados em cada comentario (para gerar notificacoes).

| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | uuid (PK) | Identificador |
| comment_id | uuid (FK -> whatsapp_internal_comments) | Comentario |
| mentioned_user_id | uuid (FK -> profiles) | Colaborador mencionado |
| created_at | timestamptz | Data/hora |

### Tabela `whatsapp_tags`
Cadastro global de tags reutilizaveis.

| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | uuid (PK) | Identificador |
| name | text (unique) | Nome da tag (ex: "VIP", "Urgente") |
| color | text | Cor em hex (ex: "#FF5733") |
| created_by | uuid | Quem criou |
| created_at | timestamptz | Data/hora |

### Tabela `whatsapp_conversation_tags`
Relacao N:N entre conversas e tags.

| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | uuid (PK) | Identificador |
| conversation_id | uuid (FK -> whatsapp_conversations) | Conversa |
| tag_id | uuid (FK -> whatsapp_tags) | Tag |
| created_at | timestamptz | Data/hora |
| UNIQUE(conversation_id, tag_id) | | Sem duplicatas |

### Tabela `whatsapp_conversation_assignees`
Colaboradores responsaveis pela conversa (pode ter mais de um).

| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | uuid (PK) | Identificador |
| conversation_id | uuid (FK -> whatsapp_conversations) | Conversa |
| user_id | uuid (FK -> profiles) | Colaborador responsavel |
| created_at | timestamptz | Data/hora |
| UNIQUE(conversation_id, user_id) | | Sem duplicatas |

### Coluna nova em `whatsapp_conversations`
- `sector` text (nullable) - Setor responsavel: 'comercial', 'operacional', 'financeiro' ou null

### Configuracao
- RLS habilitado em todas as tabelas (acesso para usuarios autenticados)
- Realtime habilitado para `whatsapp_internal_comments` (comentarios aparecem em tempo real)

---

## 2. Notificacoes em Tempo Real

### Mecanismo
Quando um comentario interno e criado com mencoes (@usuario), o sistema:
1. Insere o comentario em `whatsapp_internal_comments`
2. Insere registros em `whatsapp_comment_mentions` para cada usuario mencionado
3. Insere notificacoes na tabela `user_notifications` existente para cada mencionado
4. O hook `useNotifications` ja existente captura as novas notificacoes via Realtime e exibe o toast

### Trigger no banco de dados
Um trigger `AFTER INSERT` na tabela `whatsapp_comment_mentions` criara automaticamente uma notificacao em `user_notifications` para o colaborador mencionado, com:
- `title`: "Voce foi mencionado no WhatsApp"
- `message`: Trecho do comentario + nome do contato
- `action_url`: "/whatsapp-avisos"
- `type`: "whatsapp_mention"

Isso tambem sera aplicado ao sistema de mensagens internas (tabela `messages`): um trigger similar detectara mencoes com "@" no conteudo da mensagem e gerara notificacoes em `user_notifications`.
Nas mensagens internas, o usuário será notificado não só quando for selecionado o @ dele, mas também quando receber uma mensagem direcionada a ele. Nesse caso, as notificações poderiam o ocorrer como um pop-up que aparece por alguns segundos no canto inferior direito da tela, inclusive quando a janela estiver minimizada. 

---

## 3. Frontend - Novos Componentes

### 3.1 Painel Lateral de Detalhes do Contato
Novo componente `ContactDetailsPanel.tsx` que abre ao clicar no header da conversa:
- **Editar nome do contato** (campo editavel inline)
- **Setor**: Dropdown com opcoes Comercial, Operacional, Financeiro
- **Responsaveis**: Multi-select de colaboradores (busca na tabela `profiles`)
- **Tags**: Exibicao das tags atuais + adicionar/remover tags existentes + criar nova tag inline

### 3.2 Bolha de Comentario Interno
No `ChatArea.tsx`, alem das mensagens normais, exibir comentarios internos intercalados na timeline por data/hora. A bolha tera:
- Fundo bege/amarelo claro (`bg-amber-50 dark:bg-amber-900/20`) com borda (`border-amber-200`)
- Icone de cadeado ou etiqueta "Interno"
- Nome do autor
- Conteudo com mencoes destacadas em azul
- Nao tem status de entrega (nao e mensagem real)

### 3.3 Input de Comentario Interno
Botao no `MessageInput.tsx` (icone de nota/comentario) que alterna o modo de envio entre "mensagem" e "comentario interno". Quando ativado:
- O campo de texto muda a borda para amarelo/bege
- Placeholder muda para "Escrever comentario interno..."
- Ao digitar "@", aparece lista de colaboradores para mencao
- O envio salva em `whatsapp_internal_comments` (nao envia via Z-API)

### 3.4 Aba de Tags
Nova aba "Tags" nas tabs do WhatsApp Avisos:
- Lista todas as tags cadastradas com nome, cor e contagem de uso
- Botao para criar nova tag (nome + seletor de cor)
- Botao para editar e excluir tags

### 3.5 Filtros na Lista de Conversas
No `ConversationList.tsx`, adicionar icone de filtro que expande um painel com:
- **Responsavel**: Dropdown multi-select de colaboradores
- **Setor**: Checkbox para Comercial, Operacional, Financeiro
- **Tag**: Multi-select de tags disponiveis
- **Telefone**: Campo de busca (ja existe, manter)
- **Nome do cliente**: Campo de busca (ja existe, manter)
- **Status**: Com/sem mensagens nao lidas
- Badge indicando quantos filtros estao ativos

### 3.6 Exibicao de Tags e Responsaveis na Lista de Conversas
Cada card de conversa na lista lateral exibira:
- Badges coloridos das tags atribuidas (compactos)
- Avatar pequeno dos responsaveis atribuidos

---

## 4. Arquivos a Criar

| Arquivo | Descricao |
|---------|-----------|
| `src/components/whatsapp/ContactDetailsPanel.tsx` | Painel lateral com detalhes, edicao de nome, setor, responsaveis e tags |
| `src/components/whatsapp/TagsManager.tsx` | Aba de gestao de tags (CRUD) |
| `src/components/whatsapp/ConversationFilters.tsx` | Painel de filtros avancados |
| `src/components/whatsapp/InternalCommentInput.tsx` | Input alternativo para comentarios internos com @mencoes |
| 1 migration SQL | Todas as tabelas, colunas, RLS, triggers e realtime |

## 5. Arquivos a Modificar

| Arquivo | Mudancas |
|---------|----------|
| `src/components/whatsapp/ChatArea.tsx` | Exibir comentarios internos intercalados, header clicavel para abrir detalhes |
| `src/components/whatsapp/MessageInput.tsx` | Botao para alternar modo comentario, integracao com @mencoes |
| `src/components/whatsapp/ConversationList.tsx` | Exibir tags/responsaveis, integrar filtros, receber props de filtro |
| `src/pages/WhatsAppAvisos.tsx` | Nova aba "Tags", carregar dados de tags/responsaveis, passar filtros, carregar comentarios junto com mensagens |

## 6. Notificacoes nas Mensagens Internas

Para o sistema de mensagens internas entre colaboradores (pagina Mensagens):
- Criar um trigger no banco que detecta mencoes "@nome" em mensagens da tabela `messages`
- Resolver o nome mencionado para o user_id correspondente na tabela `profiles`
- Inserir notificacao em `user_notifications` com `action_url` apontando para `/mensagens`
- O sistema de notificacoes existente ja cuida de exibir o toast em tempo real

---

## Detalhes Tecnicos

### Consulta combinada de mensagens + comentarios
No `WhatsAppAvisos.tsx`, ao carregar mensagens de uma conversa:
1. Buscar `whatsapp_messages` filtrado por `conversation_id`
2. Buscar `whatsapp_internal_comments` filtrado por `conversation_id`, com join em `profiles` para nome do autor
3. Unificar em uma lista ordenada por `created_at` com um campo `_type: 'message' | 'comment'`
4. Renderizar cada item com a bolha adequada

### Mencoes com "@"
- Ao digitar "@" no input de comentario, buscar colaboradores ativos da tabela `profiles`
- Exibir dropdown flutuante filtrado pelo texto apos "@"
- Ao selecionar, inserir o nome formatado no texto: `@NomeCompleto`
- Ao salvar, extrair mencoes do texto e inserir em `whatsapp_comment_mentions`

### Filtros
- Os filtros serao aplicados no frontend combinando os dados carregados
- Para tags e responsaveis, carregar as relacoes junto com as conversas via queries separadas (evitar joins complexos que podem falhar no PostgREST)
- Manter estado dos filtros no componente pai `WhatsAppAvisos.tsx`
