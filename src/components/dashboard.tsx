"use client";

import { useEffect, useState, useMemo } from "react";
import Image from "next/image";
import { supabase } from "@/lib/supabase";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ProyectoModal, type ProyectoData } from "@/components/proyecto-modal";
import { AnalyticsCharts } from "@/components/analytics-charts";
import { normalizeServicio } from "@/lib/utils";

export interface DashboardUser {
  name?: string;
  email?: string;
  avatar?: string;
}

interface Proyecto {
  id: number;
  cliente: string;
  servicio_contratado: string;
  estado: string;
  precio: number;
  contacto: string;
  estado_pago: string;
  fecha_terminado: string;
  [key: string]: unknown;
}

function formatCLP(value: number) {
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(dateStr: string) {
  return new Intl.DateTimeFormat("es-CL", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(dateStr));
}

function estadoBadgeClass(estado: string) {
  const lower = estado?.toLowerCase() ?? "";
  if (lower === "agendado!")
    return "bg-blue-500/20 text-blue-400 border-blue-500/30";
  if (lower === "curso hecho :)")
    return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
  return "bg-muted text-muted-foreground border-border";
}

function estadoPagoBadgeClass(estadoPago: string) {
  const lower = estadoPago?.toLowerCase() ?? "";
  if (lower === "pago completo")
    return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
  if (lower === "esperando pago")
    return "bg-amber-500/20 text-amber-400 border-amber-500/30";
  if (lower === "por facturar")
    return "bg-red-500/20 text-red-400 border-red-500/30";
  return "bg-muted text-muted-foreground border-border";
}

interface DashboardProps {
  initialUser?: DashboardUser | null;
}

export function Dashboard({ initialUser }: DashboardProps) {
  const [proyectos, setProyectos] = useState<Proyecto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<DashboardUser | null>(initialUser ?? null);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<"cliente" | "precio" | "fecha_terminado">(
    "fecha_terminado"
  );
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<ProyectoData | null>(
    null
  );

  async function fetchProyectos() {
    if (!supabase) {
      setError(
        "Supabase no configurado. Agrega NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY en .env.local"
      );
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("proyectos")
      .select("*")
      .order("id", { ascending: true });

    if (error) {
      setError(error.message);
    } else {
      setProyectos(data ?? []);
    }
    setLoading(false);
  }

  useEffect(() => {
    fetchProyectos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sincronizar initialUser y escuchar cambios de auth
  useEffect(() => {
    if (initialUser) setUser(initialUser);
    if (!supabase) return;
    const applyUser = (u: {
      user_metadata?: Record<string, unknown>;
      email?: string;
      identities?: Array<{ identity_data?: Record<string, unknown> }>;
    } | null) => {
      if (!u) return;
      const meta = u.user_metadata ?? {};
      const idData = u.identities?.[0]?.identity_data ?? {};
      const avatar =
        (meta.avatar_url as string) ??
        (meta.picture as string) ??
        (idData.avatar_url as string) ??
        (idData.picture as string) ??
        undefined;
      setUser({
        name:
          (meta.full_name as string) ??
          (meta.name as string) ??
          (idData.full_name as string) ??
          (idData.name as string) ??
          (u.email?.split("@")[0]) ??
          "Usuario",
        email: u.email ?? undefined,
        avatar,
      });
    };
    supabase.auth.getSession().then(({ data: { session } }) => applyUser(session?.user ?? null));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) =>
      applyUser(session?.user ?? null)
    );
    return () => subscription.unsubscribe();
  }, [initialUser]);

  // Filtered + sorted projects
  const filtered = useMemo(() => {
    let result = proyectos;

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((p) => p.cliente?.toLowerCase().includes(q));
    }

    const dir = sortDirection === "asc" ? 1 : -1;

    return [...result].sort((a, b) => {
      if (sortKey === "precio") {
        const aVal = a.precio ?? 0;
        const bVal = b.precio ?? 0;
        return (aVal - bVal) * dir;
      }

      if (sortKey === "fecha_terminado") {
        const aTime = a.fecha_terminado
          ? new Date(a.fecha_terminado).getTime()
          : 0;
        const bTime = b.fecha_terminado
          ? new Date(b.fecha_terminado).getTime()
          : 0;
        return (aTime - bTime) * dir;
      }

      // sortKey === "cliente"
      return (a.cliente ?? "").localeCompare(b.cliente ?? "") * dir;
    });
  }, [proyectos, search, sortKey, sortDirection]);

  function handleSort(key: "cliente" | "precio" | "fecha_terminado") {
    if (sortKey === key) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDirection(key === "cliente" ? "asc" : "desc");
    }
  }

  // KPIs
  const facturacionPendiente = proyectos
    .filter((p) => p.estado_pago?.toLowerCase() === "por facturar")
    .reduce((acc, p) => acc + (p.precio ?? 0), 0);

  const cajaReal = proyectos
    .filter((p) => p.estado_pago?.toLowerCase() === "pago completo")
    .reduce((acc, p) => acc + (p.precio ?? 0), 0);

  const porCobrar = proyectos
    .filter((p) => p.estado_pago?.toLowerCase() === "esperando pago")
    .reduce((acc, p) => acc + (p.precio ?? 0), 0);

  // Ventas por año (según fecha_terminado)
  const ventasPorAnio = useMemo(() => {
    const byYear = new Map<number, number>();
    for (const p of proyectos) {
      if (!p.fecha_terminado || p.precio == null) continue;
      const year = new Date(p.fecha_terminado).getFullYear();
      byYear.set(year, (byYear.get(year) ?? 0) + p.precio);
    }
    return {
      2024: byYear.get(2024) ?? 0,
      2025: byYear.get(2025) ?? 0,
      2026: byYear.get(2026) ?? 0,
    };
  }, [proyectos]);

  function handleNew() {
    setEditingProject(null);
    setModalOpen(true);
  }

  function handleEdit(p: Proyecto) {
    setEditingProject({
      id: p.id,
      cliente: p.cliente ?? "",
      servicio_contratado: normalizeServicio(p.servicio_contratado) || (p.servicio_contratado ?? ""),
      estado: p.estado ?? "",
      precio: p.precio ?? "",
      contacto: p.contacto ?? "",
      estado_pago: p.estado_pago ?? "",
      fecha_terminado: p.fecha_terminado ?? "",
    });
    setModalOpen(true);
  }

  async function handleSave(data: ProyectoData) {
    if (!supabase) return;

    const payload = {
      cliente: data.cliente,
      servicio_contratado: data.servicio_contratado,
      estado: data.estado,
      precio: data.precio === "" ? 0 : Number(data.precio),
      contacto: data.contacto,
      estado_pago: data.estado_pago,
      fecha_terminado: data.fecha_terminado || null,
    };

    if (data.id) {
      const { error } = await supabase
        .from("proyectos")
        .update(payload)
        .eq("id", data.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabase.from("proyectos").insert(payload);
      if (error) throw new Error(error.message);
    }

    await fetchProyectos();
  }

  async function handleDelete(id: number) {
    if (!supabase) return;

    const { error } = await supabase
      .from("proyectos")
      .delete()
      .eq("id", id);

    if (error) throw new Error(error.message);
    await fetchProyectos();
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/40">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary overflow-hidden">
              <Image
                src="/isotipo.png"
                alt="Reyes Finance"
                width={36}
                height={36}
                className="h-9 w-9 object-cover"
                priority
              />
            </div>
            <div>
              <h1 className="text-lg font-semibold tracking-tight">
                Reyes de la IA Finance
              </h1>
              <p className="text-xs text-muted-foreground">
                Dashboard Financiero
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {user && (
              <div className="flex items-center gap-2 min-w-0">
                <div className="h-9 w-9 shrink-0 overflow-hidden rounded-full bg-muted ring-2 ring-border">
                  {user.avatar ? (
                    <Image
                      src={user.avatar}
                      alt={user.name ?? "Avatar"}
                      width={36}
                      height={36}
                      className="h-9 w-9 object-cover"
                      unoptimized
                    />
                  ) : (
                    <div className="flex h-9 w-9 items-center justify-center text-sm font-medium text-muted-foreground">
                      {(user.name ?? "U").charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-sm font-medium truncate">{user.name}</span>
                  {user.email && (
                    <span className="text-xs text-muted-foreground truncate max-w-[160px] sm:max-w-[200px]">
                      {user.email}
                    </span>
                  )}
                </div>
              </div>
            )}
            <Badge variant="outline" className="text-xs font-mono">
              v1.0
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              onClick={async () => {
                if (supabase) {
                  await supabase.auth.signOut();
                  window.location.href = "/login";
                }
              }}
            >
              Cerrar sesión
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-7xl px-6 py-8 space-y-8">
        {/* KPI Cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Card className="border-emerald-500/20">
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-400" />
                Ventas Históricas
              </CardDescription>
              <CardTitle className="text-3xl tabular-nums text-emerald-400">
                {loading ? "--" : formatCLP(cajaReal)}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card className="border-amber-500/20">
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-amber-400" />
                facturado esperando pago
              </CardDescription>
              <CardTitle className="text-3xl tabular-nums text-amber-400">
                {loading ? "--" : formatCLP(porCobrar)}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card className="border-red-500/20">
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-red-400" />
                por facturar
              </CardDescription>
              <CardTitle className="text-3xl tabular-nums text-red-400">
                {loading ? "--" : formatCLP(facturacionPendiente)}
              </CardTitle>
            </CardHeader>
          </Card>
        </div>

        {/* Ventas por año */}
        <div className="flex flex-wrap gap-6 rounded-lg border border-border/40 bg-muted/20 px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="text-xs font-medium text-muted-foreground">
              Ventas 2024
            </span>
            <span className="font-mono text-sm tabular-nums text-foreground">
              {loading ? "--" : formatCLP(ventasPorAnio[2024])}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs font-medium text-muted-foreground">
              Ventas 2025
            </span>
            <span className="font-mono text-sm tabular-nums text-foreground">
              {loading ? "--" : formatCLP(ventasPorAnio[2025])}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs font-medium text-muted-foreground">
              Ventas 2026
            </span>
            <span className="font-mono text-sm tabular-nums text-foreground">
              {loading ? "--" : formatCLP(ventasPorAnio[2026])}
            </span>
          </div>
        </div>

        {/* Analytics Charts */}
        {!loading && proyectos.length > 0 && (
          <div className="rounded-lg border border-border/40 bg-muted/20 p-4">
            <AnalyticsCharts proyectos={proyectos} />
          </div>
        )}

        {/* Funnel Table */}
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle>Pipeline de Servicios</CardTitle>
                <CardDescription>
                  Seguimiento completo del funnel de clientes
                </CardDescription>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                <Input
                  placeholder="Buscar cliente..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="sm:max-w-xs"
                />
                <Button onClick={handleNew} size="sm">
                  + Nuevo Proyecto
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-muted-foreground border-t-primary" />
              </div>
            ) : error ? (
              <div className="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-6 text-center">
                <p className="text-sm text-destructive font-medium">
                  Error al cargar datos
                </p>
                <p className="mt-1 text-xs text-muted-foreground">{error}</p>
              </div>
            ) : filtered.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-sm text-muted-foreground">
                  {search
                    ? "No se encontraron clientes"
                    : "No hay registros en el funnel"}
                </p>
              </div>
            ) : (
              <div className="rounded-lg border border-border/50 overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead
                        className="cursor-pointer select-none"
                        onClick={() => handleSort("cliente")}
                      >
                        <div className="flex items-center gap-1">
                          <span>Cliente</span>
                          <span className="text-[10px] text-muted-foreground">
                            {sortKey === "cliente"
                              ? sortDirection === "asc"
                                ? "↑"
                                : "↓"
                              : "↕"}
                          </span>
                        </div>
                      </TableHead>
                      <TableHead>Servicio Contratado</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead
                        className="text-right cursor-pointer select-none"
                        onClick={() => handleSort("precio")}
                      >
                        <div className="flex items-center justify-end gap-1">
                          <span>Precio</span>
                          <span className="text-[10px] text-muted-foreground">
                            {sortKey === "precio"
                              ? sortDirection === "asc"
                                ? "↑"
                                : "↓"
                              : "↕"}
                          </span>
                        </div>
                      </TableHead>
                      <TableHead className="w-[9rem]">Contacto</TableHead>
                      <TableHead>Estado de Pago</TableHead>
                      <TableHead
                        className="text-right cursor-pointer select-none"
                        onClick={() => handleSort("fecha_terminado")}
                      >
                        <div className="flex items-center justify-end gap-1">
                          <span>Fecha Terminado</span>
                          <span className="text-[10px] text-muted-foreground">
                            {sortKey === "fecha_terminado"
                              ? sortDirection === "asc"
                                ? "↑"
                                : "↓"
                              : "↕"}
                          </span>
                        </div>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((p) => (
                      <TableRow
                        key={p.id}
                        className="cursor-pointer"
                        onClick={() => handleEdit(p)}
                      >
                        <TableCell className="font-medium">
                          {p.cliente}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {normalizeServicio(p.servicio_contratado) || p.servicio_contratado || "--"}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={estadoBadgeClass(p.estado)}
                          >
                            {p.estado}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {p.precio != null ? formatCLP(p.precio) : "--"}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-xs sm:text-sm">
                          <span className="block max-w-[9rem] truncate">
                            {p.contacto ?? "--"}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={estadoPagoBadgeClass(p.estado_pago)}
                          >
                            {p.estado_pago}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {p.fecha_terminado
                            ? formatDate(p.fecha_terminado)
                            : "--"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Footer */}
        <footer className="pb-8 text-center">
          <p className="text-xs text-muted-foreground">
            Reyes de la IA Finance &mdash; Powered by Reyes IA
          </p>
        </footer>
      </main>

      {/* Modal */}
      <ProyectoModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={handleSave}
        onDelete={handleDelete}
        initialData={editingProject}
      />
    </div>
  );
}
