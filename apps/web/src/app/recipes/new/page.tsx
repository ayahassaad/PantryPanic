import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createRecipe } from "./actions";
import { IngredientRows } from "./ingredient-rows";

export default async function NewRecipePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { error } = await searchParams;

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col px-6 py-16">
      <Link
        href="/recipes"
        className="mb-8 w-fit text-sm text-neutral-500 underline underline-offset-2"
      >
        &larr; Back to recipes
      </Link>

      <p className="mb-2 font-mono text-xs uppercase tracking-widest text-basil-600">
        New recipe
      </p>
      <h1 className="mb-8 text-3xl font-semibold tracking-tight text-basil-700">
        Add a recipe
      </h1>

      {error && (
        <p className="mb-6 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}

      <form className="flex flex-col gap-5" encType="multipart/form-data">
        <label className="flex flex-col gap-1 text-sm text-neutral-700">
          Photo
          <input
            name="image"
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            className="rounded-md border border-neutral-300 px-3 py-2 text-sm file:mr-3 file:rounded file:border-0 file:bg-basil-50 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-basil-700"
          />
          <span className="text-xs text-neutral-500">
            Optional. PNG, JPEG, WebP, or GIF, up to 5MB.
          </span>
        </label>

        <label className="flex flex-col gap-1 text-sm text-neutral-700">
          Title
          <input
            name="title"
            type="text"
            required
            className="rounded-md border border-neutral-300 px-3 py-2 text-base outline-none focus:border-basil-600"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm text-neutral-700">
          Description
          <textarea
            name="description"
            rows={2}
            className="rounded-md border border-neutral-300 px-3 py-2 text-base outline-none focus:border-basil-600"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm text-neutral-700">
          Tags
          <input
            name="tags"
            type="text"
            placeholder="quick, vegetarian, pasta"
            className="rounded-md border border-neutral-300 px-3 py-2 text-base outline-none focus:border-basil-600"
          />
          <span className="text-xs text-neutral-500">Comma-separated.</span>
        </label>

        <div className="flex flex-col gap-1">
          <span className="text-sm text-neutral-700">Ingredients</span>
          <IngredientRows />
          <span className="text-xs text-neutral-500">
            Quantity and unit are optional — leave blank for things like
            &quot;salt to taste&quot;.
          </span>
        </div>

        <label className="flex flex-col gap-1 text-sm text-neutral-700">
          Steps
          <textarea
            name="steps"
            rows={6}
            required
            placeholder={"Boil a pot of salted water.\nCook the pasta until al dente."}
            className="rounded-md border border-neutral-300 px-3 py-2 text-base outline-none focus:border-basil-600"
          />
          <span className="text-xs text-neutral-500">
            One step per line.
          </span>
        </label>

        <button
          formAction={createRecipe}
          className="mt-2 w-fit rounded-md bg-basil-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-basil-700"
        >
          Save recipe
        </button>
      </form>
    </main>
  );
}
