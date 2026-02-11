

## Plan: Fix Movement Count (Limited to 100) and Sidebar Scroll Reset

### Problem 1: Movements Showing 100 Instead of Real Count

**Root Cause**: The ADVBox API has **55,722 total movements**. The current code calls the `last-movements` endpoint which returns only the first 100 items plus a `totalCount` metadata field. However, the `totalCount` is not being reliably extracted because of how the response is parsed through multiple layers (`rawMovements -> movementsPayload -> extractTotalCount`).

The code does:
```
const movementsTotalFromApi =
  typeof (rawMovements as any)?.totalCount === 'number'
    ? (rawMovements as any).totalCount
    : typeof (movementsPayload as any)?.totalCount === 'number'
    ? (movementsPayload as any).totalCount
    : undefined;
```

When `movementsTotalFromApi` is `undefined`, it falls back to `movements.length` which is 100 (the first page only).

**Fix**:
1. In `ProcessosDashboard.tsx`, add explicit logging and robust extraction of `totalCount` from the API response at multiple levels
2. Add a direct fallback: if `totalCount` is found anywhere in the raw response, use it
3. Ensure the card label says "Movimentações no Período" with period filtering when a period is selected -- BUT since we only have 100 items locally and cannot filter 55K records client-side, we should clearly label it as "Movimentações Total (Advbox)" and show the API's `totalCount`
4. Remove the dependency on having all movements downloaded locally for counting

### Problem 2: Sidebar Scroll Resets on Navigation

**Root Cause**: The current scroll restoration in `AppSidebar.tsx` uses `useEffect` (which runs after paint) and `requestAnimationFrame`, but this is unreliable because:
- The `Collapsible` components with `defaultOpen` may re-mount/animate after the scroll restoration runs
- The scroll position ref can be overwritten by the scroll event handler firing during restoration
- The `useLayoutEffect` in `Layout.tsx` (line 44) sets `document.body.style.overflowY = 'scroll'` on every route change, which can interfere

**Fix**:
1. In `AppSidebar.tsx`, use `useLayoutEffect` instead of `useEffect` for scroll restoration (runs before paint)
2. Add a longer guard period for `isRestoringScroll` to prevent the `onScroll` handler from overwriting the saved position during restoration
3. Add multiple restoration attempts with increasing delays to handle Collapsible animation timing
4. Save scroll position to `sessionStorage` as a backup in case the ref is lost during component re-renders

---

### Technical Changes

**File 1: `src/pages/ProcessosDashboard.tsx`**
- Add more robust `totalCount` extraction with deep inspection of the response object
- Add console logs for debugging the exact response structure
- Ensure `setTotalMovements` is called with the correct value from API metadata
- Show "Movimentações Total" with the API `totalCount`, since period-filtering 55K records client-side is not feasible

**File 2: `src/components/AppSidebar.tsx`**
- Switch from `useEffect` to `useLayoutEffect` for scroll restoration
- Extend the `isRestoringScroll` guard timeout from 150ms to 500ms
- Add additional restoration attempts at 200ms and 400ms to handle Collapsible animations
- Store scroll position in a module-level `Map` keyed by pathname as backup

