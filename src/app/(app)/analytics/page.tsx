import { requireUser } from "@/lib/supabase/server";
import { getHotels, getLatestAnswers } from "@/lib/data";
import { manualPrevalence, marketBreakdown } from "@/lib/insights";
import { classify, effectiveScore } from "@/lib/scoring";
import { Card, Empty, PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

/** Single-series horizontal bar list: one hue, values labelled, native tooltip on hover. */
function Bars({ rows, total, unit = "hotels" }: { rows: { label: string; count: number }[]; total: number; unit?: string }) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <ul className="space-y-2">
      {rows.map((r) => {
        const pct = total ? Math.round((r.count / total) * 100) : 0;
        return (
          <li key={r.label} title={`${r.label}: ${r.count} of ${total} ${unit} (${pct}%)`} className="grid grid-cols-[8.5rem_1fr_3.5rem] items-center gap-3 text-sm">
            <span className="truncate text-slate-700">{r.label}</span>
            <span className="h-3 rounded-sm bg-slate-100">
              <span className="block h-3 rounded-r-[4px] bg-brand-600" style={{ width: `${(r.count / max) * 100}%`, minWidth: r.count ? 3 : 0 }} />
            </span>
            <span className="text-right text-slate-600 tabular-nums">{pct}%</span>
          </li>
        );
      })}
    </ul>
  );
}

export default async function Analytics() {
  const { supabase } = await requireUser();
  const [hotels, latest] = await Promise.all([getHotels(supabase), getLatestAnswers(supabase)]);
  const researched = Object.keys(latest).length;
  const market = marketBreakdown(latest);
  const prevalence = manualPrevalence(hotels);

  const classes = ["Very Strong", "Strong", "Good", "Monitor", "Low"].map((label) => ({
    label,
    count: hotels.filter((h) => h.stage1_completed_at && classify(effectiveScore(h)).label === label).length,
  }));
  const scored = classes.reduce((s, c) => s + c.count, 0);

  return (
    <>
      <PageHeader title="Market discovery" subtitle={`Based on the latest Stage 1 call at ${researched} researched hotel${researched === 1 ? "" : "s"}`} />
      {researched === 0 ? (
        <Card><Empty>Analytics fill in as you log Stage 1 calls.</Empty></Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card title="How often each workflow is still manual" className="lg:col-span-2">
            <ul className="space-y-2">
              {prevalence.map((p) => {
                const pct = p.known ? Math.round((p.manual / p.known) * 100) : 0;
                return (
                  <li key={p.key} title={`${p.manual} of ${p.known} hotels with an answer`} className="grid grid-cols-[11rem_1fr_7rem] items-center gap-3 text-sm">
                    <span className="text-slate-700">{p.label}</span>
                    <span className="h-3 rounded-sm bg-slate-100">
                      <span className="block h-3 rounded-r-[4px] bg-brand-600" style={{ width: `${pct}%`, minWidth: p.manual ? 3 : 0 }} />
                    </span>
                    <span className="text-right text-slate-600 tabular-nums">
                      {pct}% <span className="text-xs text-slate-400">({p.manual}/{p.known})</span>
                    </span>
                  </li>
                );
              })}
            </ul>
            <p className="mt-3 text-xs text-slate-500">Share of hotels where the workflow is manual, out of hotels where we learned how it works.</p>
          </Card>

          {market.map((m) => (
            <Card key={m.title} title={m.title} action={<span className="text-xs text-slate-500">n = {m.total}</span>}>
              {m.total ? <Bars rows={m.rows} total={m.total} /> : <Empty>No answers yet.</Empty>}
            </Card>
          ))}

          <Card title="Opportunity classification" action={<span className="text-xs text-slate-500">n = {scored}</span>}>
            {scored ? <Bars rows={classes} total={scored} /> : <Empty>No scored hotels.</Empty>}
          </Card>
        </div>
      )}
    </>
  );
}
