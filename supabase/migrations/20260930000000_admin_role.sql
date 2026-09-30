-- Adds an admin role: a plain boolean on profiles rather than a separate
-- roles table, since this app only ever needs one bit ("can see the admin
-- panel"), not a general permissions system.
alter table public.profiles
  add column if not exists is_admin boolean not null default false;

-- Lets an admin see every user's profile (name, join date, household
-- size, admin flag) for the admin panel's user list — without this, the
-- existing "Users can view their own profile" policy from the very first
-- profiles migration would still cap even an admin to just their own row.
-- Multiple permissive policies on the same table/command are OR'd
-- together by Postgres, so this only ever *adds* visibility, never
-- removes the self-view every user already has.
--
-- The inner `exists` subquery re-queries profiles for the CURRENT user's
-- own row to check is_admin — that does NOT recurse forever: the "Users
-- can view their own profile" policy already grants a user select access
-- to their own row regardless of is_admin, so the inner query resolves
-- through that policy without ever needing this admin policy to answer
-- itself. This is the standard, safe way to write an "is admin" RLS
-- check in Postgres/Supabase.
create policy "Admins can view all profiles"
  on public.profiles for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.is_admin
    )
  );

-- Same reasoning, for the admin panel's recipe-count stats: without this,
-- an admin querying recipes would still only see their own plus the
-- ownerless starter/seed recipes, same as any other user.
create policy "Admins can view all recipes"
  on public.recipes for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.is_admin
    )
  );

-- The one-time part of "make ayah.assaad@icloud.com an admin" — profiles
-- has no email column of its own (email only lives on auth.users, which
-- the app's anon-key client can never query directly), so this looks the
-- id up from auth.users, which this migration CAN read: it runs with the
-- privileges of whoever applies the migration (the Supabase CLI/dashboard
-- role), not the app's restricted anon key. If no user has signed up with
-- this email yet, this simply updates zero rows rather than erroring —
-- safe to re-run once they have.
update public.profiles
set is_admin = true
where id = (select id from auth.users where email = 'ayah.assaad@icloud.com');
