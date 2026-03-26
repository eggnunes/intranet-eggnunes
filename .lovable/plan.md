

## Anexos no Mural de Avisos + Integração com Documentos Úteis

### O que será feito

1. **Criar tabela `announcement_attachments`** para armazenar múltiplos anexos por aviso (qualquer tipo: imagem, PDF, vídeo, Word, link)
2. **Atualizar formulário de criação** para permitir upload de múltiplos arquivos + campo de link externo
3. **Exibir anexos nos avisos** com preview inline (imagens/vídeos) e botões de download
4. **Botão "Salvar em Documentos Úteis"** em cada anexo, que copia o arquivo para a tabela `useful_documents`

### Alterações

#### 1. Migration SQL
```sql
CREATE TABLE public.announcement_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  announcement_id UUID REFERENCES announcements(id) ON DELETE CASCADE NOT NULL,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT, -- mime type
  file_size BIGINT,
  is_link BOOLEAN DEFAULT false, -- true = URL externa, false = upload
  uploaded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE announcement_attachments ENABLE ROW LEVEL SECURITY;

-- Todos aprovados podem ver
CREATE POLICY "Approved users can view attachments"
  ON announcement_attachments FOR SELECT TO authenticated
  USING (is_approved(auth.uid()));

-- Admins/sócios podem inserir e deletar
CREATE POLICY "Admins can insert attachments"
  ON announcement_attachments FOR INSERT TO authenticated
  WITH CHECK (is_admin_or_socio(auth.uid()));

CREATE POLICY "Admins can delete attachments"
  ON announcement_attachments FOR DELETE TO authenticated
  USING (is_admin_or_socio(auth.uid()));
```

Bucket `announcement-attachments` já existe (listado nos buckets). Criar políticas de storage RLS para ele.

#### 2. Formulário de criação (`src/pages/MuralAvisos.tsx`)
- Adicionar estado para lista de arquivos pendentes (`File[]`) e lista de links (`string[]`)
- Área de upload drag-and-drop com `accept` amplo (imagens, vídeos, PDFs, docs, etc.)
- Campo de input para adicionar links externos (YouTube, Google Drive, etc.)
- No `handleCreate`: após inserir o aviso, fazer upload dos arquivos para o bucket `announcement-attachments` e inserir registros na tabela `announcement_attachments`

#### 3. Exibição dos anexos nos cards de aviso
- Buscar anexos junto com avisos (query separada ou join)
- Para imagens: thumbnail inline
- Para vídeos: player ou link
- Para links: botão com ícone de link externo
- Para PDFs/docs: ícone do tipo + botão download
- Cada anexo terá botão "Salvar em Documentos Úteis" (visível para admins)

#### 4. Botão "Salvar em Documentos Úteis"
- Ao clicar, insere registro na tabela `useful_documents` com:
  - `title`: nome do arquivo
  - `file_url`: mesmo path do storage (reutiliza o arquivo, sem duplicar)
  - `uploaded_by`: usuário atual
- Se for link externo, salva o link como `file_url`
- Toast de confirmação

### Arquivos modificados
- `src/pages/MuralAvisos.tsx` — formulário, exibição de anexos, botão documentos úteis
- Migration SQL — tabela + RLS + storage policies

### Resultado
- Avisos podem ter múltiplos anexos de qualquer tipo
- Anexos são exibidos inline nos cards
- Qualquer anexo pode ser salvo nos Documentos Úteis com um clique

