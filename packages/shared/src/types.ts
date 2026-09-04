// Mirrors the database schema in supabase/migrations. Keep these in sync
// by hand for now — once the app calls Supabase directly we can generate
// this file from the live schema instead.

export type MealSlot = "breakfast" | "lunch" | "dinner";
export type RecipeSource = "user" | "ai" | "seed";

export interface Profile {
  id: string;
  fullName: string | null;
  avatarUrl: string | null;
  dietaryPreferences: string[];
  allergies: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Recipe {
  id: string;
  ownerId: string | null; // null = public/seed recipe
  title: string;
  description: string | null;
  steps: string[];
  tags: string[];
  imageUrl: string | null;
  source: RecipeSource;
  aiPrompt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RecipeIngredient {
  id: string;
  recipeId: string;
  name: string;
  quantity: number | null;
  unit: string | null;
  category: string | null;
  sortOrder: number;
}

export interface MealPlanEntry {
  id: string;
  userId: string;
  recipeId: string;
  planDate: string; // YYYY-MM-DD
  mealSlot: MealSlot;
  servings: number;
  createdAt: string;
}

export interface ShoppingList {
  id: string;
  userId: string;
  weekStartDate: string; // YYYY-MM-DD
  createdAt: string;
  updatedAt: string;
}

export interface ShoppingListItem {
  id: string;
  shoppingListId: string;
  name: string;
  quantity: number | null;
  unit: string | null;
  category: string | null;
  isChecked: boolean;
  isManual: boolean;
  sortOrder: number;
}
