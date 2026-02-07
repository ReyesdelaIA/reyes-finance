import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
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
