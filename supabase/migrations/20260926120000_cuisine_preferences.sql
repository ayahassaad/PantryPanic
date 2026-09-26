-- Adds the one profile field the signup quiz needs that didn't already
-- exist (dietary_preferences, allergies, household_size, and unit_system
-- were all added by 20260919120000_profile_extensions.sql). Same shape as
-- dietary_preferences/allergies: a plain text array, default empty so
-- existing rows (and anyone who skips this step of the quiz) aren't left
-- with a null the app would have to special-case.
alter table public.profiles
  add column if not exists cuisine_preferences text[] not null default '{}';
