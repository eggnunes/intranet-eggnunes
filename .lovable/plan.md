
## Plan: Fix ADVBox Processes, Movements Filters, and Dashboard Chart

### Issues Identified

1. **Processos page showing incomplete data for recent processes**: The dashboard cache strips `customers` and `folder` fields when there are more than 5,000 lawsuits (to save localStorage space). The Processos page reads from this same cache on initial load, so it shows incomplete records until the background refresh completes.

2. **Movimentacoes - period filter changes the graph instead of filtering the list**: Both the graph and list use the same `filteredMovements` array, so period filtering affects both. However, only 100 movements are loaded (from `last-movements` endpoint), meaning period filters on the list show near-empty results. The real problem is the system fetches `movements-full` which tries to download all 55,000+ records and times out, falling back to only 100.

3. **Movimentacoes - "Tipo de Acao" and "Area" checkboxes show "prohibited" symbol**: The individual checkboxes have `disabled={showAllActionTypes}` / `disabled={showAllAreas}`, which disables them when "Todos" is checked. This is confusing UX -- when clicking an individual item, it should automatically uncheck "Todos" and enable selection.

4. **Movimentacoes - "Responsavel" filter shows only "Todos"**: The `responsibles` list is derived from `lawsuits` loaded from cache. If the cache is minimal (stripped fields) or empty, no responsible names are available to populate the filter.

5. **Dashboard "Processos por Responsavel" chart shows one big green block**: The `responsible` field IS in the cache, but when most lawsuits don't have a `responsible` value (or it's stripped during caching), they all map to "Sem responsavel", creating one massive bar. More likely, the chart's `XAxis` with `angle={-45}` and many entries causes rendering issues -- the label text overlaps into a solid green block.

---

### Technical Changes

**File 1: `src/pages/ProcessosDashboard.tsx`** (cache fix)
- Add `customers` and `folder` to the minimal cache fields (lines 949-961). Even for >5000 records, these fields are essential for the Processos page display. If localStorage quota is exceeded, fallback gracefully.

**File 2: `src/pages/MovimentacoesAdvbox.tsx`** (multiple filter fixes)
- **Fix disabled checkboxes**: Change the `disabled={showAllActionTypes}` / `disabled={showAllAreas}` / `disabled={showAllResponsibles}` / `disabled={showAllStatuses}` logic on individual checkboxes. Instead of disabling, clicking an individual checkbox should automatically set `showAll*` to `false` and add the item to the selected list. This removes the "prohibited" cursor.
- **Fix Responsavel filter being empty**: The `responsibles` array is derived from `lawsuits` which come from cache. Ensure the cache includes `responsible` field (it does in ProcessosDashboard, but MovimentacoesAdvbox's `loadLawsuitsFromCache` extracts `lawsuits` array which may be minimal). Add a fallback: also derive responsibles from the movements' associated lawsuits fetched in the background refresh.
- **Fix period filter behavior**: The period filter currently filters both the graph and the list. Make the period filter apply ONLY to the movements list, not the timeline chart. The chart should always show the last 30 days of data regardless of the list filter.
- **Fix Status filter**: Currently `statuses` is set to `lawsuits.map(l => l.group)` (same as areas). This should be actual process status (Ativo/Inativo) or the `group` field needs to be labeled differently. Since the API doesn't provide a separate "status" concept beyond active/inactive, change the Status filter to filter by Ativo/Inativo based on whether the associated lawsuit has a closure date.

**File 3: `src/pages/ProcessosDashboard.tsx`** (Responsavel chart fix)
- The "Processos por Responsavel" chart renders as a solid green block because there are potentially hundreds of responsibles and the vertical bar chart with rotated X-axis labels creates visual overlap.
- Fix: Switch to a **horizontal bar chart** (like the "Top 10 Tipos de Acao" chart) showing only the **top 15 responsibles**, with the Y-axis showing names. This prevents label overlap and makes the chart readable.

---

### Summary of Changes

| Issue | File | Fix |
|-------|------|-----|
| Incomplete process data | ProcessosDashboard.tsx | Add `customers`, `folder` to minimal cache |
| Disabled filter checkboxes | MovimentacoesAdvbox.tsx | Remove `disabled` prop, auto-uncheck "Todos" on selection |
| Empty Responsavel filter | MovimentacoesAdvbox.tsx | Ensure lawsuits with `responsible` field are loaded |
| Period filter affects graph | MovimentacoesAdvbox.tsx | Separate graph data from list filter |
| Status filter = Area filter | MovimentacoesAdvbox.tsx | Change Status to Ativo/Inativo logic |
| Responsavel chart broken | ProcessosDashboard.tsx | Switch to horizontal bar, top 15 |
