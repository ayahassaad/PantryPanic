-- Favorites: a per-user bookmark on a recipe, independent of who owns it
-- (you can favorite your own recipe, someone else's public seed recipe,
-- or an AI suggestion). Presence of a row IS the favorite — there's
-- nothing to update, only insert (favorite) or delete (unfavorite).
create table public.recipe_favorites (
  owner_id uuid not null references auth.users(id) on delete cascade,
  recipe_id uuid not null references public.recipes(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (owner_id, recipe_id)
);

-- Not strictly needed for the primary key lookup direction (owner_id ->
-- recipe_id), but the delete-cascade above walks this table by recipe_id
-- whenever a recipe is deleted, so it's worth indexing.
create index recipe_favorites_recipe_id_idx on public.recipe_favorites (recipe_id);

alter table public.recipe_favorites enable row level security;

create policy "Users can see their own favorites"
  on public.recipe_favorites for select
  using (owner_id = auth.uid());

create policy "Users can favorite recipes themselves"
  on public.recipe_favorites for insert
  with check (owner_id = auth.uid());

create policy "Users can unfavorite their own favorites"
  on public.recipe_favorites for delete
  using (owner_id = auth.uid());

-- See the 20260914113448 migration's note: RLS alone doesn't let the
-- `authenticated` role touch the table at all without this grant too.
grant select, insert, delete on public.recipe_favorites to authenticated;

-- Recipe images: a public Storage bucket, one object per uploaded image,
-- stored under <uploader's user id>/<random name> so ownership can be
-- checked from the path alone (see storage.foldername below) without a
-- separate ownership table. Public read is fine here — recipe photos
-- aren't sensitive, and it lets pages just use the plain public URL
-- instead of minting a signed one on every render.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'recipe-images',
  'recipe-images',
  true,
  5242880, -- 5MB
  array['image/png', 'image/jpeg', 'image/webp', 'image/gif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "Recipe images are publicly readable"
  on storage.objects for select
  using (bucket_id = 'recipe-images');

-- storage.foldername(name) splits an object path like "<uid>/<file>" into
-- ['<uid>', '<file>'] — checking element 1 against auth.uid() is the
-- standard Supabase pattern for "users can only touch their own folder"
-- without needing a separate objects-ownership table.
create policy "Users can upload their own recipe images"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'recipe-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users can replace their own recipe images"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'recipe-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users can delete their own recipe images"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'recipe-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
