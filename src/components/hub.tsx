"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { getSupabase } from "@/lib/supabase";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BarChart3, Bot, Eye, ChevronRight, Lock } from "lucide-react";
import type { DashboardUser } from "@/components/dashboard";

interface HubPageProps {
  initialUser?: DashboardUser | null;
}

const modules = [
  {
    href: "/finanzas",
    icon: BarChart3,
    iconClass: "text-emerald-400",
    bgClass: "bg-emerald-500/10",
    title: "Finanzas personales",
    description: "Proyectos, ingresos y métricas de ventas.",
    badge: null,
    private: true,
  },
  {
    href: "/agente",
    icon: Bot,
    iconClass: "text-blue-400",
    bgClass: "bg-blue-500/10",
    title: "Agente comercial",
    description: "Detecta correos sin respuesta y crea borradores de seguimiento.",
    badge: "IA",
    private: false,
  },
  {
    href: "/publico",
    icon: Eye,
    iconClass: "text-violet-400",
    bgClass: "bg-violet-500/10",
    title: "Dashboard público",
    description: "Vista de métricas sin datos de ingresos.",
    badge: "Próximamente",
    private: false,
  },
];

export function HubPage({ initialUser }: HubPageProps) {
  const [user] = useState<DashboardUser | null>(initialUser ?? null);

  async function handleSignOut() {
    const client = getSupabase();
    if (client) {
      await client.auth.signOut();
      window.location.href = "/login";
    }
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 sm:py-5">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <div className="flex h-8 w-8 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-lg bg-primary overflow-hidden">
              <Image
                src="/isotipo.png"
                alt="Reyes Finance"
                width={36}
                height={36}
                className="h-8 w-8 sm:h-9 sm:w-9 object-cover"
                priority
              />
            </div>
            <div className="min-w-0">
              <h1 className="text-base sm:text-lg font-semibold tracking-tight truncate">
                Reyes de la IA Finance
              </h1>
              <p className="text-[10px] sm:text-xs text-muted-foreground hidden sm:block">
                Inicio
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {user && (
              <div className="flex items-center gap-1.5 sm:gap-2">
                {user.avatar ? (
                  <img
                    src={user.avatar}
                    alt={user.name ?? "Avatar"}
                    className="h-8 w-8 sm:h-9 sm:w-9 rounded-full object-cover ring-2 ring-border"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-full bg-muted ring-2 ring-border text-xs font-medium text-muted-foreground">
                    {(user.name ?? "U").charAt(0).toUpperCase()}
                  </div>
                )}
                <span className="hidden sm:block text-sm font-medium truncate max-w-[120px]">
                  {user.name}
                </span>
              </div>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="min-h-[44px] min-w-[44px] sm:min-w-0 text-xs sm:text-sm"
              onClick={handleSignOut}
            >
              <span className="hidden sm:inline">Cerrar sesión</span>
              <span className="sm:hidden">Salir</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="mx-auto max-w-2xl px-4 sm:px-6 py-10 sm:py-16 space-y-8">
        <div className="space-y-1">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">
            Hola, {user?.name?.split(" ")[0] ?? "Felipe"} 👋
          </h2>
          <p className="text-sm text-muted-foreground">
            ¿Qué quieres hacer hoy?
          </p>
        </div>

        <div className="grid gap-3">
          {modules.map((mod) => {
            const Icon = mod.icon;
            return (
              <Link key={mod.href} href={mod.href} className="group block">
                <Card className="border-border/50 transition-colors hover:border-border hover:bg-muted/20">
                  <CardContent className="flex items-center gap-4 py-4 px-5">
                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${mod.bgClass}`}>
                      <Icon className={`h-5 w-5 ${mod.iconClass}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold">{mod.title}</span>
                        {mod.private && <Lock className="h-3 w-3 text-muted-foreground/60" />}
                        {mod.badge && (
                          <span className="rounded-full border border-border/60 bg-muted/40 px-2 py-0.5 text-[10px] text-muted-foreground">
                            {mod.badge}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        {mod.description}
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground/50 shrink-0 transition-transform group-hover:translate-x-0.5" />
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>

        <footer className="pt-4 text-center">
          <p className="text-xs text-muted-foreground">
            Reyes de la IA Finance &mdash; Powered by Reyes IA
          </p>
        </footer>
      </main>
    </div>
  );
}
