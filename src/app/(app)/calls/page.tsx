import Link from "next/link";
import { Phone } from "lucide-react";
import { requireUser } from "@/lib/supabase/server";
import { getHotels } from "@/lib/data";
import { effectiveScore } from "@/lib/scoring";
import { cn, fmtDate } from "@/lib/utils";
import type { Hotel } from "@/lib/types";
import { Badge, Card, Empty, PageHeader, StageBadge, buttonClass } from "@/components/ui";

export const dynamic = "force-dynamic";

const FILTERS: { key: string; label: string; test: (h: Hotel) => boolean }[] = [
  { key: "airport", label: "Airport hotels", test: (h) => h.airport },
  { key: "open", label: "Stage 1 not completed", test: (h) => !h.stage1_completed_at },
  { key: "shuttle", label: "Shuttle available", test: (h) => h.shuttle },
  { key: "80", label: "80+ rooms", test: (h) => (h.rooms ?? 0) >= 80 },
  { key: "priority", label: "High priority", test: (h) => h.tags.includes("High Priority") },
  { key: "never", label: "Never called", test: (h) => h.inquiry_call_count === 0 },
  { key: "again", label: "Call again required", test: (h) => h.stage === "call_again" },
];

function priority(h: Hotel) {
  return (h.tags.includes("High Priority") ? 50 : 0) + (h.airport ? 10 : 0) + (h.shuttle ? 8 : 0) + ((h.rooms ?? 0) >= 80 ? 5 : 0) + (effectiveScore(h) ?? 0) / 10;
}

export default async function CallsTonight({ searchParams }: { searchParams: Promise<{ f?: string }> }) {
  const { f } = await searchParams;
  const active = new Set((f ?? "open").split(",").filter(Boolean));
  const { supabase } = await requireUser();
  const all = await getHotels(supabase);
  const pool = all.filter((h) => !["not_fit", "stage2"].includes(h.stage));
  const list = pool.filter((h) => FILTERS.every((x) => !active.has(x.key) || x.test(h))).sort((a, b) => priority(b) - priority(a));

  const toggle = (k: string) => {
    const next = new Set(active);
    if (next.has(k)) next.delete(k);
    else next.add(k);
    return `/calls?f=${[...next].join(",")}`;
  };

  return (
    <>
      <PageHeader title="Calls tonight" subtitle="Stage 1 operations inquiries — quiet-hours calls to front desk / night audit" />
      <div className="mb-4 flex flex-wrap gap-2">
        {FILTERS.map((x) => (
          <Link
            key={x.key}
            href={toggle(x.key)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-sm font-medium",
              active.has(x.key) ? "border-brand-500 bg-brand-600 text-white" : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
            )}
          >
            {x.label}
          </Link>
        ))}
        {active.size > 0 && <Link href="/calls?f=" className="px-2 py-1.5 text-sm text-slate-500">Clear</Link>}
      </div>

      <Card>
        {list.length ? (
          <ul className="divide-y divide-slate-100">
            {list.map((h) => (
              <li key={h.id} className="flex flex-wrap items-center gap-4 px-4 py-3.5">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link href={`/hotels/${h.id}`} className="text-base font-semibold hover:underline">{h.name}</Link>
                    <StageBadge stage={h.stage} />
                    {h.tags.includes("High Priority") && <Badge tone="red">High priority</Badge>}
                  </div>
                  <div className="text-sm text-slate-500">
                    {[h.rooms && `${h.rooms} rooms`, h.airport && "Airport", h.shuttle && "Shuttle", (h.long_term_parking || h.short_term_parking) && "Parking"].filter(Boolean).join(" · ") || "—"}
                    {h.inquiry_call_count > 0 && <span> · {h.inquiry_call_count} attempt{h.inquiry_call_count > 1 ? "s" : ""}, last {fmtDate(h.last_contacted_at)}</span>}
                  </div>
                  {h.stage === "call_again" && h.next_action && <div className="text-xs text-amber-700">{h.next_action}</div>}
                </div>
                {h.phone ? (
                  <a href={`tel:${h.phone}`} className="font-mono text-sm text-slate-700 tabular-nums hover:text-brand-600">{h.phone}</a>
                ) : (
                  <span className="text-sm text-slate-400">No phone</span>
                )}
                <Link href={`/hotels/${h.id}/call`} className={buttonClass("success", "lg")}>
                  <Phone className="h-4 w-4" /> Start Stage 1 call
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <Empty>No hotels match. {pool.length === 0 && "Add or import hotels to build your call list."}</Empty>
        )}
      </Card>
    </>
  );
}
