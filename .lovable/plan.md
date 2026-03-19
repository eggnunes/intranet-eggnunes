

# Reestruturação Modular do Menu Lateral (Sidebar)

## Resumo
Reorganizar o componente `AppSidebar.tsx` para seguir a nova estrutura de 10 grupos departamentais definida no documento, com persistencia de estado via localStorage e auto-abertura do grupo ativo.

## Alteracao unica: `src/components/AppSidebar.tsx`

Nenhuma rota sera alterada. Nenhuma pagina sera removida. Apenas a organizacao visual do menu lateral sera modificada.

### Nova estrutura dos 10 grupos (ordem exata do documento)

```text
1. Dashboard & Visao Geral (2 itens)
   /dashboard, /historico

2. Negocios & CRM (7 itens)
   /crm, /negocios/tv, /setor-comercial, /lead-tracking,
   /negocios/marketing, /setor-comercial/dashboard (redirect to /setor-comercial),
   /setor-comercial/contratos

3. Producao Juridica (12 itens)
   /processos, /controle-prazos, /tarefas-advbox, /processos-ativos,
   /movimentacoes-advbox, /pesquisa-jurisprudencia, /publicacoes-dje,
   /advbox-analytics (redirect), /portais-tribunais, /decisoes-favoraveis,
   /publicacoes, /relatorios-produtividade-tarefas (redirect)

4. Financeiro (5 itens)
   /financeiro, /asaas, /relatorios-financeiros, /gestao-cobrancas,
   /financeiro/admin

5. Recursos Humanos (10 itens)
   /rh, /equipe, /aniversarios, /pesquisa-humor, /mural-avisos,
   /ferias, /gestao-folgas, /contratacao, /home-office,
   /aniversarios-clientes

6. Meu Painel (11 itens)
   /profile, /notificacoes, /documentos-uteis, /forum, /mensagens,
   /solicitacoes-administrativas, /sugestoes, /dashboard-sugestoes,
   /caixinha-desabafo, /mensagens-encaminhadas, /sobre-escritorio

7. Viabilidade Juridica (2 itens)
   /viabilidade, /viabilidade/novo

8. Comunicacao & Avisos (2 itens)
   /galeria-eventos, /whatsapp-avisos

9. Ferramentas & IA (6 itens)
   /assistente-ia, /agentes-ia, /tools/rotadoc, /integracoes,
   /corretor-portugues, /gerador-qrcode

10. Administrativo & Configuracoes (7 itens, admin-only items with badges)
    /admin, /cadastros-uteis, /codigos-autenticacao, /arquivos-teams,
    /parceiros, /sala-reuniao, /copa-cozinha
```

### Comportamento tecnico

1. **Estado persistente via localStorage**: Salvar quais grupos estao expandidos em `localStorage` com chave `sidebar-open-groups`. Restaurar ao montar o componente.

2. **Auto-abertura do grupo ativo**: Ao navegar para uma pagina, o grupo que contem essa rota abre automaticamente (mesmo que o usuario tenha fechado antes).

3. **Icones por grupo**: Cada grupo tera um icone representativo conforme o documento (Home, Briefcase, Scale, DollarSign, Users, User, CheckCircle, MessageSquare, Sparkles, Settings).

4. **Itens condicionais mantidos**: Lead Tracking (socio only), Controle de Prazos (socio/admin), RH (socio/admin), Financeiro Admin (socio/admin), Admin (admin only com badge).

5. **Scroll preservation**: Manter a logica existente de preservacao de scroll.

6. **Responsividade**: A sidebar ja usa o componente `Sidebar` do shadcn com `collapsible="icon"`, que funciona em mobile como drawer. Nenhuma mudanca estrutural necessaria.

### Itens que mudam de posicao vs. menu atual
- Mural de Avisos sai de "Inicio" e vai para "Recursos Humanos"
- Onboarding nao aparece no documento (sera incluido em RH como esta hoje)
- TV Mode adicionado em "Negocios & CRM" (nao existia no menu)
- Setor Comercial Dashboard adicionado (ja existia na rota, nao no menu)
- Dashboard Sugestoes move para "Meu Painel" (estava so em Admin)
- Varios itens do Advbox movem para "Producao Juridica"

