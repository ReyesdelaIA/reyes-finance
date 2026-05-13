"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { normalizeServicio } from "@/lib/utils";

interface Proyecto {
  precio: number;
  estado_pago: string;
  fecha_terminado: string;
  servicio_contratado?: string;
  [key: string]: unknown;
}

function formatCLPShort(value: number) {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value}`;
}

function formatCLP(value: number) {
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

const MONTH_NAMES = [
  "Ene", "Feb", "Mar", "Abr", "May", "Jun",
  "Jul", "Ago", "Sep", "Oct", "Nov", "Dic",
];

const SERVICIOS_COLORS = [
  "#34d399", "#818cf8", "#fbbf24", "#f87171",
  "#a78bfa", "#22d3ee", "#fb923c", "#4ade80",
];

interface Props {
  proyectos: Proyecto[];
}

export function AnalyticsCharts({ proyectos }: Props) {
  // --- Bar chart: rolling last 12 months (todo facturado, excepto "por facturar") ---
  const billedWithDate = proyectos.filter(
    (p) =>
      p.fecha_terminado &&
      p.precio != null &&
      p.estado_pago?.toLowerCase() !== "por facturar"
  );

  type BarPoint = { name: string; total: number; year: number };
  let barData: BarPoint[] = [];

  if (billedWithDate.length > 0) {
    // 1) Agregar todos los montos por año-mes
    const monthlyMap = new Map<string, number>(); // key: "YYYY-M" con M 0-11
    for (const p of billedWithDate) {
      const d = new Date(p.fecha_terminado as string);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      monthlyMap.set(key, (monthlyMap.get(key) ?? 0) + (p.precio as number));
    }

    // 2) Encontrar el último mes con datos
    const monthDates = Array.from(monthlyMap.keys()).map((key) => {
      const [y, m] = key.split("-").map(Number);
      return new Date(y, m, 1);
    });
    const latestTime = Math.max(...monthDates.map((d) => d.getTime()));
    const latestDate = new Date(latestTime);

    // 3) Construir los últimos 12 meses (aunque alguno tenga 0)
    const points: BarPoint[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(
        latestDate.getFullYear(),
        latestDate.getMonth() - i,
        1
      );
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      const total = monthlyMap.get(key) ?? 0;
      points.push({
        name: MONTH_NAMES[d.getMonth()],
        total,
        year: d.getFullYear(),
      });
    }

    barData = points;
  }

  // --- Pie chart: servicios más contratados (todo facturado, excepto "por facturar") ---
  const serviceMap = new Map<string, number>();
  for (const p of proyectos) {
    if (p.precio == null || p.estado_pago?.toLowerCase() === "por facturar") continue;
    const nombre =
      normalizeServicio(p.servicio_contratado) ||
      (p.servicio_contratado || "Sin especificar").trim();
    serviceMap.set(nombre, (serviceMap.get(nombre) ?? 0) + p.precio);
  }

  const servicesData = Array.from(serviceMap.entries())
    .map(([name, value]) => ({ name, value: Number(value) }))
    .filter((d) => d.value > 0 && !Number.isNaN(d.value))
    .sort((a, b) => b.value - a.value); // Mayor a menor

  const hasBarData = barData.length > 0;
  const hasServicesData = servicesData.length > 0;

  if (!hasBarData && !hasServicesData) return null;

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:items-stretch">
      {/* Bar Chart */}
      <Card className="overflow-hidden">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Ventas Mensuales
          </CardTitle>
        </CardHeader>
        <CardContent>
          {hasBarData ? (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={barData}>
                <XAxis
                  dataKey="name"
                  tick={{ fill: "#a1a1aa", fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: "#a1a1aa", fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={formatCLPShort}
                  domain={[0, "dataMax"]}
                />
                <Tooltip
                  formatter={(value: unknown) => [
                    formatCLP(Number(value ?? 0)),
                    "Ventas",
                  ]}
                  labelFormatter={(label: unknown, payload: unknown) => {
                    const p = Array.isArray(payload) ? payload[0] : null;
                    const year = (p as { payload?: { year?: number } })?.payload?.year;
                    return year ? `${label} ${year}` : String(label ?? "");
                  }}
                  contentStyle={{
                    backgroundColor: "#18181b",
                    border: "1px solid #27272a",
                    borderRadius: "8px",
                    color: "#fafafa",
                  }}
                />
                <Bar
                  dataKey="total"
                  fill="#818cf8"
                  radius={[6, 6, 0, 0]}
                  stroke="none"
                  activeBar={{ fill: "#818cf8", stroke: "none" }}
                />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-[240px] items-center justify-center">
              <p className="text-sm text-muted-foreground">Sin datos aún</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Barras horizontales: Servicios más contratados */}
      <Card className="overflow-hidden">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Servicios más contratados
          </CardTitle>
          <CardDescription className="text-xs">
            Ventas históricas por línea de producto (mayor a menor)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {hasServicesData ? (
            <ResponsiveContainer width="100%" height={Math.min(280, Math.max(200, servicesData.length * 36))}>
              <BarChart
                data={servicesData}
                layout="vertical"
                margin={{ top: 4, right: 20, left: 0, bottom: 4 }}
              >
                <XAxis
                  type="number"
                  tick={{ fill: "#a1a1aa", fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={formatCLPShort}
                  domain={[0, "dataMax"]}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={130}
                  tick={{ fill: "#a1a1aa", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  formatter={(value: unknown, _name: unknown, props: unknown) => {
                    const num = Number(value ?? 0);
                    const total = servicesData.reduce((a, d) => a + d.value, 0);
                    const pct =
                      total > 0 ? ((num / total) * 100).toFixed(1) : "0";
                    const payload = (props as { payload?: { name?: string } })?.payload;
                    return [
                      `${formatCLP(num)} (${pct}%)`,
                      payload?.name ?? "Ventas",
                    ];
                  }}
                  contentStyle={{
                    backgroundColor: "#ffffff",
                    border: "1px solid #e5e5e5",
                    borderRadius: "8px",
                    color: "#18181b",
                  }}
                  itemStyle={{ color: "#18181b" }}
                  labelStyle={{ color: "#18181b" }}
                />
                <Bar
                  dataKey="value"
                  radius={[0, 4, 4, 0]}
                  stroke="none"
                  activeBar={{ stroke: "none" }}
                >
                  {servicesData.map((_, i) => (
                    <Cell
                      key={i}
                      fill={SERVICIOS_COLORS[i % SERVICIOS_COLORS.length]}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-[240px] items-center justify-center">
              <p className="text-sm text-muted-foreground">Sin datos aún</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
