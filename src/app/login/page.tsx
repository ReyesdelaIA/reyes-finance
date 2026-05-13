import { connection } from "next/server";
import { LoginForm } from "./login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  await connection();
  const params = await searchParams;
  const errorFromUrl = params.error ? decodeURIComponent(params.error) : null;

  return <LoginForm initialError={errorFromUrl} />;
}
