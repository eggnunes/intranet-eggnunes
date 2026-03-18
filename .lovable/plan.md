

# Ranking de Vendedores (Gamificação)

## O que falta
Não existe ranking de vendedores/closers no projeto. O ranking existente (`FinanceiroRankingClientes`) é de clientes por receita, algo completamente diferente.

## Plano

### 1. Instalar framer-motion
Adicionar dependência ao package.json.

### 2. Novo componente `CRMRanking.tsx`
- Busca dados de `crm_deals` agrupados por `owner_id` (responsável)
- Calcula métricas por vendedor: total de chamados (atividades tipo call), agendamentos (atividades tipo meeting), fechamentos (deals won), taxa de conversão (won/total)
- **4 botões** para alternar critério: Chamados, Agendamentos, Fechamentos, Conversão
- **Top 10** em cards verticais com posição, nome, avatar e valor da métrica
- **Top 3** com medalhas dourada/prata/bronze e destaque visual (borda colorida, scale maior)
- **Framer motion**: `AnimatePresence` + `motion.div` com `layout` prop para reordenação animada, stagger de 0.05s na entrada

### 3. Integrar ao CRM Dashboard
- Nova aba "Ranking" com ícone `Trophy` no `CRMDashboard.tsx`
- Exportar no `index.ts`

### Arquivos
1. `package.json` — adicionar framer-motion
2. `src/components/crm/CRMRanking.tsx` (novo)
3. `src/components/crm/CRMDashboard.tsx` — adicionar aba
4. `src/components/crm/index.ts` — exportar

