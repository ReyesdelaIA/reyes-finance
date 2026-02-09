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
import { Download } from "lucide-react";

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

type EstadoPagoFiltro = "todos" | "pago completo" | "esperando pago" | "por facturar";
type PeriodoFiltro = "todos" | "este-mes" | "mes-pasado" | "este-trimestre" | "este-año" | "año-pasado";

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
  const [estadoPagoFiltro, setEstadoPagoFiltro] =
    useState<EstadoPagoFiltro>("todos");
  const [periodoFiltro, setPeriodoFiltro] = useState<PeriodoFiltro>("todos");

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

    if (estadoPagoFiltro !== "todos") {
      const target = estadoPagoFiltro.toLowerCase();
      result = result.filter(
        (p) => p.estado_pago?.toLowerCase() === target
      );
    }

    // Filtro por período (basado en fecha_terminado)
    if (periodoFiltro !== "todos" && periodoFiltro) {
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth();
      const currentQuarter = Math.floor(currentMonth / 3);

      result = result.filter((p) => {
        if (!p.fecha_terminado) return false;
        const fecha = new Date(p.fecha_terminado);
        const fechaYear = fecha.getFullYear();
        const fechaMonth = fecha.getMonth();
        const fechaQuarter = Math.floor(fechaMonth / 3);

        switch (periodoFiltro) {
          case "este-mes":
            return fechaYear === currentYear && fechaMonth === currentMonth;
          case "mes-pasado":
            const mesPasado = currentMonth === 0 ? 11 : currentMonth - 1;
            const añoMesPasado = currentMonth === 0 ? currentYear - 1 : currentYear;
            return fechaYear === añoMesPasado && fechaMonth === mesPasado;
          case "este-trimestre":
            return fechaYear === currentYear && fechaQuarter === currentQuarter;
          case "este-año":
            return fechaYear === currentYear;
          case "año-pasado":
            return fechaYear === currentYear - 1;
          default:
            return true;
        }
      });
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
  }, [proyectos, search, sortKey, sortDirection, estadoPagoFiltro, periodoFiltro]);

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

  // Exportar a CSV
  function handleExportCSV() {
    const headers = [
      "Cliente",
      "Servicio Contratado",
      "Estado",
      "Precio (CLP)",
      "Contacto",
      "Estado de Pago",
      "Fecha Terminado",
    ];

    // Escapar valores que contengan comas o comillas
    const escapeCSV = (value: string | number | null | undefined): string => {
      if (value == null) return "";
      const str = String(value);
      if (str.includes(",") || str.includes('"') || str.includes("\n")) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const rows = filtered.map((p) => [
      escapeCSV(p.cliente),
      escapeCSV(normalizeServicio(p.servicio_contratado) || p.servicio_contratado),
      escapeCSV(p.estado),
      escapeCSV(p.precio != null ? formatCLP(p.precio).replace(/[^\d]/g, "") : ""),
      escapeCSV(p.contacto),
      escapeCSV(p.estado_pago),
      escapeCSV(p.fecha_terminado),
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.join(",")),
    ].join("\n");

    // Crear blob y descargar
    const blob = new Blob(["\ufeff" + csvContent], {
      type: "text/csv;charset=utf-8;",
    }); // BOM para Excel
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    const fecha = new Date().toISOString().split("T")[0];
    link.download = `reyes-finance-proyectos-${fecha}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

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
    <div className="min-h-screen bg-background pb-24 sm:pb-8">
      {/* Header - compacto en móvil */}
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
                Dashboard Financiero
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {user && (
              <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                <div className="h-8 w-8 sm:h-9 sm:w-9 shrink-0 overflow-hidden rounded-full bg-muted ring-2 ring-border">
                  {user.avatar ? (
                    <Image
                      src={user.avatar}
                      alt={user.name ?? "Avatar"}
                      width={36}
                      height={36}
                      className="h-8 w-8 sm:h-9 sm:w-9 object-cover"
                      unoptimized
                    />
                  ) : (
                    <div className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center text-xs sm:text-sm font-medium text-muted-foreground">
                      {(user.name ?? "U").charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
                <div className="hidden sm:flex flex-col min-w-0 max-w-[140px]">
                  <span className="text-sm font-medium truncate">{user.name}</span>
                  {user.email && (
                    <span className="text-xs text-muted-foreground truncate">
                      {user.email}
                    </span>
                  )}
                </div>
              </div>
            )}
            <Badge variant="outline" className="text-[10px] sm:text-xs font-mono hidden sm:flex">
              v1.0
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              className="min-h-[44px] min-w-[44px] sm:min-w-0 text-xs sm:text-sm"
              onClick={async () => {
                if (supabase) {
                  await supabase.auth.signOut();
                  window.location.href = "/login";
                }
              }}
            >
              <span className="hidden sm:inline">Cerrar sesión</span>
              <span className="sm:hidden">Salir</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-7xl px-4 sm:px-6 py-4 sm:py-8 space-y-6 sm:space-y-8">
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
        <div className="flex flex-wrap gap-4 sm:gap-6 rounded-lg border border-border/40 bg-muted/20 px-4 sm:px-5 py-3 sm:py-4">
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
              <div className="flex flex-col gap-3 sm:items-end sm:gap-3">
                <div className="flex flex-col gap-2 w-full sm:w-auto">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      Estado de pago:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        { label: "Todos", value: "todos" as EstadoPagoFiltro },
                        {
                          label: "Pago completo",
                          value: "pago completo" as EstadoPagoFiltro,
                        },
                        {
                          label: "Esperando pago",
                          value: "esperando pago" as EstadoPagoFiltro,
                        },
                        {
                          label: "Por facturar",
                          value: "por facturar" as EstadoPagoFiltro,
                        },
                      ].map((filtro) => (
                        <Button
                          key={filtro.value}
                          type="button"
                          variant={
                            estadoPagoFiltro === filtro.value
                              ? "default"
                              : "outline"
                          }
                          size="xs"
                          className="h-7 rounded-full px-3 text-xs"
                          onClick={() => setEstadoPagoFiltro(filtro.value)}
                        >
                          {filtro.label}
                        </Button>
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      Período:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        { label: "Todos", value: "todos" as PeriodoFiltro },
                        { label: "Este mes", value: "este-mes" as PeriodoFiltro },
                        { label: "Mes pasado", value: "mes-pasado" as PeriodoFiltro },
                        { label: "Este trimestre", value: "este-trimestre" as PeriodoFiltro },
                        { label: "Este año", value: "este-año" as PeriodoFiltro },
                        { label: "Año pasado", value: "año-pasado" as PeriodoFiltro },
                      ].map((filtro) => (
                        <Button
                          key={filtro.value}
                          type="button"
                          variant={
                            periodoFiltro === filtro.value
                              ? "default"
                              : "outline"
                          }
                          size="xs"
                          className="h-7 rounded-full px-3 text-xs"
                          onClick={() => setPeriodoFiltro(filtro.value)}
                        >
                          {filtro.label}
                        </Button>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                  <Input
                    placeholder="Buscar cliente..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="sm:max-w-xs min-h-[44px] sm:min-h-0"
                  />
                  {filtered.length > 0 && (
                    <Button
                      onClick={handleExportCSV}
                      variant="outline"
                      size="sm"
                      className="min-h-[44px] gap-2"
                    >
                      <Download className="h-4 w-4" />
                      <span className="hidden sm:inline">Exportar CSV</span>
                      <span className="sm:hidden">CSV</span>
                    </Button>
                  )}
                  <Button
                    onClick={handleNew}
                    size="sm"
                    className="min-h-[44px]"
                  >
                    + Nuevo Proyecto
                  </Button>
                </div>
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
              <>
                {/* Vista móvil: cards táctiles */}
                <div className="space-y-3 md:hidden">
                  {filtered.map((p) => (
                    <div
                      key={p.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => handleEdit(p)}
                      onKeyDown={(e) => e.key === "Enter" && handleEdit(p)}
                      className="rounded-lg border border-border/50 p-4 active:bg-muted/50 transition-colors min-h-[44px]"
                    >
                      <div className="flex justify-between items-start gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="font-medium truncate">{p.cliente}</p>
                          <p className="text-sm text-muted-foreground truncate">
                            {normalizeServicio(p.servicio_contratado) || p.servicio_contratado || "--"}
                          </p>
                        </div>
                        <p className="font-mono text-sm tabular-nums shrink-0">
                          {p.precio != null ? formatCLP(p.precio) : "--"}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        <Badge variant="outline" className={estadoBadgeClass(p.estado)}>
                          {p.estado}
                        </Badge>
                        <Badge variant="outline" className={estadoPagoBadgeClass(p.estado_pago)}>
                          {p.estado_pago}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Vista desktop: tabla */}
                <div className="hidden md:block rounded-lg border border-border/50 overflow-hidden">
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
              </>
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

      {/* FAB móvil: Nuevo Proyecto siempre accesible */}
      <div className="fixed bottom-[max(1.5rem,env(safe-area-inset-bottom))] right-4 z-30 sm:hidden">
        <Button
          size="lg"
          onClick={handleNew}
          className="h-14 w-14 rounded-full shadow-lg"
          aria-label="Nuevo proyecto"
        >
          <span className="text-2xl">+</span>
        </Button>
      </div>

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
