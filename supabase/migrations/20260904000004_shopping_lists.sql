create table public.shopping_lists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  week_start_date date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, week_start_date)
);

alter table public.shopping_lists enable row level security;

create policy "Users can view their own shopping lists"
  on public.shopping_lists for select
  using (user_id = auth.uid());

create policy "Users can create their own shopping lists"
  on public.shopping_lists for insert
  with check (user_id = auth.uid());

create policy "Users can update their own shopping lists"
  on public.shopping_lists for update
  using (user_id = auth.uid());

create policy "Users can delete their own shopping lists"
  on public.shopping_lists for delete
  using (user_id = auth.uid());

create trigger set_shopping_lists_updated_at
  before update on public.shopping_lists
  for each row execute function public.set_updated_at();

create table public.shopping_list_items (
  id uuid primary key default gen_random_uuid(),
  shopping_list_id uuid not null references public.shopping_lists(id) on delete cascade,
  name text not null,
  quantity numeric,
  unit text,
  category text,
  is_checked boolean not null default false,
  is_manual boolean not null default false,
  sort_order int not null default 0
);

create index shopping_list_items_list_id_idx on public.shopping_list_items (shopping_list_id);

alter table public.shopping_list_items enable row level security;

create policy "Users can view items on their own shopping lists"
  on public.shopping_list_items for select
  using (
    exists (
      select 1 from public.shopping_lists
      where shopping_lists.id = shopping_list_items.shopping_list_id
        and shopping_lists.user_id = auth.uid()
    )
  );

create policy "Users can add items to their own shopping lists"
  on public.shopping_list_items for insert
  with check (
    exists (
      select 1 from public.shopping_lists
      where shopping_lists.id = shopping_list_items.shopping_list_id
        and shopping_lists.user_id = auth.uid()
    )
  );

create policy "Users can update items on their own shopping lists"
  on public.shopping_list_items for update
  using (
    exists (
      select 1 from public.shopping_lists
      where shopping_lists.id = shopping_list_items.shopping_list_id
        and shopping_lists.user_id = auth.uid()
    )
  );

create policy "Users can delete items from their own shopping lists"
  on public.shopping_list_items for delete
  using (
    exists (
      select 1 from public.shopping_lists
      where shopping_lists.id = shopping_list_items.shopping_list_id
        and shopping_lists.user_id = auth.uid()
    )
  );
