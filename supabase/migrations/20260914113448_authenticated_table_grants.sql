-- Row Level Security controls which ROWS a role can see once it's allowed
-- to touch a table at all — but Postgres separately requires a basic
-- GRANT before a role can query the table in the first place. We enabled
-- and verified RLS on Day 2, but never granted the `authenticated` role
-- baseline access to these tables, so every real query from a logged-in
-- user was being rejected before RLS even got a chance to run.
--
-- These grants don't weaken security: RLS policies still decide exactly
-- which rows each user can see or change. This just lets logged-in users
-- reach the tables at all.
grant select, insert, update on public.profiles to authenticated;

grant select, insert, update, delete on public.recipes to authenticated;
grant select, insert, update, delete on public.recipe_ingredients to authenticated;

grant select, insert, update, delete on public.meal_plan_entries to authenticated;

grant select, insert, update, delete on public.shopping_lists to authenticated;
grant select, insert, update, delete on public.shopping_list_items to authenticated;
