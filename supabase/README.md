# Database

SQL migrations live in `migrations/`, applied in filename order. Each table
has Row Level Security enabled with policies scoping every row to the user
who owns it — the database enforces this even if application code has a bug.

## Applying these (once the Supabase project exists)

Either:
- Paste each file's contents into the Supabase dashboard's SQL Editor, in
  order, and run them, or
- Install the Supabase CLI, run `supabase link`, then `supabase db push`

## Tables

- `profiles` — one row per user, created automatically on signup
- `recipes` + `recipe_ingredients` — user-created or AI-generated recipes;
  `owner_id is null` marks a public/seed recipe visible to everyone
- `meal_plan_entries` — which recipe is assigned to which day/meal slot
- `shopping_lists` + `shopping_list_items` — generated from a week's meal
  plan, with room for manually added items
