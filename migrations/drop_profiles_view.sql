-- FINAL STEP of the profiles → users rename (expand/contract).
--
-- Do NOT run this until the migrated frontend is DEPLOYED. It removes the last compatibility
-- shim (`public.profiles` view) that older frontend builds relied on. The current frontend no
-- longer names the view anywhere: self-profile reads go to the backend (GET /auth/me,
-- GET /profiles/{id}), role finalization to POST /profiles/me/finalize-role, doctor revoke to
-- PATCH /profiles/{id}/active, and the few remaining direct reads target `public.users`.
--
-- Coordinate with the API repo (api-medicos-por-venezuela): its DB functions already reference
-- `public.users`, so once this frontend is live, dropping the view is safe.
--
-- Order of operations:
--   1. Deploy this frontend (this branch) to production.
--   2. Confirm no client still hits `public.profiles` (logs / PostgREST).
--   3. Run the statement below.

drop view if exists public.profiles;
