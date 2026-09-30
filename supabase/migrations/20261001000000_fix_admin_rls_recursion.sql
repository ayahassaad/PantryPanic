-- Fixes a real bug introduced by 20260930000000_admin_role.sql: its two
-- "Admins can view all ___" policies check is_admin by querying
-- public.profiles directly inside their own USING clause — but that
-- inner query is ALSO subject to profiles' row-level security, so
-- Postgres has to re-evaluate profiles' policies to answer profiles'
-- own policy, which is the textbook recipe for a Postgres RLS error:
-- "infinite recursion detected in policy for relation profiles". This
-- was breaking every server-side read of profiles for every user (not
-- just admins) the moment that migration was applied — the app's own
-- queries all go through RLS and were silently coming back empty,
-- which is what caused dashboard and /admin to keep bouncing back to
-- /onboarding regardless of what onboarding_completed_at actually held.
--
-- The fix: move the "is this user an admin?" check into a SECURITY
-- DEFINER function. A security definer function runs with the
-- privileges of whoever owns it (the migration-running role), which
-- bypasses row-level security for ITS OWN internal query — so checking
-- is_admin from inside it never re-triggers profiles' policies, and
-- there's nothing left to recurse into. This is the standard, actually
-- safe way to write an "am I an admin" RLS check in Postgres/Supabase
-- (the same shape as delete_own_account() in profile_extensions.sql).
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(
    (select p.is_admin from public.profiles p where p.id = auth.uid()),
    false
  );
$$;

grant execute on function public.is_admin() to authenticated;

drop policy if exists "Admins can view all profiles" on public.profiles;
create policy "Admins can view all profiles"
  on public.profiles for select
  using (public.is_admin());

drop policy if exists "Admins can view all recipes" on public.recipes;
create policy "Admins can view all recipes"
  on public.recipes for select
  using (public.is_admin());
