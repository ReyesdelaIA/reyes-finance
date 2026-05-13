import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { AgenteComercial } from "@/components/agente-comercial";

export default async function AgentePage() {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) redirect("/login");

  const meta = authUser.user_metadata ?? {};
  const identityData = (
    authUser as {
      identities?: Array<{ identity_data?: Record<string, unknown> }>;
    }
  ).identities?.[0]?.identity_data;
  const idMeta = (identityData ?? {}) as Record<string, unknown>;

  const avatar =
    (meta.avatar_url as string) ??
    (meta.picture as string) ??
    (meta.image as string) ??
    (meta.profile_image as string) ??
    (idMeta.avatar_url as string) ??
    (idMeta.picture as string) ??
    undefined;

  let profileAvatar: string | undefined;
  try {
    const { data: profile } = await supabase
      .from("profiles")
      .select("avatar_url")
      .eq("id", authUser.id)
      .maybeSingle();
    profileAvatar = profile?.avatar_url as string | undefined;
  } catch {
    // profiles table may not be set up yet
  }

  const user = {
    id: authUser.id,
    name:
      (meta.full_name as string) ??
      (meta.name as string) ??
      (idMeta.full_name as string) ??
      (idMeta.name as string) ??
      (authUser.email?.split("@")[0]) ??
      "Usuario",
    email: authUser.email ?? undefined,
    avatar: profileAvatar ?? avatar,
  };

  return <AgenteComercial initialUser={user} />;
}
