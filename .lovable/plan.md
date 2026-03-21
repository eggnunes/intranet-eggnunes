

## Fix: CRM Contacts page blank

### Root Cause

Line 489 in `CRMContactsList.tsx`:
```tsx
<SelectItem value="">Todas profissões</SelectItem>
```

Radix UI's `Select` component does not accept empty string `""` as a `SelectItem` value. This causes an unhandled error that crashes the entire component, resulting in a blank page.

### Fix

Replace `value=""` with `value="all"` and update the filter logic accordingly:

**File:** `src/components/crm/CRMContactsList.tsx`

1. Change `<SelectItem value="">` to `<SelectItem value="all">`
2. Change `setProfissaoFilter('')` calls to `setProfissaoFilter('all')`
3. Initialize state: `useState<string>('all')` instead of `useState<string>('')`
4. Update filter logic: `const matchesProfissao = profissaoFilter === 'all' || contact.job_title === profissaoFilter`

This is a one-file fix, no other changes needed.

