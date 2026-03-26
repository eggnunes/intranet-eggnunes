
## Correção definitiva: PDFs falhando nas mensagens internas

### Diagnóstico
O problema não parece ser falta de bucket ou permissão geral, porque o bucket `task-attachments` existe, tem políticas de upload/leitura, e há uploads de áudio funcionando nele. O ponto frágil está no fluxo de anexo da tela de mensagens:

- `src/pages/Mensagens.tsx` ainda faz upload de forma muito simples e frágil
- a correção anterior só melhorou o feedback, mas não corrigiu a causa estrutural
- qualquer falha no upload ou na geração da signed URL faz o arquivo virar `null`
- para PDFs, isso está resultando em `Nenhum arquivo foi enviado`

### O que vou implementar

#### 1. Fortalecer o upload de anexos em `src/pages/Mensagens.tsx`
Vou substituir o fluxo atual por um helper mais robusto para documentos:
- sanitizar nome do arquivo antes do upload
- validar tamanho e extensão/MIME antes de enviar
- definir `contentType` com fallback confiável para PDF/documentos
- enviar com opções explícitas (`cacheControl`, `upsert: false`)
- retornar erro detalhado real do storage em vez de só `null`

#### 2. Separar “falha no upload” de “falha na signed URL”
Hoje os dois problemas caem no mesmo fluxo. Vou separar:
- se o upload falhar: mostrar erro claro com motivo
- se o upload funcionar mas a signed URL falhar: tentar recuperar com nova estratégia antes de abortar

#### 3. Adicionar fallback para link do anexo
Como o bucket é privado, o sistema depende da signed URL no momento do envio. Vou implementar um fallback mais seguro para evitar perder o anexo por causa dessa etapa:
- tentar gerar signed URL após upload
- se falhar, tentar uma segunda estratégia controlada
- só bloquear envio quando realmente não houver link utilizável

#### 4. Melhorar o tratamento de PDFs especificamente
Vou incluir tratamento explícito para PDFs:
- fallback de MIME para `application/pdf`
- preservação segura da extensão `.pdf`
- mensagens de erro específicas para PDF, para parar de ficar genérico

#### 5. Não limpar anexos quando houver erro parcial
Vou garantir que:
- anexos que falharam permaneçam na área de envio
- anexos que subirem com sucesso possam seguir normalmente
- o usuário não perca os arquivos selecionados ao tentar novamente

### Arquivo principal
- `src/pages/Mensagens.tsx`

### Resultado esperado
- PDFs passam a ser enviados normalmente nas mensagens internas
- quando houver erro real, ele aparece com motivo mais claro
- o sistema deixa de falhar silenciosamente
- o usuário não perde os anexos ao tentar reenviar

### Detalhe técnico
O código atual já provou que:
- storage está ativo
- políticas existem
- uploads de áudio funcionam

Então a correção precisa focar no fluxo de anexos de documentos no frontend, especialmente no upload + geração da URL assinada, e não em permissões genéricas do sistema.
