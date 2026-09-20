-- Three additions to the profile page: a household size (used as the
-- default servings when assigning a meal in the planner instead of
-- always hardcoding 1), a preferred unit system (metric/imperial, used to
-- pick how the shopping list displays combined quantities and to steer
-- the AI recipe suggester), and a place to store an uploaded avatar.

alter table public.profiles
  add column household_size integer not null default 2,
  add column unit_system text not null default 'imperial';

alter table public.profiles
  add constraint profiles_household_size_check check (household_size between 1 and 20);

alter table public.profiles
  add constraint profiles_unit_system_check check (unit_system in ('metric', 'imperial'));

-- avatar_url already existed as a column since Day 1 but nothing ever
-- wrote to it — this bucket is what actually lets the profile page's
-- upload feature work. Same shape as the recipe-images bucket (see the
-- 20260916120000 migration): public read, one object per upload, stored
-- under <uploader's user id>/<random name> so storage.foldername(name)
-- alone is enough to check ownership without a separate table. Capped
-- smaller than recipe images (2MB, not 5MB) since an avatar never needs
-- to be that large.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  true,
  2097152, -- 2MB
  array['image/png', 'image/jpeg', 'image/webp', 'image/gif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "Avatars are publicly readable"
  on storage.objects for select
  using (bucket_id = 'avatars');

create policy "Users can upload their own avatar"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users can replace their own avatar"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users can delete their own avatar"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Lets someone delete their own account from the profile page without the
-- app needing Supabase's service-role key (which the app never holds —
-- every client here, browser and server, only ever uses the public anon
-- key; see lib/supabase/*.ts). security definer runs this with the
-- privileges of whoever owns the function (the migration-running role,
-- which can write to auth.users), while the `auth.uid() is null` guard
-- and hardcoded self-only `where id = auth.uid()` keep it from ever being
-- usable to touch anyone else's account, even though it runs elevated.
-- Deleting the auth.users row cascades to profiles, recipes, meal plans,
-- shopping lists, favorites, etc. via the on delete cascade foreign keys
-- already in place on every one of those tables.
create or replace function public.delete_own_account()
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  delete from auth.users where id = auth.uid();
end;
$$;

grant execute on function public.delete_own_account() to authenticated;
