

## Plano: Ações de Exportação nas Respostas do Agente de IA

### Verificação do que já funciona

O chat do agente **já suporta** interações contínuas: após a IA dar uma resposta, você pode enviar outra mensagem para refinar o resultado, seja digitando ou usando o microfone. O anexo de arquivos também já está implementado. Não há nada quebrado nessa parte.

### O que será adicionado

Botões de ação em cada mensagem do assistente com 3 opções:

1. **Baixar como PDF** -- Gera um PDF formatado com o conteúdo da resposta e faz download
2. **Baixar como TXT** -- Gera um arquivo .txt com o conteúdo e faz download
3. **Salvar no Teams** -- Abre o dialog existente `SaveToTeamsDialog` para salvar na pasta do cliente no Microsoft Teams (cria a pasta automaticamente se não existir)

### Detalhes Técnicos

**Arquivo modificado:** `src/pages/AgenteChatPage.tsx`

- Adicionar botões de ação (ícones pequenos) abaixo de cada mensagem do assistente: `Download` (PDF), `FileText` (TXT), `CloudUpload` (Teams)
- Para PDF: usar `jsPDF` para gerar o documento com o conteúdo markdown convertido para texto
- Para TXT: criar Blob com o conteúdo e disparar download
- Para Teams: reutilizar o componente `SaveToTeamsDialog` já existente, passando o conteúdo como base64 e permitindo informar o nome do cliente
- Adicionar um pequeno input/dialog para informar o nome do cliente ao salvar no Teams

### Fluxo do Usuário

```text
Mensagem do Assistente
├── [📄 PDF]  → Download direto
├── [📝 TXT]  → Download direto
└── [☁️ Teams] → Dialog para escolher/criar pasta do cliente → Upload
```

