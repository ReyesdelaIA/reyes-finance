import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Wrench } from "lucide-react";

export default async function PublicoPage() {
  const supabase = await createClient();
  const { data: { user: authUser } } = await supabase.auth.getUser();

  if (!authUser) redirect("/login");

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="sticky top-0 z-40 border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 sm:py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary overflow-hidden">
              <Image src="/isotipo.png" alt="Reyes Finance" width={32} height={32} className="h-8 w-8 object-cover" priority />
            </div>
            <span className="text-base font-semibold tracking-tight">Reyes Finance</span>
          </div>
          <Link href="/">
            <Button variant="ghost" size="sm" className="gap-1.5 text-xs sm:text-sm text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Inicio</span>
            </Button>
          </Link>
        </div>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center px-4 py-16 text-center gap-6">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
          <Wrench className="h-8 w-8 text-muted-foreground" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-bold tracking-tight">Dashboard Público</h2>
          <p className="text-sm text-muted-foreground max-w-sm">
            Próximamente: una vista pública con métricas sin datos de ingresos.
          </p>
        </div>
        <Link href="/">
          <Button variant="outline" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Volver al inicio
          </Button>
        </Link>
      </main>
    </div>
  );
}
