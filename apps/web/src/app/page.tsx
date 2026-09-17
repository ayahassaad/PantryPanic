import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// No standalone landing page — "/" is just a router. Logged-in visitors
// go straight to the dashboard; everyone else lands on login (which
// links to /signup for anyone who needs to create an account).
export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  redirect(user ? "/dashboard" : "/login");
}
