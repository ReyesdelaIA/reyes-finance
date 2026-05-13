import { createClient } from "@/lib/supabase/client";
import type { SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

/** Usar siempre desde el cliente (p. ej. en useEffect o handlers), nunca confiar en un singleton evaluado en import si `window` aún no existía. */
export function getSupabase(): SupabaseClient | null {
  if (typeof window === "undefined") return null;
  if (!client) client = createClient();
  return client;
}
