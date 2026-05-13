"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { getSupabase } from "@/lib/supabase";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Mail, Clock, Send, Bot, LayoutDashboard } from "lucide-react";
import type { DashboardUser } from "@/components/dashboard";

interface PendingThread {
  threadId: string;
  clientName: string;
  clientEmail: string;
  subject: string;
  daysSinceLastReply: number;
  lastSentDate: string;
}

interface DraftState {
  [threadId: string]: "idle" | "loading" | "done" | "error";
}

interface AgenteComercialProps {
  initialUser?: DashboardUser | null;
}

function urgencyBadge(days: number) {
  if (days >= 30) return "bg-red-500/20 text-red-400 border-red-500/30";
  if (days >= 14) return "bg-orange-500/20 text-orange-400 border-orange-500/30";
  if (days >= 7) return "bg-amber-500/20 text-amber-400 border-amber-500/30";
  return "bg-blue-500/20 text-blue-400 border-blue-500/30";
}

export function AgenteComercial({ initialUser }: AgenteComercialProps) {
  const [user] = useState<DashboardUser | null>(initialUser ?? null);
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [threads, setThreads] = useState<PendingThread[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<DraftState>({});
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  function showSuccess(msg: string) {
    setSuccessMessage(msg);
    setTimeout(() => setSuccessMessage(null), 3000);
  }

  async function handleEjecutar() {
    setStatus("loading");
    setErrorMsg(null);
    setThreads([]);
    setDrafts({});

    try {
      const res = await fetch("/api/gmail/threads");
      const data = await res.json();

      if (!res.ok) {
        setErrorMsg(data.error ?? "Error desconocido al llamar a Gmail");
        setStatus("error");
        return;
      }

      setThreads(data.pending ?? []);
      setStatus("done");
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : "Error de red. Intenta de nuevo."
      );
      setStatus("error");
    }
  }

  async function handleCrearDraft(thread: PendingThread) {
    setDrafts((prev) => ({ ...prev, [thread.threadId]: "loading" }));

    try {
      const res = await fetch("/api/gmail/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          threadId: thread.threadId,
          clientName: thread.clientName,
          clientEmail: thread.clientEmail,
          subject: thread.subject,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setDrafts((prev) => ({ ...prev, [thread.threadId]: "error" }));
        setErrorMsg(data.error ?? "Error al crear borrador");
        return;
      }

      setDrafts((prev) => ({ ...prev, [thread.threadId]: "done" }));
      showSuccess(`Borrador creado para ${thread.clientName}`);
    } catch {
      setDrafts((prev) => ({ ...prev, [thread.threadId]: "error" }));
    }
  }

  async function handleSignOut() {
    const client = getSupabase();
    if (client) {
      await client.auth.signOut();
      window.location.href = "/login";
    }
  }

  return (
    <div className="min-h-screen bg-background pb-8">
      {/* Toast */}
      {successMessage && (
        <div
          className="fixed bottom-6 left-4 right-4 sm:left-auto sm:right-6 sm:max-w-sm z-50 rounded-lg bg-emerald-600 text-white px-4 py-3 text-sm font-medium shadow-lg animate-in fade-in slide-in-from-bottom-2"
          role="status"
        >
          {successMessage}
        </div>
      )}

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
                Agente Comercial
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {/* Nav tabs */}
            <nav className="flex items-center gap-1">
              <Link href="/finanzas">
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1.5 text-xs sm:text-sm text-muted-foreground hover:text-foreground"
                >
                  <LayoutDashboard className="h-4 w-4" />
                  <span className="hidden sm:inline">Finanzas</span>
                </Button>
              </Link>
              <Button
                variant="secondary"
                size="sm"
                className="gap-1.5 text-xs sm:text-sm"
                disabled
              >
                <Bot className="h-4 w-4" />
                <span className="hidden sm:inline">Agente</span>
              </Button>
            </nav>

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
      <main className="mx-auto max-w-4xl px-4 sm:px-6 py-6 sm:py-10 space-y-6">
        {/* Hero */}
        <div className="space-y-1">
          <h2 className="text-2xl font-bold tracking-tight">Agente Comercial</h2>
          <p className="text-sm text-muted-foreground">
            Detecta conversaciones de Gmail sin respuesta en los últimos 5+ días
            y crea borradores de seguimiento automáticamente.
          </p>
        </div>

        {/* Info pills */}
        <div className="flex flex-wrap gap-2">
          <div className="flex items-center gap-1.5 rounded-full border border-border/50 bg-muted/30 px-3 py-1 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            Últimos 60 días
          </div>
          <div className="flex items-center gap-1.5 rounded-full border border-border/50 bg-muted/30 px-3 py-1 text-xs text-muted-foreground">
            <Mail className="h-3 w-3" />
            Enviados sin respuesta +5 días
          </div>
        </div>

        {/* Action */}
        <Button
          size="lg"
          onClick={handleEjecutar}
          disabled={status === "loading"}
          className="gap-2"
        >
          {status === "loading" ? (
            <>
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground/40 border-t-primary-foreground" />
              Analizando Gmail...
            </>
          ) : (
            <>
              <Bot className="h-4 w-4" />
              Ejecutar agente
            </>
          )}
        </Button>

        {/* Error */}
        {status === "error" && errorMsg && (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {errorMsg}
          </div>
        )}

        {/* Results */}
        {status === "done" && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-medium">
                {threads.length === 0
                  ? "Sin conversaciones pendientes"
                  : `${threads.length} conversación${threads.length !== 1 ? "es" : ""} sin respuesta`}
              </h3>
              {threads.length > 0 && (
                <Badge variant="outline" className="bg-amber-500/10 text-amber-400 border-amber-500/30 text-xs">
                  Requiere seguimiento
                </Badge>
              )}
            </div>

            {threads.length === 0 ? (
              <Card className="border-emerald-500/20">
                <CardContent className="flex items-center gap-3 py-5">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-500/10">
                    <Mail className="h-4 w-4 text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-emerald-400">Todo al día</p>
                    <p className="text-xs text-muted-foreground">
                      Sin conversaciones sin respuesta por más de 5 días.
                    </p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="flex flex-col gap-2">
                {threads.map((thread) => {
                  const draftStatus = drafts[thread.threadId] ?? "idle";
                  const firstName = thread.clientName.split(" ")[0] || thread.clientName;

                  return (
                    <Card
                      key={thread.threadId}
                      className="border-border/50 transition-colors hover:border-border"
                    >
                      <CardContent className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          {/* Left: name + email */}
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium truncate">{thread.clientName}</span>
                              <Badge
                                variant="outline"
                                className={`shrink-0 text-[10px] px-1.5 py-0 ${urgencyBadge(thread.daysSinceLastReply)}`}
                              >
                                <Clock className="mr-0.5 h-2.5 w-2.5" />
                                {thread.daysSinceLastReply}d
                              </Badge>
                            </div>
                            <p className="text-[11px] text-muted-foreground truncate">
                              {thread.clientEmail}
                              {thread.subject && (
                                <span className="ml-2 italic opacity-70">{thread.subject}</span>
                              )}
                            </p>
                          </div>

                          {/* Right: action */}
                          {draftStatus === "done" ? (
                            <div className="flex shrink-0 items-center gap-1.5 text-[11px] text-emerald-400">
                              <Send className="h-3 w-3" />
                              Borrador listo
                            </div>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              className="shrink-0 h-7 px-2.5 text-xs gap-1.5"
                              disabled={draftStatus === "loading"}
                              onClick={() => handleCrearDraft(thread)}
                            >
                              {draftStatus === "loading" ? (
                                <div className="h-3 w-3 animate-spin rounded-full border-2 border-muted-foreground border-t-foreground" />
                              ) : (
                                <Send className="h-3 w-3" />
                              )}
                              {draftStatus === "loading" ? "..." : "Borrador"}
                            </Button>
                          )}
                        </div>

                        {draftStatus === "error" && (
                          <p className="mt-1 text-[11px] text-destructive">
                            Error al crear el borrador.
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        )}

        <footer className="pt-4 text-center">
          <p className="text-xs text-muted-foreground">
            Reyes de la IA Finance &mdash; Powered by Reyes IA
          </p>
        </footer>
      </main>
    </div>
  );
}
