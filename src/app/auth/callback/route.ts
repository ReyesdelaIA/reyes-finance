import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";
  const errorParam = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");

  // Si Supabase/Google devuelve error en la URL (ej: usuario canceló)
  if (errorParam) {
    const message = errorDescription
      ? encodeURIComponent(errorDescription)
      : "auth_failed";
    return NextResponse.redirect(`${origin}/login?error=${message}`);
  }

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=no_code`);
  }

  const supabase = await createClient();

  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (!error) {
    return NextResponse.redirect(`${origin}${next}`);
  }

  // Redirigir con el mensaje de error para debug
  const errorMessage = encodeURIComponent(error.message);
  return NextResponse.redirect(`${origin}/login?error=${errorMessage}`);
}
