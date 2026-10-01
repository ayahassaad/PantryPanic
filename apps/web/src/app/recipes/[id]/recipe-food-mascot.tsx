"use client";

import { FoodMascot, inferFoodKind } from "@/components/food-mascot";

// The no-photo placeholder character for the recipe page — the same one
// the recipe's card shows on the recipes list (guessed from its
// ingredients, then its title/description — see inferFoodKind).
//
// A client component of its own, rather than the page calling
// inferFoodKind directly, because the page is a Server Component and
// food-mascot.tsx is a "use client" module: its exports can be *rendered*
// from the server, but not *called* there — doing that throws at request
// time ("Attempted to call inferFoodKind() from the server"). So the page
// hands over plain strings and the guess happens in here.
export function RecipeFoodMascot({
  title,
  description,
  ingredientNames,
  className,
}: {
  title: string;
  description: string | null;
  ingredientNames: string[];
  className?: string;
}) {
  return (
    <FoodMascot
      kind={inferFoodKind(`${title} ${description ?? ""}`, ingredientNames)}
      className={className}
    />
  );
}
