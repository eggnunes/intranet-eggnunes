

## Criar grupo "Comunicações" e mover itens

### O que muda

**Arquivo: `src/components/AppSidebar.tsx`**

**1. Expandir o grupo existente "Comunicação & Avisos"** (id: `comunicacao`) — renomear para **"Comunicações"** e adicionar os itens que hoje estão em "Meu Painel":

Itens do novo grupo **Comunicações** (📢):
1. Documentos Úteis (`/documentos-uteis`)
2. Notificações (`/notificacoes`)
3. Fórum (`/forum`)
4. Mensagens (`/mensagens`)
5. Sugestões (`/sugestoes`)
6. Dashboard Sugestões (`/dashboard-sugestoes`)
7. Caixinha de Desabafo (`/caixinha-desabafo`)
8. Mensagens Encaminhadas (`/mensagens-encaminhadas`)
9. WhatsApp Avisos (`/whatsapp-avisos`)
10. Galeria de Eventos (`/galeria-eventos`)

**2. Remover esses itens de "Meu Painel"** — ficam apenas:
- Meu Perfil
- Solicitações
- Sobre o Escritório

**3. Manter todas as condições de acesso existentes** (nenhum desses itens tem `condition`, então ficam acessíveis a todos como já estavam).

