import Link from "next/link";
import { cn } from "@/lib/utils";
import { STAGES, type Stage } from "@/lib/constants";
import { classify } from "@/lib/scoring";
import type { ComponentProps, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "success";
const variants: Record<Variant, string> = {
  primary: "bg-brand-600 text-white hover:bg-brand-700 shadow-sm",
  secondary: "bg-white text-slate-800 border border-slate-300 hover:bg-slate-50 shadow-xs",
  ghost: "text-slate-600 hover:bg-slate-100",
  danger: "bg-white text-red-700 border border-red-200 hover:bg-red-50",
  success: "bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm",
};
const sizes = { sm: "h-8 px-3 text-xs", md: "h-9 px-4 text-sm", lg: "h-11 px-5 text-base" };

export function buttonClass(variant: Variant = "primary", size: keyof typeof sizes = "md", className?: string) {
  return cn(
    "inline-flex items-center justify-center gap-1.5 rounded-md font-medium whitespace-nowrap transition-colors disabled:opacity-50 disabled:pointer-events-none",
    variants[variant],
    sizes[size],
    className
  );
}

export function Button({
  variant,
  size,
  className,
  ...props
}: ComponentProps<"button"> & { variant?: Variant; size?: keyof typeof sizes }) {
  return <button className={buttonClass(variant, size, className)} {...props} />;
}

export function LinkButton({
  variant,
  size,
  className,
  ...props
}: ComponentProps<typeof Link> & { variant?: Variant; size?: keyof typeof sizes }) {
  return <Link className={buttonClass(variant, size, className)} {...props} />;
}

export type Tone = "gray" | "blue" | "green" | "amber" | "red" | "purple";
const tones: Record<Tone, string> = {
  gray: "bg-slate-100 text-slate-700 ring-slate-200",
  blue: "bg-blue-50 text-blue-700 ring-blue-200",
  green: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  amber: "bg-amber-50 text-amber-800 ring-amber-200",
  red: "bg-red-50 text-red-700 ring-red-200",
  purple: "bg-violet-50 text-violet-700 ring-violet-200",
};

export function Badge({ tone = "gray", className, children }: { tone?: Tone; className?: string; children: ReactNode }) {
  return (
    <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset whitespace-nowrap", tones[tone], className)}>
      {children}
    </span>
  );
}

export function StageBadge({ stage, status }: { stage: Stage; status?: string | null }) {
  const s = STAGES[stage] ?? STAGES.prospect;
  if (stage === "stage2" && status) {
    const tone: Tone = status === "Won" ? "green" : status === "Lost" ? "red" : "purple";
    return <Badge tone={tone}>{status}</Badge>;
  }
  return <Badge tone={s.tone as Tone}>{s.label}</Badge>;
}

export function ScoreBadge({ score, label }: { score: number | null | undefined; label?: string }) {
  const c = classify(score);
  const text = label ?? c.label;
  if (score == null) return <Badge tone="gray">—</Badge>;
  return (
    <Badge tone={c.tone}>
      <span className="font-semibold tabular-nums">{score}</span>
      <span className="ml-1 opacity-80">{text}</span>
    </Badge>
  );
}

export function Card({ className, children, title, action }: { className?: string; children: ReactNode; title?: ReactNode; action?: ReactNode }) {
  return (
    <section className={cn("rounded-lg border border-slate-200 bg-white shadow-xs", className)}>
      {title && (
        <header className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-800">{title}</h2>
          {action}
        </header>
      )}
      <div className={title ? "p-4" : ""}>{children}</div>
    </section>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="py-6 text-center text-sm text-slate-400">{children}</p>;
}

export function Field({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <label className={cn("block", className)}>
      <span className="label">{label}</span>
      {children}
    </label>
  );
}

export function HotelFacts({ h }: { h: { rooms: number | null; airport: boolean; shuttle: boolean; long_term_parking: boolean; short_term_parking: boolean; city?: string | null } }) {
  const bits = [
    h.rooms ? `${h.rooms} rooms` : null,
    h.airport ? "Airport" : null,
    h.shuttle ? "Shuttle" : null,
    h.long_term_parking || h.short_term_parking ? "Parking" : null,
    h.city ?? null,
  ].filter(Boolean);
  return <span className="text-xs text-slate-500">{bits.join(" · ") || "—"}</span>;
}
