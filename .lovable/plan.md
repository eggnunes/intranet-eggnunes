
## Plano: Adicionar Filtros de Data para "Data de Publicação" e "Prazo Fatal"

### Análise Atual
O arquivo `src/pages/ControlePrazos.tsx` já possui:
- Filtro de range de data por **"Data de Publicação"** (`filterDateFrom`/`filterDateTo` linhas 124-125)
- Lógica de filtro para essas datas (linhas 291-300)
- UI com 2 Popovers/Calendar para seleção (linhas 560-594)

O usuário solicita filtro também por **"Prazo Fatal"** (data range).

### Alterações Necessárias

**1. Adicionar Estados de Filtro (linhas 120-125)**
- `filterPrazoFatalFrom: Date | undefined` — início do range de prazo fatal
- `filterPrazoFatalTo: Date | undefined` — fim do range de prazo fatal

**2. Expandir Lógica de Filtro (linhas 276-303)**
- Adicionar condições para filtrar por `prazo_fatal` (semelhante ao `data_publicacao`)
- Range: `task.prazo_fatal >= filterPrazoFatalFrom` e `task.prazo_fatal <= filterPrazoFatalTo`

**3. Adicionar Dependência no useEffect (linha 308)**
- Incluir `filterPrazoFatalFrom` e `filterPrazoFatalTo` nas dependências

**4. Expandir UI dos Filtros (linhas 515-612)**
- Reordenar grid de 5 colunas para **6 colunas** (adicionar 2 novos botões):
  1. Advogado
  2. Tipo de Tarefa
  3. Status
  4. Data Publicação (Início)
  5. Data Publicação (Fim)
  6. Prazo Fatal (Início) — **NOVO**
  7. Prazo Fatal (Fim) — **NOVO**
- Ou reorganizar em 2 linhas para melhor visualização
- Adicionar 2 Popovers com Calendar para seleção de Prazo Fatal

**5. Atualizar Botão "Limpar Filtros" (linhas 596-611)**
- Resetar também `filterPrazoFatalFrom` e `filterPrazoFatalTo`

### Impacto
- Nenhuma mudança na estrutura de dados
- Apenas lógica de filtro client-side adicional
- Melhora a capacidade de exploração dos dados pela coordenadora
