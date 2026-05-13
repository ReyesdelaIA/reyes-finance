import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** YYYY-MM-DD en zona local (para `<input type="date">`) */
export function fechaLocalHoyISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Compara estado de pago tras normalizar espacios (evita fallos con espacios raros / copiar-pegar). */
export function esEsperandoPago(estado: string | undefined | null): boolean {
  if (!estado?.trim()) return false;
  return estado.toLowerCase().replace(/\s+/g, " ").trim() === "esperando pago";
}

/** Convierte lo que venga de Postgres (date / timestamptz como string) a YYYY-MM-DD para el input. */
export function fechaDesdeSupabaseParaInput(val: unknown): string {
  if (val == null || val === "") return "";
  const s = String(val).trim();
  if (!s) return "";
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(s);
  return m?.[1] ?? "";
}

/** Normaliza "Taller IA - Administrativos" y "Taller IA - Abogados" a "Talleres IA" */
export function normalizeServicio(s: string | undefined): string {
  if (!s?.trim()) return "";
  const t = s.trim().toLowerCase().replace(/\s+/g, " ");
  if (
    t === "taller ia - administrativos" ||
    t === "taller ia - abogados" ||
    t === "taller ia administrativos" ||
    t === "taller ia abogados"
  ) {
    return "Talleres IA";
  }
  return s.trim();
}
