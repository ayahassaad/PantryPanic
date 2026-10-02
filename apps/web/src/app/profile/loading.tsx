import { FormPageSkeleton } from "@/components/skeleton";

// A title and a column of fields, the shape of the profile page.
export default function ProfileLoading() {
  return <FormPageSkeleton fields={6} />;
}
