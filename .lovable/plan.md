

## Sistema de Folgas + Painel "Quem Nao Esta no Escritorio" no Dashboard

### Resumo

Implementar um sistema completo de gestao de folgas dentro do modulo de RH, onde usuarios administrativos podem cadastrar folgas para advogados. Cada colaborador visualiza suas proprias folgas no perfil unificado. Alem disso, o Dashboard principal exibira um painel consolidado mostrando quem nao esta no escritorio hoje (folga, home office ou ferias).

---

### 1. Banco de Dados

**Nova tabela `rh_folgas`:**

| Coluna | Tipo | Descricao |
|---|---|---|
| id | uuid PK | Identificador |
| colaborador_id | uuid FK profiles(id) | Colaborador que recebera a folga |
| data_folga | date NOT NULL | Data da folga |
| motivo | text | Motivo (batimento de metas, premio, etc.) |
| observacoes | text | Observacoes opcionais |
| created_by | uuid FK profiles(id) | Quem cadastrou (administrativo) |
| created_at | timestamptz DEFAULT now() | Data de criacao |

**Constraint:** UNIQUE(colaborador_id, data_folga) para evitar duplicidade.

**RLS Policies:**
- SELECT: Usuarios aprovados podem ver suas proprias folgas (`colaborador_id = auth.uid()`). Admins/socios veem todas.
- INSERT/UPDATE/DELETE: Apenas admins e socios (via `is_admin_or_socio(auth.uid())`). Tambem permitir usuarios com position = 'administrativo'.

---

### 2. Componente de Gestao de Folgas (`RHFolgas.tsx`)

Novo componente dentro de `src/components/rh/` com:

- **Tabela** listando todas as folgas cadastradas com filtros por colaborador e periodo
- **Dialog** para cadastrar nova folga: selecao de colaborador (apenas advogados), data, motivo e observacoes
- **Edicao e exclusao** de folgas existentes
- Apenas usuarios com `position === 'administrativo'` ou admins/socios tem acesso

Sera adicionado ao menu lateral do RH em "Gestao de Pessoas" como item "Folgas".

---

### 3. Integracao no Perfil Unificado do Colaborador

No `ColaboradorPerfilUnificado.tsx`, na aba "Carreira":

- Adicionar uma nova secao "Historico de Folgas" (similar ao "Historico de Ferias")
- Buscar dados de `rh_folgas` para o colaborador em questao
- Exibir tabela com data, motivo e quem cadastrou
- Card de metrica no topo: total de folgas no ano

---

### 4. Painel "Ausencias do Dia" no Dashboard

No `Dashboard.tsx`, adicionar uma nova secao logo apos os alertas de tarefas, com o titulo "Quem nao esta no escritorio hoje". Este painel consulta 3 fontes:

1. **Home Office:** `home_office_schedules` onde `day_of_week` = dia da semana atual, `month` = mes atual, `year` = ano atual
2. **Folgas:** `rh_folgas` onde `data_folga` = hoje
3. **Ferias:** `vacation_requests` onde `start_date <= hoje AND end_date >= hoje AND status = 'approved'`

Exibir cards agrupados por tipo com avatar, nome e badge indicando o motivo (Home Office / Folga / Ferias). Se ninguem estiver ausente, exibir mensagem "Todos presentes hoje".

---

### Detalhes Tecnicos

**Arquivos a criar:**
- `src/components/rh/RHFolgas.tsx` - Componente CRUD de folgas

**Arquivos a modificar:**
- Migracao SQL: criar tabela `rh_folgas` com RLS
- `src/components/rh/RHMenus.tsx` - Adicionar item "Folgas" em "Gestao de Pessoas"
- `src/components/rh/index.ts` - Exportar `RHFolgas`
- `src/pages/RH.tsx` - Adicionar case 'folgas' no switch e import
- `src/components/rh/ColaboradorPerfilUnificado.tsx` - Buscar e exibir folgas na aba Carreira + card metrica
- `src/pages/Dashboard.tsx` - Novo painel de ausencias do dia (home office + folga + ferias)

**Padrao de fetch de profiles:** Usar o padrao de duas etapas (buscar IDs, depois buscar profiles em bulk) para respeitar RLS, conforme ja feito no sistema de home office.

**Permissoes:** A funcao `is_admin_or_socio` ja existe no banco. Para o position 'administrativo', a RLS verificara `(SELECT position FROM profiles WHERE id = auth.uid()) = 'administrativo'`.

