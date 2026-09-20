create table public.meal_plan_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  recipe_id uuid not null references public.recipes(id) on delete cascade,
  plan_date date not null,
  meal_slot text not null check (meal_slot in ('breakfast', 'lunch', 'dinner')),
  servings int not null default 1 check (servings > 0),
  created_at timestamptz not null default now(),
  -- one recipe per meal slot per day, per user
  unique (user_id, plan_date, meal_slot)
);

create index meal_plan_entries_user_date_idx on public.meal_plan_entries (user_id, plan_date);

alter table public.meal_plan_entries enable row level security;

create policy "Users can view their own meal plan"
  on public.meal_plan_entries for select
  using (user_id = auth.uid());

create policy "Users can add to their own meal plan"
  on public.meal_plan_entries for insert
  with check (user_id = auth.uid());

create policy "Users can update their own meal plan"
  on public.meal_plan_entries for update
  using (user_id = auth.uid());

create policy "Users can remove from their own meal plan"
  on public.meal_plan_entries for delete
  using (user_id = auth.uid());
