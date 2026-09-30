-- Same gap as 20260914113448_authenticated_table_grants.sql, just missed
-- for this newer table: RLS policies (see 20261001010000_page_visits.sql)
-- decide which ROWS a role can touch, but Postgres separately requires a
-- baseline GRANT before a role can reach the table at all. Without this,
-- every insert from the tracker was failing with "permission denied for
-- table page_visits" before its RLS policy ever got a chance to run —
-- which is why total visits stayed at 0 even though the table, the
-- policies, and the tracker code were all otherwise correct.
grant insert on public.page_visits to anon, authenticated;
grant select on public.page_visits to authenticated;
