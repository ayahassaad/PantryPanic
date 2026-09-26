import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { IngredientRows, type IngredientRowInput } from "../../new/ingredient-rows";
import { updateRecipe } from "./actions";

interface RecipeForEdit {
  id: string;
  title: string;
  description: string | null;
  tags: string[];
  steps: string[];
  image_url: string | null;
  owner_id: string | null;
}

interface RecipeIngredientRow {
  name: string;
  quantity: number | null;
  unit: string | null;
  category: string;
}

export default async function EditRecipePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: recipe } = await supabase
    .from("recipes")
    .select("id, title, description, tags, steps, image_url, owner_id")
    .eq("id", id)
    .maybeSingle<RecipeForEdit>();

  // Not found, or found but not this user's own recipe (seed recipes
  // have owner_id null and aren't anyone's to edit) — both are a 404,
  // not an error, same as the detail page's own not-logged-in-to-this
  // check.
  if (!recipe || recipe.owner_id !== user.id) {
    notFound();
  }

  const { data: ingredientRows } = await supabase
    .from("recipe_ingredients")
    .select("name, quantity, unit, category")
    .eq("recipe_id", id)
    .order("sort_order")
    .returns<RecipeIngredientRow[]>();

  const initialIngredients: IngredientRowInput[] = (ingredientRows ?? []).map((row) => ({
    name: row.name,
    quantity: row.quantity !== null ? String(row.quantity) : "",
    unit: row.unit ?? "",
    category: row.category,
  }));

  const { error } = await searchParams;
  const updateRecipeWithId = updateRecipe.bind(null, recipe.id);

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col px-6 py-8 sm:px-10">
      <p className="mb-1 font-display text-xs font-semibold uppercase tracking-widest text-tomato-400">
        Edit recipe
      </p>
      <h1 className="-rotate-[0.4deg] mb-7 font-display text-3xl font-bold text-ink">
        {recipe.title}
      </h1>

      {error && (
        <p className="wobble-btn mb-6 border-2 border-ink bg-tomato-50 px-4 py-3 text-sm font-bold text-tomato-700">
          {error}
        </p>
      )}

      <form className="flex flex-col gap-5" encType="multipart/form-data">
        <div className="flex flex-col gap-1.5 text-sm font-bold text-ink-soft">
          Photo
          {recipe.image_url && (
            <div className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element -- see
                  the detail page for why this stays a plain <img>. */}
              <img
                src={recipe.image_url}
                alt=""
                className="h-16 w-16 rounded-xl border-2 border-ink object-cover"
              />
              <label className="flex items-center gap-1.5 text-xs font-normal text-ink-faint">
                <input type="checkbox" name="removeImage" value="true" className="h-4 w-4" />
                Remove current photo
              </label>
            </div>
          )}
          <input
            name="image"
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            className="rounded-xl border-2 border-ink bg-cream-card px-3 py-2 text-sm text-ink file:mr-3 file:rounded-lg file:border-2 file:border-ink file:bg-cream-deep file:px-3 file:py-1.5 file:text-sm file:font-bold file:text-ink hover:file:bg-cream"
          />
          <span className="text-xs font-normal text-ink-faint">
            {recipe.image_url
              ? "Pick a new photo to replace the current one. PNG, JPEG, WebP, or GIF, up to 5MB."
              : "Optional. PNG, JPEG, WebP, or GIF, up to 5MB."}
          </span>
        </div>

        <label className="flex flex-col gap-1.5 text-sm font-bold text-ink-soft">
          Title
          <input
            name="title"
            type="text"
            required
            defaultValue={recipe.title}
            className="rounded-xl border-2 border-ink bg-cream-card px-4 py-2.5 text-base text-ink outline-none focus:border-tomato-400"
          />
        </label>

        <label className="flex flex-col gap-1.5 text-sm font-bold text-ink-soft">
          Description
          <textarea
            name="description"
            rows={2}
            defaultValue={recipe.description ?? ""}
            className="rounded-xl border-2 border-ink bg-cream-card px-4 py-2.5 text-base text-ink outline-none focus:border-tomato-400"
          />
        </label>

        <label className="flex flex-col gap-1.5 text-sm font-bold text-ink-soft">
          Tags
          <input
            name="tags"
            type="text"
            placeholder="quick, vegetarian, pasta"
            defaultValue={recipe.tags.join(", ")}
            className="rounded-xl border-2 border-ink bg-cream-card px-4 py-2.5 text-base text-ink outline-none placeholder:text-ink-faint focus:border-tomato-400"
          />
          <span className="text-xs font-normal text-ink-faint">Comma-separated.</span>
        </label>

        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-bold text-ink-soft">Ingredients</span>
          <IngredientRows initialRows={initialIngredients} />
          <span className="text-xs font-normal text-ink-faint">
            Quantity and unit are optional. Leave blank for things like
            &quot;salt to taste&quot;.
          </span>
        </div>

        <label className="flex flex-col gap-1.5 text-sm font-bold text-ink-soft">
          Steps
          <textarea
            name="steps"
            rows={6}
            required
            defaultValue={recipe.steps.join("\n")}
            className="rounded-xl border-2 border-ink bg-cream-card px-4 py-2.5 text-base text-ink outline-none placeholder:text-ink-faint focus:border-tomato-400"
          />
          <span className="text-xs font-normal text-ink-faint">
            One step per line.
          </span>
        </label>

        <button
          formAction={updateRecipeWithId}
          className="wobble-btn hand-shadow mt-2 w-fit bg-tomato-400 px-5 py-2.5 font-display text-sm font-semibold text-cream transition hover:brightness-105"
        >
          Save changes
        </button>
      </form>
    </main>
  );
}
