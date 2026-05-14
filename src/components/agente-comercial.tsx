"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { getSupabase } from "@/lib/supabase";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Mail, Clock, Send, Bot, LayoutDashboard, RefreshCw } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import type { DashboardUser } from "@/components/dashboard";

interface PendingThread {
  threadId: string;
  clientName: string;
  clientEmail: string;
  subject: string;
  daysSinceLastReply: number;
  lastSentDate: string;
}

type ThreadAction = "idle" | "loading-draft" | "loading-send" | "done-draft" | "done-send" | "error-draft" | "error-send";
interface DraftState { [threadId: string]: ThreadAction }
interface AgenteComercialProps { initialUser?: DashboardUser | null }

const BUCKETS = [
  { label: "1–5 días",  min: 1,  max: 5,        color: "text-blue-400",   bg: "bg-blue-500/10",   border: "border-blue-500/20",   bar: "#60a5fa" },
  { label: "6–10 días", min: 6,  max: 10,        color: "text-amber-400",  bg: "bg-amber-500/10",  border: "border-amber-500/20",  bar: "#fbbf24" },
  { label: "11–15 días",min: 11, max: 15,        color: "text-orange-400", bg: "bg-orange-500/10", border: "border-orange-500/20", bar: "#fb923c" },
  { label: "+15 días",  min: 16, max: Infinity,  color: "text-red-400",    bg: "bg-red-500/10",    border: "border-red-500/20",    bar: "#f87171" },
];

const LOADING_SCRIPT = [
  "$ Conectando con Gmail API...",
  "$ Buscando threads — últimos 60 días...",
  "✓ Threads encontrados",
  "$ Analizando mensajes enviados...",
  "$ Filtrando respuestas de clientes...",
  "$ Extrayendo nombres de contactos...",
  "$ Calculando días sin respuesta...",
  "✓ Ordenando resultados...",
];

function urgencyBadge(days: number) {
  if (days >= 16) return "bg-red-500/20 text-red-400 border-red-500/30";
  if (days >= 11) return "bg-orange-500/20 text-orange-400 border-orange-500/30";
  if (days >= 6)  return "bg-amber-500/20 text-amber-400 border-amber-500/30";
  return "bg-blue-500/20 text-blue-400 border-blue-500/30";
}

