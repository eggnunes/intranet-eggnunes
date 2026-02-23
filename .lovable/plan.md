

## Atualizar Notificacoes de Novidades no Cabecalho

### Resumo

Inserir notificacoes pendentes na tabela `intranet_updates` para que os usuarios vejam as novidades recentes ao clicar no icone de estrela no cabecalho. Tambem criar uma interface administrativa para facilitar o cadastro de futuras atualizacoes.

---

### Notificacoes a Inserir

Apenas **2 registros** na tabela `intranet_updates`:

| # | Titulo | Categoria | Descricao |
|---|---|---|---|
| 1 | Sistema de Gestao de Folgas | feature | Novo modulo para cadastrar e gerenciar folgas de colaboradores, com dashboard analitico (graficos e metricas), filtros avancados e historico individual no perfil. Acesse pelo menu Equipe e RH > Gestao de Folgas. O Dashboard principal tambem exibe quem nao esta no escritorio hoje. |
| 2 | Publicacoes do Diario da Justica Eletronico Nacional | feature | Novo sistema de monitoramento de publicacoes judiciais via DataJud e Comunica PJe/DJEN. Acompanhe comunicacoes judiciais por processo ou por advogado, com filtros por fonte e busca textual. |

---

### Interface Administrativa

Adicionar uma secao "Gerenciar Atualizacoes" no painel Admin (`src/pages/Admin.tsx`) para que administradores possam cadastrar novas notificacoes de funcionalidades diretamente pela interface, sem depender de migracoes SQL.

Campos do formulario:
- Titulo (texto)
- Descricao (textarea)
- Categoria (select: Nova Funcionalidade, Melhoria, Correcao, Atualizacao)

---

### Detalhes Tecnicos

**Migracao SQL:**
- INSERT de 2 registros em `intranet_updates` (titulo, descricao, categoria, created_by usando o admin principal)

**Arquivo a modificar:**
- `src/pages/Admin.tsx` — Adicionar secao para gerenciar atualizacoes (CRUD na tabela `intranet_updates`) com formulario de cadastro e listagem das atualizacoes existentes

