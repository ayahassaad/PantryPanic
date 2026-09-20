// Shared between the client-side selection context (fill-week-selection.tsx),
// the Fill-week button, and the fillWeekWithAi server action — kept in one
// plain, directive-free module so all three can import the same number
// without a "use client"/"use server" file importing across that boundary.
//
// The cap itself isn't arbitrary: asking Claude for too many full recipes
// (title + description + a real ingredient list + steps, each) in one
// response risks running past the model's output budget and coming back
// truncated. See the comment on generateWeekSuggestions in
// lib/anthropic/suggest-recipe.ts.
export const MAX_SELECTED_SLOTS = 8;
