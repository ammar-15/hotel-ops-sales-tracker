import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Today's date as YYYY-MM-DD in the viewer's (server's) local time zone. */
export function todayISO(tz = process.env.APP_TIMEZONE || "America/Toronto") {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

export function fmtDate(d: string | null | undefined, opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" }) {
  if (!d) return "—";
  const date = d.length === 10 ? new Date(d + "T12:00:00") : new Date(d);
  return date.toLocaleDateString("en-CA", opts);
}

export function fmtDateTime(d: string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleString("en-CA", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export function money(n: number | null | undefined) {
  if (n == null || isNaN(Number(n))) return "—";
  return new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 }).format(Number(n));
}

export function pct(n: number, d: number) {
  if (!d) return "0%";
  return Math.round((n / d) * 100) + "%";
}

export const str = (v: FormDataEntryValue | null) => {
  const s = (v ?? "").toString().trim();
  return s === "" ? null : s;
};
export const num = (v: FormDataEntryValue | null) => {
  const s = (v ?? "").toString().trim();
  if (s === "") return null;
  const n = Number(s.replace(/[^0-9.-]/g, ""));
  return isNaN(n) ? null : n;
};
export const bool = (v: FormDataEntryValue | null) => v === "on" || v === "true" || v === "yes";
