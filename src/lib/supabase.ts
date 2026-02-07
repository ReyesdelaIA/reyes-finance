import { createClient } from "@/lib/supabase/client";
import type { SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

export const supabase: SupabaseClient | null = (() => {
  if (typeof window === "undefined") return null;
  if (!client) client = createClient();
  return client;
})();
