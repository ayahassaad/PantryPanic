create table public.recipes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete cascade,
  title text not null,
  description text,
  steps jsonb not null default '[]',
  tags text[] not null default '{}',
  image_url text,
  source text not null default 'user' check (source in ('user', 'ai', 'seed')),
  ai_prompt text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index recipes_owner_id_idx on public.recipes (owner_id);

alter table public.recipes enable row level security;

-- Seed/example recipes (owner_id is null) are visible to everyone;
-- anything a user created is visible only to them.
create policy "Recipes are visible to their owner or if public"
  on public.recipes for select
  using (owner_id = auth.uid() or owner_id is null);

create policy "Users can create their own recipes"
  on public.recipes for insert
  with check (owner_id = auth.uid());

create policy "Users can update their own recipes"
  on public.recipes for update
  using (owner_id = auth.uid());

create policy "Users can delete their own recipes"
  on public.recipes for delete
  using (owner_id = auth.uid());

create trigger set_recipes_updated_at
  before update on public.recipes
  for each row execute function public.set_updated_at();

create table public.recipe_ingredients (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.recipes(id) on delete cascade,
  name text not null,
  quantity numeric,
  unit text,
  category text,
  sort_order int not null default 0
);

create index recipe_ingredients_recipe_id_idx on public.recipe_ingredients (recipe_id);

alter table public.recipe_ingredients enable row level security;

create policy "Ingredients follow their recipe's visibility"
  on public.recipe_ingredients for select
  using (
    exists (
      select 1 from public.recipes
      where recipes.id = recipe_ingredients.recipe_id
        and (recipes.owner_id = auth.uid() or recipes.owner_id is null)
    )
  );

create policy "Users can add ingredients to their own recipes"
  on public.recipe_ingredients for insert
  with check (
    exists (
      select 1 from public.recipes
      where recipes.id = recipe_ingredients.recipe_id
        and recipes.owner_id = auth.uid()
    )
  );

create policy "Users can edit ingredients on their own recipes"
  on public.recipe_ingredients for update
  using (
    exists (
      select 1 from public.recipes
      where recipes.id = recipe_ingredients.recipe_id
        and recipes.owner_id = auth.uid()
    )
  );

create policy "Users can remove ingredients from their own recipes"
  on public.recipe_ingredients for delete
  using (
    exists (
      select 1 from public.recipes
      where recipes.id = recipe_ingredients.recipe_id
        and recipes.owner_id = auth.uid()
    )
  );
