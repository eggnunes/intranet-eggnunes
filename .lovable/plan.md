

## Plan: Fix "Movimentações no Período" Showing 100 Instead of Real Count

### Root Cause Analysis

After tracing through the complete data flow (edge function -> supabase.functions.invoke -> dashboard parsing), the problem is a combination of:

1. **The `last-movements` endpoint** fetches 100 items + a `totalCount` from the API metadata, but the multi-layer wrapping (`getCachedOrFetch` wrapper -> JSON response -> `supabase.functions.invoke` wrapper -> dashboard parsing with `findTotalCount`) makes extraction unreliable
2. **Edge function logs** show `movements-full` being called (which tries to download all 55,000+ records and gets rate-limited/times out) rather than `last-movements`, suggesting the deployed code may still be calling the wrong endpoint
3. **Fallback cascade**: when `totalCount` extraction fails at any layer, it falls back to `movements.length` which is 100 (first page only)

### Solution: Dedicated Count-Only Endpoint

Instead of trying to extract `totalCount` from a complex nested response, create a simple dedicated endpoint that returns ONLY the count -- fast, lightweight, and impossible to misparse.

### Technical Changes

**File 1: `supabase/functions/advbox-integration/index.ts`**
- Add a new case `'movements-count'` in the switch block
- This endpoint calls the ADVBox API with `limit=1&offset=0` (minimal data transfer)
- Returns ONLY `{ totalCount: number }` -- a flat, simple response
- Has its own cache key with short TTL

**File 2: `src/pages/ProcessosDashboard.tsx`**
- Add a **separate, parallel** call to `advbox-integration/movements-count`
- Parse the simple `{ totalCount }` response directly
- Use this value for the "Movimentacoes" card instead of trying to extract it from the movements data response
- Keep the existing `last-movements` call for the actual movement items (for display in lists/charts)
- Remove the complex `findTotalCount` recursive function -- no longer needed for this card
- Fallback: if the count endpoint fails, show "N/A" or the cached value, never show 100 as if it were the real total

### Why This Approach Works
- The count endpoint returns a flat `{ totalCount: 55733 }` -- no nesting, no arrays, no ambiguity
- The API call uses `limit=1`, so it completes in under 1 second (no pagination, no rate limiting)
- Completely independent from the movements data fetch, so timeouts on data loading don't affect the count
- Easy to debug: if count is wrong, there's only one place to look

