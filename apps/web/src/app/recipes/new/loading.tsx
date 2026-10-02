import { FormPageSkeleton } from "@/components/skeleton";

// A title and a column of fields, the shape of the new-recipe form. Its own
// file because a loading.tsx higher up the recipes folder would otherwise
// apply here too (see recipes/loading.tsx).
export default function NewRecipeLoading() {
  return <FormPageSkeleton fields={5} />;
}
