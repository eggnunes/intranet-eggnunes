
## Reorganização do Menu Lateral + Criador de Pasta de Cliente no Teams

### Mudanças no menu (`src/components/AppSidebar.tsx`)

**1. Códigos TOTP → Produção Jurídica**
- Mover `{ icon: KeyRound, path: '/codigos-autenticacao', label: 'Códigos TOTP' }` para o grupo `producao-juridica`

**2. Arquivos Teams → Novo grupo próprio**
- Criar grupo **"Arquivos do Escritório"** (emoji 📁, id `arquivos`) com:
  - Arquivos Teams (`/arquivos-teams`)
  - Criar Pasta de Cliente (nova rota `/criar-pasta-cliente`)
- Posicionar após "Meu Painel" e antes de "Viabilidade Jurídica" — acesso geral para todos

**3. Parceiros → dentro de Negócios & CRM**
- Mover `{ icon: Handshake, path: '/parceiros', label: 'Parceiros' }` para o grupo `negocios`

**4. Sala de Reunião → dentro de Meu Painel**
- Faz mais sentido como recurso pessoal/agendamento — mover para `meu-painel`

**5. Copa/Cozinha → dentro de RH (renomeado)**
- Renomear grupo RH para **"RH & Administrativo"**
- Mover `Copa/Cozinha` para este grupo

**6. Grupo Administrativo simplificado**
- Fica apenas com: Admin, Cadastros Úteis (itens de configuração real)

### Nova funcionalidade: Criar Pasta de Cliente no Teams

**Nova página `src/pages/CriarPastaCliente.tsx`:**
- Campo de nome do cliente
- Seletor de site Teams (Jurídico, Comercial, etc.) — padrão: Jurídico
- Caminho padrão: `Operacional - Clientes/{nome do cliente}`
- Antes de criar, verifica se já existe pasta com mesmo nome via `findFolderByPath`
- Se existir, mostra alerta "Já existe pasta para este cliente" com link para abrir
- Se não existir, cria via `createFolderByPath`
- Usa o hook `useTeamsUpload` já existente (que já tem `findFolderByPath`, `createFolderByPath`, `findOrCreateClientFolder`)

**Rota em `src/App.tsx`:**
- Adicionar `/criar-pasta-cliente` → `CriarPastaCliente`

### Arquivos a editar/criar
- `src/components/AppSidebar.tsx` — reorganizar itens entre grupos
- `src/pages/CriarPastaCliente.tsx` — nova página
- `src/App.tsx` — nova rota

### Nova ordem dos grupos
1. Dashboard & Visão Geral
2. Ferramentas & IA
3. Negócios & CRM (+ Parceiros)
4. Produção Jurídica (+ Códigos TOTP)
5. Financeiro
6. RH & Administrativo (+ Copa/Cozinha)
7. Meu Painel (+ Sala de Reunião)
8. 📁 Arquivos do Escritório (novo — Teams + Criar Pasta)
9. Viabilidade Jurídica
10. Comunicação e Avisos
11. Administrativo & Config. (apenas Admin + Cadastros Úteis)
