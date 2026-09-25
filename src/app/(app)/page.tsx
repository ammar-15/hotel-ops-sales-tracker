import Link from "next/link";
import { AlertTriangle, Lightbulb, Phone } from "lucide-react";
import { requireUser } from "@/lib/supabase/server";
import { getHotels, getLatestAnswers } from "@/lib/data";
import { generateInsights } from "@/lib/insights";
import { effectiveClass, effectiveScore } from "@/lib/scoring";
import { reachedStatus } from "@/lib/constants";
import { fmtDate, fmtDateTime, money, todayISO } from "@/lib/utils";
import type { Deal, Demo, Hotel } from "@/lib/types";
import { Card, Empty, HotelFacts, PageHeader, ScoreBadge, StageBadge, buttonClass } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const { supabase } = await requireUser();
  const today = todayISO();
  const [hotels, latest, demosRes, dealsRes, contactActs, orgRes] = await Promise.all([
    getHotels(supabase),
    getLatestAnswers(supabase),
    supabase.from("demos").select("*").order("scheduled_at"),
    supabase.from("deals").select("*"),
    supabase.from("activities").select("hotel_id").in("kind", ["mgmt_call", "email", "linkedin"]),
    supabase.from("organizations").select("pricing").limit(1).maybeSingle(),
  ]);
  const demos = (demosRes.data ?? []) as Demo[];
  const deals = (dealsRes.data ?? []) as Deal[];
  const byId = new Map(hotels.map((h) => [h.id, h]));
  const defaultMonthly = Number(orgRes.data?.pricing?.founding?.monthly ?? 500);

  const active = hotels.filter((h) => h.stage !== "not_fit" && h.pipeline_status !== "Lost");
  const stage2 = hotels.filter((h) => h.stage === "stage2");
  const openStage2 = stage2.filter((h) => !["Won", "Lost"].includes(h.pipeline_status ?? ""));
  const dealByHotel = new Map(deals.map((d) => [d.hotel_id, d]));
  const mrrPipeline = openStage2.reduce((s, h) => s + Number(dealByHotel.get(h.id)?.mrr ?? defaultMonthly), 0);
  const wonMrr = stage2.filter((h) => h.pipeline_status === "Won").reduce((s, h) => s + Number(dealByHotel.get(h.id)?.mrr ?? 0), 0);

  const metrics = [
    { label: "Hotels researched", value: hotels.length },
    { label: "Stage 1 calls done", value: hotels.filter((h) => h.stage1_completed_at).length },
    { label: "Strong opportunities", value: hotels.filter((h) => (effectiveScore(h) ?? 0) >= 70 && h.stage !== "not_fit").length },
    { label: "Stage 2 contacts made", value: new Set((contactActs.data ?? []).map((a) => a.hotel_id)).size },
    { label: "Meetings booked", value: stage2.filter((h) => reachedStatus(h.pipeline_status, "Discovery call booked") || h.pipeline_status === "Won").length },
    { label: "Demos completed", value: new Set(demos.filter((d) => d.status === "completed").map((d) => d.hotel_id)).size },
    { label: "Proposals sent", value: stage2.filter((h) => reachedStatus(h.pipeline_status, "Proposal sent") || h.pipeline_status === "Won").length },
    { label: "Deals won", value: stage2.filter((h) => h.pipeline_status === "Won").length },
    { label: "Est. MRR pipeline", value: money(mrrPipeline), sub: wonMrr ? `${money(wonMrr)} won` : undefined },
  ];

  const overdue = active.filter((h) => h.next_action_date && h.next_action_date < today);
  const callsTonight = hotels
    .filter((h) => h.stage === "prospect" || h.stage === "call_again")
    .sort((a, b) => priority(b) - priority(a))
    .slice(0, 8);
  const mgmtDue = stage2
    .filter((h) => h.next_action_date && h.next_action_date <= today && !["Won", "Lost"].includes(h.pipeline_status ?? ""))
    .sort((a, b) => (a.next_action_date! < b.next_action_date! ? -1 : 1));
  const upcomingDemos = demos.filter((d) => d.status === "booked" && d.scheduled_at >= new Date(Date.now() - 3600_000).toISOString()).slice(0, 6);
  const noNext = active.filter((h) => !h.next_action && h.pipeline_status !== "Won").slice(0, 8);
  const top = active
    .filter((h) => effectiveScore(h) != null && h.stage1_completed_at)
    .sort((a, b) => (effectiveScore(b) ?? 0) - (effectiveScore(a) ?? 0))
    .slice(0, 6);
  const insights = generateInsights(hotels, latest, demos, today);

  return (
    <>
      <PageHeader title="Dashboard" subtitle={fmtDate(today, { weekday: "long", month: "long", day: "numeric" })} />

      {overdue.length > 0 && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4">
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-red-800">
            <AlertTriangle className="h-4 w-4" /> {overdue.length} overdue next action{overdue.length > 1 ? "s" : ""}
          </div>
          <ul className="grid gap-1 sm:grid-cols-2">
            {overdue.slice(0, 8).map((h) => (
              <li key={h.id} className="text-sm">
                <Link href={`/hotels/${h.id}`} className="font-medium text-red-900 hover:underline">
                  {h.name}
                </Link>{" "}
                <span className="text-red-700">— {h.next_action} (due {fmtDate(h.next_action_date)})</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-9">
        {metrics.map((m) => (
          <div key={m.label} className="rounded-lg border border-slate-200 bg-white p-3 shadow-xs">
            <div className="text-[11px] leading-tight font-medium text-slate-500">{m.label}</div>
            <div className="mt-1 text-xl font-semibold tabular-nums">{m.value}</div>
            {m.sub && <div className="text-[11px] text-slate-500">{m.sub}</div>}
          </div>
        ))}
      </div>

      {insights.length > 0 && (
        <Card className="mb-6" title={<span className="flex items-center gap-1.5"><Lightbulb className="h-4 w-4 text-amber-500" /> Market insights</span>}>
          <ul className="grid gap-x-6 gap-y-1.5 text-sm text-slate-700 md:grid-cols-2">
            {insights.map((i) => (
              <li key={i} className="flex gap-2">
                <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-slate-400" />
                {i}
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Calls to make tonight" action={<Link href="/calls" className="text-xs font-medium text-brand-600">Open queue →</Link>}>
          {callsTonight.length ? (
            <ul className="divide-y divide-slate-100">
              {callsTonight.map((h) => (
                <li key={h.id} className="flex items-center justify-between gap-3 py-2">
                  <div className="min-w-0">
                    <Link href={`/hotels/${h.id}`} className="block truncate text-sm font-medium hover:underline">{h.name}</Link>
                    <HotelFacts h={h} />
                  </div>
                  <Link href={`/hotels/${h.id}/call`} className={buttonClass("secondary", "sm")}>
                    <Phone className="h-3.5 w-3.5" /> Start
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <Empty>No hotels waiting for a Stage 1 call.</Empty>
          )}
        </Card>

        <Card title="Management follow-ups due today" action={<Link href="/outreach" className="text-xs font-medium text-brand-600">Outreach →</Link>}>
          {mgmtDue.length ? (
            <ul className="divide-y divide-slate-100">
              {mgmtDue.map((h) => (
                <li key={h.id} className="flex items-center justify-between gap-3 py-2">
                  <div className="min-w-0">
                    <Link href={`/hotels/${h.id}`} className="block truncate text-sm font-medium hover:underline">{h.name}</Link>
                    <span className="text-xs text-slate-500">{h.next_action}</span>
                  </div>
                  <span className={`text-xs font-medium ${h.next_action_date! < today ? "text-red-600" : "text-slate-500"}`}>{fmtDate(h.next_action_date)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <Empty>Nothing due today.</Empty>
          )}
        </Card>

        <Card title="Meetings & demos coming up">
          {upcomingDemos.length ? (
            <ul className="divide-y divide-slate-100">
              {upcomingDemos.map((d) => (
                <li key={d.id} className="flex items-center justify-between gap-3 py-2">
                  <Link href={`/hotels/${d.hotel_id}/demo`} className="truncate text-sm font-medium hover:underline">{byId.get(d.hotel_id)?.name}</Link>
                  <span className="text-xs text-slate-500">{fmtDateTime(d.scheduled_at)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <Empty>No demos booked.</Empty>
          )}
        </Card>

        <Card title="Highest-scoring opportunities">
          {top.length ? (
            <ul className="divide-y divide-slate-100">
              {top.map((h) => (
                <li key={h.id} className="flex items-center justify-between gap-3 py-2">
                  <div className="min-w-0">
                    <Link href={`/hotels/${h.id}`} className="block truncate text-sm font-medium hover:underline">{h.name}</Link>
                    <span className="text-xs text-slate-500">{h.biggest_pain ?? "—"}</span>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <StageBadge stage={h.stage} status={h.pipeline_status} />
                    <ScoreBadge score={effectiveScore(h)} label={effectiveClass(h).label} />
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <Empty>Scores appear after Stage 1 calls.</Empty>
          )}
        </Card>

        <Card title="Hotels with no next action" className="lg:col-span-2">
          {noNext.length ? (
            <div className="flex flex-wrap gap-2">
              {noNext.map((h) => (
                <Link key={h.id} href={`/hotels/${h.id}`} className="rounded-md border border-slate-200 px-2.5 py-1 text-sm hover:bg-slate-50">
                  {h.name}
                </Link>
              ))}
            </div>
          ) : (
            <Empty>Every active hotel has a next action.</Empty>
          )}
        </Card>
      </div>
    </>
  );
}

function priority(h: Hotel) {
  return (
    (h.tags.includes("High Priority") ? 50 : 0) +
    (h.airport ? 10 : 0) +
    (h.shuttle ? 8 : 0) +
    ((h.rooms ?? 0) >= 80 ? 5 : 0) +
    (h.stage === "call_again" ? 3 : 0) +
    (effectiveScore(h) ?? 0) / 10
  );
}
