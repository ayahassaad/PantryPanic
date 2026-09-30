-- Lightweight, self-hosted visit tracking so the numbers can live on our
-- own /admin page instead of only in Vercel's separate dashboard. Records
-- one row per page view: which page, where the visitor came from
-- (referrer), and roughly where they were (country/city, read from the
-- x-vercel-ip-* headers Vercel's edge network adds automatically — those
-- are only present in production on Vercel, so local dev just logs nulls
-- there, which is fine).
create table public.page_visits (
  id bigint generated always as identity primary key,
  visited_at timestamptz not null default now(),
  path text not null,
  referrer text,
  country text,
  city text
);

create index page_visits_visited_at_idx on public.page_visits (visited_at desc);

alter table public.page_visits enable row level security;

-- Anyone can log a visit, including a signed-out visitor browsing before
-- they've logged in at all — this table only ever holds page paths,
-- referrers, and coarse location, nothing that identifies a person, so
-- there's nothing sensitive being exposed by allowing the insert itself.
create policy "Anyone can record a page visit"
  on public.page_visits for insert
  to anon, authenticated
  with check (true);

-- Only admins can read the log back — same is_admin() helper the admin
-- panel's profiles/recipes policies use (see
-- 20261001000000_fix_admin_rls_recursion.sql for why it has to be a
-- security definer function rather than an inline subquery).
create policy "Admins can view page visits"
  on public.page_visits for select
  using (public.is_admin());
