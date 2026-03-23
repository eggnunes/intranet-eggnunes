

# Adicionar gravação de áudio com transcrição na Descrição do Caso

## O que será feito

Adicionar um botão de microfone ao lado do campo "Descrição do Caso" que permite gravar áudio pelo navegador. Ao parar a gravação, o áudio é enviado à edge function `voice-to-text` (já existente, usa Whisper) e o texto transcrito é adicionado ao campo de descrição.

## Alteração

| Arquivo | Ação |
|---|---|
| `src/pages/ViabilidadeNovo.tsx` | Adicionar botão de microfone com lógica de gravação (MediaRecorder API) e chamada à function `voice-to-text` para transcrição |

## Detalhes técnicos

1. **Gravação**: Usar `navigator.mediaDevices.getUserMedia({ audio: true })` + `MediaRecorder` para capturar áudio em `audio/webm`
2. **Envio**: Converter blob para base64, chamar `supabase.functions.invoke('voice-to-text', { body: { audio: base64 } })`
3. **Resultado**: Append do texto transcrito ao `descricaoCaso` existente (não substituir, concatenar)
4. **UI**: Botão `Mic` / `Square` (parar) ao lado do label "Descrição do Caso", com indicador visual de gravação (pulsing red dot)
5. **Estados**: `isRecording`, `isTranscribing` com loading spinner durante transcrição
6. Nenhuma migração ou nova edge function necessária — `voice-to-text` já existe e aceita `{ audio: base64 }`

