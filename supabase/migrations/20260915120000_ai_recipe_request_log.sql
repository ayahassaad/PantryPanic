-- Tracks each attempt to call the AI recipe-suggestion endpoint, so we can
-- cap how many a single user can make in a rolling window. This protects
-- against a runaway client (double-clicks, a buggy retry loop, or someone
-- deliberately hammering the button) turning into an open-ended Anthropic
-- API bill — each call costs real money regardless of whether it succeeds.
--
-- One row is inserted per attempt, right before we call Claude. Rows are
-- never updated or deleted from the app; old rows are just harmless
-- history (cheap enough not to bother pruning yet).
create table public.ai_recipe_requests (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- Speeds up "how many rows has this user inserted since <cutoff>", which is
-- exactly the query the rate-limit check runs on every suggestion request.
create index ai_recipe_requests_owner_created_idx
  on public.ai_recipe_requests (owner_id, created_at);

alter table public.ai_recipe_requests enable row level security;

create policy "Users can see their own AI request log"
  on public.ai_recipe_requests for select
  using (owner_id = auth.uid());

create policy "Users can log their own AI requests"
  on public.ai_recipe_requests for insert
  with check (owner_id = auth.uid());

-- No update/delete policy on purpose: the app never edits or removes these
-- rows, so there's nothing for a user to legitimately change here.

-- See the 20260914113448 migration's note: RLS alone doesn't let the
-- `authenticated` role touch the table at all without this grant too.
grant select, insert on public.ai_recipe_requests to authenticated;
