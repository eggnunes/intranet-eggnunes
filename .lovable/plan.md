

# Plano: Controle de Prazos — Coordenação (Integrado ao ADVBox)

## Resumo

Criar página "Controle de Prazos — Coordenação" acessível apenas a admins/sócios, no grupo ADVBox do sidebar. A página exibe tarefas do ADVBox filtradas (excluindo tipos irrelevantes e tarefas só da Mariana), com botão de verificação e botão de sincronização manual que puxa conclusões do ADVBox.

## Banco de Dados

### Nova tabela `prazo_verificacoes`
- `id` UUID PK
- `advbox_task_id` TEXT NOT NULL (advbox_id)
- `verificado_por` UUID (ref auth.users)
- `verificado_em` TIMESTAMPTZ DEFAULT now()
- `observacoes` TEXT
- `status` TEXT DEFAULT 'verificado' ('verificado' | 'com_pendencia')
- `created_at` TIMESTAMPTZ DEFAULT now()
- RLS: todas operações restritas a `is_admin_or_socio(auth.uid())`

## Frontend

### Nova página `src/pages/ControlePrazos.tsx`
- Título: **"Controle de Prazos — Coordenação"**
- Consulta `advbox_tasks` com campos: `advbox_id`, `title`, `task_type`, `due_date`, `status`, `assigned_users`, `process_number`, `raw_data`, `completed_at`
- **Extrai de `raw_data`**: `created_at` (data publicação), `date` (prazo interno), `date_deadline` (prazo fatal)
- **Exclusões automáticas** de task_types: ACOMPANHAR DECISÃO, ACOMPANHAR DESPACHO, atendimentos, ligações telefônicas, etc.
- **Exclui** tarefas atribuídas exclusivamente à "Mariana"
- **Tabela**: Nº Processo | Advogado | Data Publicação | Prazo Interno | Prazo Fatal | Status Verificação | Ações
- **Filtros**: advogado (dropdown), período (date range), status verificação (pendente/verificado/com pendência)
- **Botão "Verificar"**: abre dialog com campo observações, insere em `prazo_verificacoes`
- **Badges visuais**: verde (verificado), amarelo (pendente), vermelho (com pendência)
- **Botão "Sincronizar"**: chama `sync-advbox-tasks` para puxar atualizações do ADVBox, incluindo tarefas concluídas lá. A sync já detecta conclusões automaticamente (campo `users[].completed` da API)
- Indicador visual de tarefas concluídas no ADVBox (auto-detectadas na sincronização)

### Navegação
- Adicionar "Controle de Prazos" no grupo **📦 ADVBOX** do sidebar com ícone `ClipboardCheck`, visível apenas para admins/sócios
- Rota `/controle-prazos` em `App.tsx` com `ProtectedRoute`

## Sincronização
A função `sync-advbox-tasks` já existente detecta conclusões do ADVBox (via `task.users[].completed`). O botão "Sincronizar" na página de Controle de Prazos reutiliza essa mesma função. Após sincronizar, tarefas concluídas no ADVBox aparecem automaticamente com status `completed` na tabela.

