

## Reorganizar Menu Lateral

### Alterações em `src/components/AppSidebar.tsx`

**1. Mover "Galeria de Eventos" de Comunicações para RH**
- Remover `{ icon: Camera, path: '/galeria-eventos', label: 'Galeria de Eventos' }` do grupo `comunicacao`
- Adicionar ao grupo `rh`

**2. Renomear grupo "Comunicações" para "Comunicação e Avisos"**
- Alterar `label: 'Comunicações'` para `label: 'Comunicação e Avisos'`

**3. Mover "Ferramentas & IA" para o início do menu**
- Reordenar o array `menuGroups` para que o grupo `ferramentas` fique logo após "Dashboard & Visão Geral" (posição 2)

**Nova ordem dos grupos:**
1. Dashboard & Visão Geral
2. **Ferramentas & IA** (movido para cá)
3. Negócios & CRM
4. Produção Jurídica
5. Financeiro
6. Recursos Humanos (agora com Galeria de Eventos)
7. Meu Painel
8. Viabilidade Jurídica
9. Comunicação e Avisos (renomeado, sem Galeria de Eventos)
10. Administrativo & Config.

