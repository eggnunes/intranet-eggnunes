

# Plano: Indicador de Prazos Vencidos + Exportação Excel/PDF

## Arquivo: `src/pages/ControlePrazos.tsx`

### 1. Indicador visual de prazos vencidos (vermelho)

- Adicionar lógica `isPrazoVencido`: prazo fatal < hoje AND não verificado AND não concluído
- Na `TableRow`, aplicar `bg-red-50 dark:bg-red-950/20 border-l-4 border-l-red-500` quando vencido
- No badge (`getVerificacaoBadge`), quando vencido e pendente, mostrar badge vermelho "VENCIDO" em vez de amarelo "Pendente"
- Na coluna "Prazo Fatal", colorir texto em vermelho (`text-red-600 font-bold`) quando vencido
- Adicionar novo card de stats: "Prazos Vencidos" com ícone `AlertTriangle` em vermelho, contando tarefas vencidas não verificadas
- Adicionar opção "vencido" no filtro de status

### 2. Exportação Excel e PDF

- Adicionar dois botões no header: "Exportar Excel" e "Exportar PDF"
- **Excel**: usar `xlsx` (já instalado) — exporta `filteredTasks` com colunas: Nº Processo, Tarefa, Advogado, Data Publicação, Prazo Interno, Prazo Fatal, Status
- **PDF**: usar `jspdf` + `jspdf-autotable` (já instalados) — gera tabela formatada com logo e título
- Ambos exportam os dados filtrados (respeitam filtros ativos)
- Importar `FileSpreadsheet` e `FileText` do lucide para ícones dos botões