export function AgenteComercial({ initialUser }: AgenteComercialProps) {
  const [user] = useState<DashboardUser | null>(initialUser ?? null);
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [threads, setThreads] = useState<PendingThread[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<DraftState>({});
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [loadingLines, setLoadingLines] = useState<string[]>([]);

  // Terminal animation
  useEffect(() => {
    if (status !== "loading") { setLoadingLines([]); return; }
    setLoadingLines([LOADING_SCRIPT[0]]);
    let i = 0;
    const id = setInterval(() => {
      i++;
      if (i < LOADING_SCRIPT.length) {
        setLoadingLines((prev) => [...prev, LOADING_SCRIPT[i]]);
      } else {
        clearInterval(id);
      }
    }, 550);
    return () => clearInterval(id);
  }, [status]);

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
      if (!res.ok) { setErrorMsg(data.error ?? "Error desconocido"); setStatus("error"); return; }
      setThreads(data.pending ?? []);
      setStatus("done");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Error de red.");
      setStatus("error");
    }
  }

  function removeThread(threadId: string) {
    setTimeout(() => setThreads((prev) => prev.filter((t) => t.threadId !== threadId)), 1500);
  }

  async function handleCrearDraft(thread: PendingThread) {
    setDrafts((prev) => ({ ...prev, [thread.threadId]: "loading-draft" }));
    try {
      const res = await fetch("/api/gmail/draft", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ threadId: thread.threadId, clientName: thread.clientName, clientEmail: thread.clientEmail, subject: thread.subject }),
      });
      const data = await res.json();
      if (!res.ok) { setDrafts((prev) => ({ ...prev, [thread.threadId]: "error-draft" })); setErrorMsg(data.error ?? "Error al crear borrador"); return; }
      setDrafts((prev) => ({ ...prev, [thread.threadId]: "done-draft" }));
      showSuccess(`Borrador creado para ${thread.clientName}`);
      removeThread(thread.threadId);
    } catch { setDrafts((prev) => ({ ...prev, [thread.threadId]: "error-draft" })); }
  }

  async function handleEnviar(thread: PendingThread) {
    setDrafts((prev) => ({ ...prev, [thread.threadId]: "loading-send" }));
    try {
      const res = await fetch("/api/gmail/send", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ threadId: thread.threadId, clientName: thread.clientName, clientEmail: thread.clientEmail, subject: thread.subject }),
      });
      const data = await res.json();
      if (!res.ok) { setDrafts((prev) => ({ ...prev, [thread.threadId]: "error-send" })); setErrorMsg(data.error ?? "Error al enviar"); return; }
      setDrafts((prev) => ({ ...prev, [thread.threadId]: "done-send" }));
      showSuccess(`Mail enviado a ${thread.clientName}`);
      removeThread(thread.threadId);
    } catch { setDrafts((prev) => ({ ...prev, [thread.threadId]: "error-send" })); }
  }

  async function handleSignOut() {
    const client = getSupabase();
    if (client) { await client.auth.signOut(); window.location.href = "/login"; }
  }

  const bucketData = BUCKETS.map((b) => ({
    ...b,
    count: threads.filter((t) => t.daysSinceLastReply >= b.min && t.daysSinceLastReply <= b.max).length,
  }));

  return (
    <div className="min-h-screen bg-background pb-8">
      {/* Toast */}
      {successMessage && (
        <div className="fixed bottom-6 left-4 right-4 sm:left-auto sm:right-6 sm:max-w-sm z-50 rounded-lg bg-emerald-600 text-white px-4 py-3 text-sm font-medium shadow-lg animate-in fade-in slide-in-from-bottom-2" role="status">
          {successMessage}
        </div>
      )}

      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 sm:py-5">
          <Link href="/" className="flex items-center gap-2 sm:gap-3 min-w-0">
            <div className="flex h-8 w-8 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-lg bg-primary overflow-hidden">
              <Image src="/isotipo.png" alt="Reyes Finance" width={36} height={36} className="h-8 w-8 sm:h-9 sm:w-9 object-cover" priority />
            </div>
            <div className="min-w-0">
              <h1 className="text-base sm:text-lg font-semibold tracking-tight truncate">Reyes de la IA Finance</h1>
              <p className="text-[10px] sm:text-xs text-muted-foreground hidden sm:block">Agente Comercial</p>
            </div>
          </Link>

          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <nav className="flex items-center gap-1">
              <Link href="/finanzas">
                <Button variant="ghost" size="sm" className="gap-1.5 text-xs sm:text-sm text-muted-foreground hover:text-foreground">
                  <LayoutDashboard className="h-4 w-4" /><span className="hidden sm:inline">Finanzas</span>
                </Button>
              </Link>
              <Button variant="secondary" size="sm" className="gap-1.5 text-xs sm:text-sm" disabled>
                <Bot className="h-4 w-4" /><span className="hidden sm:inline">Agente</span>
              </Button>
            </nav>
            {user && (
              <div className="flex items-center gap-1.5 sm:gap-2">
                {user.avatar ? (
                  <img src={user.avatar} alt={user.name ?? "Avatar"} className="h-8 w-8 sm:h-9 sm:w-9 rounded-full object-cover ring-2 ring-border" referrerPolicy="no-referrer" />
                ) : (
                  <div className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-full bg-muted ring-2 ring-border text-xs font-medium text-muted-foreground">
                    {(user.name ?? "U").charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
            )}
            <Button variant="ghost" size="sm" className="min-h-[44px] min-w-[44px] sm:min-w-0 text-xs sm:text-sm" onClick={handleSignOut}>
              <span className="hidden sm:inline">Cerrar sesión</span><span className="sm:hidden">Salir</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="mx-auto max-w-4xl px-4 sm:px-6 py-6 sm:py-10 space-y-6">

        {/* Hero */}
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-2xl font-bold tracking-tight">Agente Comercial</h2>
            <p className="text-sm text-muted-foreground">
              Detecta conversaciones de Gmail sin respuesta en los últimos 5+ días.
            </p>
          </div>
          <Button
            size="lg"
            onClick={handleEjecutar}
            disabled={status === "loading"}
            className="gap-2 shrink-0"
          >
            {status === "loading" ? (
              <><div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground/40 border-t-primary-foreground" />Analizando...</>
            ) : status === "done" ? (
              <><RefreshCw className="h-4 w-4" />Actualizar</>
            ) : (
              <><Bot className="h-4 w-4" />Ejecutar agente</>
            )}
          </Button>
        </div>

        {/* Error */}
        {status === "error" && errorMsg && (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">{errorMsg}</div>
        )}

        {/* Terminal loading */}
        {status === "loading" && (
          <div className="rounded-xl border border-border/50 bg-zinc-950 px-5 py-4 font-mono text-xs space-y-1.5 shadow-inner">
            <div className="flex items-center gap-2 mb-3">
              <div className="h-2.5 w-2.5 rounded-full bg-red-500/70" />
              <div className="h-2.5 w-2.5 rounded-full bg-amber-500/70" />
              <div className="h-2.5 w-2.5 rounded-full bg-emerald-500/70" />
              <span className="ml-1 text-zinc-500 text-[10px]">agente-comercial.sh</span>
            </div>
            {loadingLines.map((line, i) => (
              <p key={i} className={line.startsWith("✓") ? "text-emerald-400" : "text-zinc-300"}>
                {line}
              </p>
            ))}
            <p className="text-zinc-500 animate-pulse">▋</p>
          </div>
        )}

        {/* Results */}
        {status === "done" && (
          <div className="space-y-6">

            {threads.length === 0 ? (
              <Card className="border-emerald-500/20">
                <CardContent className="flex items-center gap-3 py-5">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-500/10">
                    <Mail className="h-4 w-4 text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-emerald-400">Todo al día</p>
                    <p className="text-xs text-muted-foreground">Sin conversaciones sin respuesta por más de 5 días.</p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <>
                {/* ── Dashboard de resumen ── */}
                <div className="space-y-4">
                  {/* Stat cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {bucketData.map((b) => (
                      <Card key={b.label} className={`border ${b.border}`}>
                        <CardContent className={`py-3 px-4 ${b.bg} rounded-xl`}>
                          <p className={`text-2xl font-bold ${b.color}`}>{b.count}</p>
                          <p className="text-[11px] text-muted-foreground mt-0.5">{b.label}</p>
                        </CardContent>
                      </Card>
                    ))}
                  </div>

                  {/* Bar chart */}
                  <Card className="border-border/40">
                    <CardContent className="pt-4 pb-2 px-4">
                      <p className="text-xs text-muted-foreground mb-3">Distribución por días sin respuesta</p>
                      <ResponsiveContainer width="100%" height={110}>
                        <BarChart data={bucketData} margin={{ top: 0, right: 8, left: -20, bottom: 0 }}>
                          <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#71717a" }} axisLine={false} tickLine={false} />
                          <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: "#71717a" }} axisLine={false} tickLine={false} />
                          <Tooltip
                            cursor={{ fill: "rgba(255,255,255,0.04)" }}
                            contentStyle={{ background: "#18181b", border: "1px solid #27272a", borderRadius: 8, fontSize: 12 }}
                            labelStyle={{ color: "#a1a1aa" }}
                            itemStyle={{ color: "#e4e4e7" }}
                            formatter={(v: number | undefined) => [`${v ?? 0} contacto${(v ?? 0) !== 1 ? "s" : ""}`, ""]}
                          />
                          <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                            {bucketData.map((b, i) => <Cell key={i} fill={b.bar} />)}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                </div>

                {/* ── Lista de contactos ── */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-medium">
                      {threads.length} conversación{threads.length !== 1 ? "es" : ""} sin respuesta
                    </h3>
                    <Badge variant="outline" className="bg-amber-500/10 text-amber-400 border-amber-500/30 text-xs">
                      Requiere seguimiento
                    </Badge>
                  </div>

                  <div className="flex flex-col gap-2">
                    {threads.map((thread) => {
                      const state = drafts[thread.threadId] ?? "idle";
                      const busy = state === "loading-draft" || state === "loading-send";
                      const done = state === "done-draft" || state === "done-send";
                      return (
                        <Card key={thread.threadId} className="border-border/50 transition-all hover:border-border">
                          <CardContent className="py-3 px-4">
                            <div className="flex items-center gap-3">
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-medium truncate">{thread.clientName}</span>
                                  <Badge variant="outline" className={`shrink-0 text-[10px] px-1.5 py-0 ${urgencyBadge(thread.daysSinceLastReply)}`}>
                                    <Clock className="mr-0.5 h-2.5 w-2.5" />{thread.daysSinceLastReply}d
                                  </Badge>
                                </div>
                                <p className="text-[11px] text-muted-foreground truncate">
                                  {thread.clientEmail}
                                  {thread.subject && <span className="ml-2 italic opacity-70">{thread.subject}</span>}
                                </p>
                              </div>

                              {done ? (
                                <div className="flex shrink-0 items-center gap-1.5 text-[11px] text-emerald-400">
                                  <Send className="h-3 w-3" />
                                  {state === "done-send" ? "Enviado" : "Borrador listo"}
                                </div>
                              ) : (
                                <div className="flex shrink-0 items-center gap-1.5">
                                  <Button size="sm" variant="outline" className="h-7 px-2.5 text-xs gap-1" disabled={busy} onClick={() => handleCrearDraft(thread)}>
                                    {state === "loading-draft" ? <div className="h-3 w-3 animate-spin rounded-full border-2 border-muted-foreground border-t-foreground" /> : <Mail className="h-3 w-3" />}
                                    Borrador
                                  </Button>
                                  <Button size="sm" className="h-7 px-2.5 text-xs gap-1" disabled={busy} onClick={() => handleEnviar(thread)}>
                                    {state === "loading-send" ? <div className="h-3 w-3 animate-spin rounded-full border-2 border-primary-foreground/40 border-t-primary-foreground" /> : <Send className="h-3 w-3" />}
                                    Enviar
                                  </Button>
                                </div>
                              )}
                            </div>
                            {(state === "error-draft" || state === "error-send") && (
                              <p className="mt-1 text-[11px] text-destructive">
                                {state === "error-send" ? "Error al enviar." : "Error al crear borrador."}
                              </p>
                            )}
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        <footer className="pt-4 text-center">
          <p className="text-xs text-muted-foreground">Reyes de la IA Finance &mdash; Powered by Reyes IA</p>
        </footer>
      </main>
    </div>
  );
}
