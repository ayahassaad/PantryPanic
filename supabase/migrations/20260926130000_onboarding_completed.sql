-- Tracks whether a user has been through (or skipped) the signup quiz.
-- NULL means "not yet" — a fresh profile row from the handle_new_user
-- trigger never sets this column, so every brand-new signup starts out
-- NULL and gets sent to the quiz.
--
-- Backfilling every EXISTING row to now() matters: without it, every
-- account created before this migration would suddenly get redirected to
-- the quiz the next time they load the dashboard, which is surprising
-- for someone who's already using the app. Only a signup that happens
-- AFTER this migration runs gets a real NULL and actually sees it.
alter table public.profiles
  add column if not exists onboarding_completed_at timestamptz;

update public.profiles
set onboarding_completed_at = now()
where onboarding_completed_at is null;
