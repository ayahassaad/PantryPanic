-- recipe_ingredients.quantity/unit/category have existed since Day 1 but
-- nothing populated them until now (every recipe's ingredients were
-- typed as a single free-text line). Both write paths — the manual
-- "add a recipe" form and the AI suggestion — now fill in structured
-- values, so it's worth constraining category the same way recipes.source
-- and meal_plan_entries.meal_slot already are, keeping it in the fixed
-- vocabulary the shopping list groups by.
--
-- Existing rows all have category = null, which this constraint allows —
-- there's no reliable way to infer a category from old free-text names,
-- so those just show up ungrouped until the recipe is re-saved.
alter table public.recipe_ingredients
  add constraint recipe_ingredients_category_check
  check (
    category is null or category in (
      'produce',
      'meat-seafood',
      'dairy-eggs',
      'bakery',
      'pantry',
      'frozen',
      'spices-condiments',
      'beverages',
      'other'
    )
  );
