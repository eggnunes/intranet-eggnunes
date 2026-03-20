

## Problem

The storage bucket `rh-documentos` has RLS policies that check `admin_permissions` table instead of `user_roles`. Letícia has `admin` role in `user_roles` but has no entry in `admin_permissions`, so the storage upload is blocked by RLS.

The table-level policies (`rh_documentos`, `rh_pastas_documentos`) correctly use `has_role()` which checks `user_roles` — those work fine. But the storage upload fails before the table insert even happens.

## Fix

Run a migration to drop and recreate the 3 storage policies for `rh-documentos` bucket, replacing the `admin_permissions` check with `has_role(auth.uid(), 'admin')` to be consistent with the table-level policies:

**Migration SQL:**
- DROP the 3 existing policies: SELECT, INSERT, DELETE for `rh-documentos`
- Recreate them using `has_role(auth.uid(), 'admin') OR is_socio_or_rafael(auth.uid())` instead of the `admin_permissions` subquery
- Keep the user self-access SELECT policy unchanged

No frontend code changes needed.

