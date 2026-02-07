import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Dashboard } from "@/components/dashboard";

export default async function Page() {
  const supabase = await createClient();
  const { data: { user: authUser } } = await supabase.auth.getUser();

  if (!authUser) redirect("/login");

  const meta = authUser.user_metadata ?? {};
  const user = {
    name:
      (meta.full_name as string) ??
      (meta.name as string) ??
      (authUser.email?.split("@")[0]) ??
      "Usuario",
    avatar: (meta.avatar_url as string) ?? (meta.picture as string) ?? undefined,
  };

  return <Dashboard initialUser={user} />;
}
