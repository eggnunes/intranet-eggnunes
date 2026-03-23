

## Diagnóstico

Analisando o código atual em `AgenteChatPage.tsx`, os botões de **anexar documento** (Paperclip) e **microfone** (Mic) **já existem no código** (linhas 581-600), assim como o `line-clamp-1` no header (linha 440). Porém, o screenshot mostra que essas mudanças **não estão refletidas na tela** — o header ainda exibe o texto completo das instruções e os botões não aparecem.

Isso indica que as edições anteriores podem não ter sido salvas corretamente ou houve um conflito de deploy. 

## Plano: Reescrever a área de input e header para garantir funcionamento

### 1. Header — remover texto longo de instruções
- Manter apenas nome do agente e objetivo truncado (1 linha com `line-clamp-1`)
- Confirmar que o código está correto (já está nas linhas 438-441)

### 2. Área de input — garantir visibilidade dos botões
- Botão de **Paperclip** (anexar arquivos: PDF, DOC, TXT, imagens) à esquerda do textarea
- Botão de **Microfone** (gravar áudio → transcrever via edge function `voice-to-text`) à esquerda do textarea
- Indicador de gravação quando microfone ativo
- Preview de arquivos anexados acima do textarea

### 3. Layout cortado — corrigir altura do container
- Aumentar padding inferior (`pb-4`) na área de input para evitar corte
- Verificar que `h-[calc(100vh-6rem)]` não está sendo sobreposto pelo Layout

### 4. Tela de boas-vindas — remover texto repetido
- Mostrar apenas emoji, nome e uma frase curta (truncada com `line-clamp-2`)

### Arquivos a modificar
- `src/pages/AgenteChatPage.tsx` — reescrever seções de header, welcome screen e input area para garantir que as alterações persistam

### O que o código já tem (será preservado)
- Lógica de upload de arquivos com base64 (`handleFileSelect`)
- Gravação de áudio com `MediaRecorder` + transcrição via `voice-to-text`
- Botões de exportação (PDF, TXT, Copiar, Teams) nas respostas do assistente
- Diálogos de save to Teams

