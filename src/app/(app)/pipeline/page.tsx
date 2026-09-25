import Link from "next/link";
import { Download } from "lucide-react";
import { requireUser } from "@/lib/supabase/server";
import { getHotels } from "@/lib/data";
import { PIPELINE_GROUPS, STAGES } from "@/lib/constants";
import { effectiveScore } from "@/lib/scoring";
import { fmtDate, money, todayISO } from "@/lib/utils";
import type { Deal, Hotel } from "@/lib/types";
import { Badge, PageHeader, ScoreBadge, buttonClass } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function Pipeline() {
  const { supabase } = await requireUser();
  const today = todayISO();
  const [hotels, dealsRes] = await Promise.all([getHotels(supabase), supabase.from("deals").select("*")]);
  const deals = new Map(((dealsRes.data ?? []) as Deal[]).map((d) => [d.hotel_id, d]));

  const research: { label: string; items: Hotel[] }[] = [
    { label: "Not called", items: hotels.filter((h) => h.stage === "prospect") },
    { label: "Stage 1 · review", items: hotels.filter((h) => h.stage === "stage1_review") },
    { label: "Call again / research", items: hotels.filter((h) => h.stage === "call_again" || h.stage === "research_more") },
  ];
  const stage2 = hotels.filter((h) => h.stage === "stage2");
  const sales = PIPELINE_GROUPS.map((g) => ({
    label: g.label,
    items: stage2.filter((h) => g.statuses.includes(h.pipeline_status ?? "") || (g.label === "Outreach" && !h.pipeline_status)),
  }));
  const columns = [...research, ...sales];
  const notFit = hotels.filter((h) => h.stage === "not_fit");

  return (
    <>
      <PageHeader
        title="Pipeline"
        subtitle="Research → Stage 1 → management outreach → closed"
        actions={
          <a href="/api/export?type=pipeline" className={buttonClass("secondary")}>
            <Download className="h-4 w-4" /> Export
          </a>
        }
      />
      <div className="-mx-4 overflow-x-auto px-4 pb-4 sm:-mx-6 sm:px-6">
        <div className="flex gap-3">
          {columns.map((col, i) => {
            const mrr = col.items.reduce((s, h) => s + Number(deals.get(h.id)?.mrr ?? 0), 0);
            return (
              <div key={col.label} className={`w-64 shrink-0 rounded-lg ${i < 3 ? "bg-slate-100" : "bg-blue-50/70"} p-2`}>
                <div className="mb-2 flex items-baseline justify-between px-1">
                  <h2 className="text-xs font-semibold tracking-wide text-slate-600 uppercase">{col.label}</h2>
                  <span className="text-xs text-slate-500">{col.items.length}{mrr ? ` · ${money(mrr)}/mo` : ""}</span>
                </div>
                <div className="space-y-2">
                  {col.items
                    .sort((a, b) => (effectiveScore(b) ?? 0) - (effectiveScore(a) ?? 0))
                    .map((h) => (
                      <Link key={h.id} href={`/hotels/${h.id}`} className="block rounded-md border border-slate-200 bg-white p-2.5 shadow-xs hover:border-slate-300">
                        <div className="flex items-start justify-between gap-2">
                          <span className="text-sm leading-tight font-medium">{h.name}</span>
                          {effectiveScore(h) != null && <ScoreBadge score={effectiveScore(h)} label="" />}
                        </div>
                        {h.pipeline_status && <div className="mt-1"><Badge tone={h.pipeline_status === "Won" ? "green" : h.pipeline_status === "Lost" ? "red" : "purple"}>{h.pipeline_status}</Badge></div>}
                        {h.next_action && (
                          <div className={`mt-1 truncate text-xs ${h.next_action_date && h.next_action_date < today ? "text-red-600" : "text-slate-500"}`}>
                            {h.next_action}{h.next_action_date ? ` · ${fmtDate(h.next_action_date)}` : ""}
                          </div>
                        )}
                      </Link>
                    ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      {notFit.length > 0 && (
        <details className="mt-4">
          <summary className="cursor-pointer text-sm text-slate-500">{STAGES.not_fit.label} ({notFit.length})</summary>
          <ul className="mt-2 grid gap-1 text-sm sm:grid-cols-2 lg:grid-cols-3">
            {notFit.map((h) => (
              <li key={h.id}>
                <Link href={`/hotels/${h.id}`} className="hover:underline">{h.name}</Link>
                <span className="text-slate-500"> — {h.not_fit_reason}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </>
  );
}
