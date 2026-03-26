

## Correção de anexos, geração de documentos e histórico global nos Agentes de IA

### Problema 1: Anexos não funcionam / tipos restritos
O `<input type="file">` na linha 577 do `AgenteChatPage.tsx` tem `accept` limitado a `.pdf,.doc,.docx,.txt,.png,.jpg,.jpeg,.webp,.csv,.xlsx` — exclui vídeos, áudios e outros formatos. Além disso, o limite de 10MB pode ser restritivo para vídeos. Vou:

- **Remover a restrição de `accept`** para permitir qualquer tipo de arquivo
- **Aumentar o limite para 50MB** para suportar vídeos/áudios maiores
- **Adicionar feedback visual** ao clicar no botão de anexo (toast de "carregando" para arquivos grandes)
- **No backend** (`chat-with-agent/index.ts`): o processamento de anexos já lida com PDFs e DOCX; para outros tipos (vídeo, áudio, imagens), enviar como contexto informando o nome/tipo do arquivo

### Problema 2: IA gerar documentos para download (Word/PDF)
Já existe download como PDF e TXT. Vou adicionar:

- **Download como DOCX** usando a biblioteca `docx` (já usada em outros componentes do projeto via `file-saver`)
- Adicionar botão "DOCX" ao lado dos existentes PDF/TXT nas respostas do assistente
- O DOCX será gerado com o conteúdo markdown da resposta convertido em parágrafos formatados

### Problema 3: Histórico global de usos dos agentes
Atualmente o histórico mostra apenas conversas do próprio usuário no sidebar lateral. Vou criar:

**Nova aba "Histórico de Uso" na página AgentesIA.tsx:**
- Listar todas as conversas de todos os usuários com todos os agentes
- Mostrar: nome do agente, nome do usuário, data, título da conversa
- Ao clicar, abrir a conversa completa em modo leitura (visualizar mensagens)
- Administradores podem excluir qualquer conversa do histórico
- Filtros por agente e por usuário

**Implementação técnica:**

1. **`src/pages/AgentesIA.tsx`** — Adicionar 3a aba "Histórico de Uso" no TabsList
2. **`src/components/agents/AgentUsageHistory.tsx`** (novo) — Componente que:
   - Busca conversas de `intranet_agent_conversations` com join em `profiles` (nome do usuário) e `intranet_agents` (nome/emoji do agente)
   - Lista em tabela com colunas: Agente, Usuário, Título, Data, Ações
   - Modal para visualizar mensagens completas da conversa selecionada
   - Botão de excluir visível apenas para admins (usando `useUserRole`)
3. **`src/pages/AgenteChatPage.tsx`**:
   - Remover restrição `accept` do input de arquivo
   - Aumentar limite de tamanho
   - Adicionar botão de download DOCX
4. **`supabase/functions/chat-with-agent/index.ts`** — Manter como está (já suporta anexos no processamento)

### Arquivos modificados
- `src/pages/AgentesIA.tsx` — nova aba
- `src/pages/AgenteChatPage.tsx` — correção de anexos + botão DOCX
- `src/components/agents/AgentUsageHistory.tsx` — novo componente de histórico

### Resultado
- Qualquer arquivo pode ser anexado na conversa com o agente
- Respostas podem ser baixadas como PDF, TXT ou DOCX
- Histórico global de uso disponível para todos, com exclusão por admins

