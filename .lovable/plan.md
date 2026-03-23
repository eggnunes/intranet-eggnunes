

## Plan: Melhorias na Página de Chat dos Agentes de IA

### Problemas Identificados (da imagem)

1. **Header mostra instruções completas** abaixo do nome do agente -- texto longo demais
2. **Tela de boas-vindas repete as instruções** no centro da página -- duplicação
3. **Sem opção de anexar documentos** na área de input
4. **Sem opção de microfone** para gravação de voz (voice-to-text)
5. **Caixa de texto cortada** no final do layout

### Alterações Planejadas

#### 1. Corrigir Header (arquivo: `src/pages/AgenteChatPage.tsx`)
- Manter apenas o emoji, nome do agente e o campo `objective` (resumo curto)
- Remover qualquer exibição das instruções completas no header

#### 2. Corrigir Tela de Boas-Vindas
- No estado vazio (sem mensagens), mostrar apenas o emoji, nome e `objective`
- Remover a exibição das instruções -- atualmente mostra `agent.objective` que contém o texto longo das instruções. O campo `objective` parece estar preenchido com o conteúdo das instruções pelo usuário, então vamos truncar para no máximo 2 linhas com `line-clamp-2`

#### 3. Adicionar Botão de Anexar Documento
- Adicionar input hidden para upload de arquivos (aceitar PDF, DOC, DOCX, TXT, imagens)
- Adicionar botão com ícone de clipe (Paperclip) ao lado da caixa de texto
- Mostrar preview dos arquivos anexados acima da caixa de texto
- Enviar arquivos como base64 junto com a mensagem para o edge function
- Atualizar o edge function `chat-with-agent` para receber e processar attachments

#### 4. Adicionar Botão de Microfone (Voice-to-Text)
- Reutilizar o padrão já existente em `AssistenteIA.tsx` com `MediaRecorder`
- Adicionar botão de microfone ao lado do botão de enviar
- Usar a edge function `voice-to-text` existente (Whisper) para transcrever
- Mostrar indicador visual de gravação em andamento

#### 5. Corrigir Layout da Caixa de Texto
- Ajustar o container principal para `h-[calc(100vh-6rem)]` e adicionar padding inferior
- Garantir que a área de input tenha espaço adequado com `pb-4` no container

### Detalhes Técnicos

**Arquivos modificados:**
- `src/pages/AgenteChatPage.tsx` -- todas as alterações de layout, microfone e anexo
- `supabase/functions/chat-with-agent/index.ts` -- aceitar attachments no payload e incluir no contexto da mensagem

**Padrão de voz:** Reutiliza `voice-to-text` edge function existente (OpenAI Whisper), mesmo padrão de `AssistenteIA.tsx`.

**Padrão de anexos:** Upload via input file, converter para base64, enviar no corpo da requisição. No edge function, incluir metadados dos arquivos no contexto da conversa.

