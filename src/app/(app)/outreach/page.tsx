import Link from "next/link";
import { requireUser } from "@/lib/supabase/server";
import { effectiveClass, effectiveScore } from "@/lib/scoring";
import { fmtDate, todayISO } from "@/lib/utils";
import type { Contact, Hotel, PainPoint } from "@/lib/types";
import { Card, Empty, PageHeader, ScoreBadge, StageBadge } from "@/components/ui";
import { QuickActions } from "@/components/quick-actions";

export const dynamic = "force-dynamic";

const SEV: Record<string, number> = { High: 3, Medium: 2, Low: 1 };

export default async function Outreach({ searchParams }: { searchParams: Promise<{ show?: string }> }) {
  const { show } = await searchParams;
  const { supabase } = await requireUser();
  const today = todayISO();
  const [hRes, cRes, pRes] = await Promise.all([
    supabase.from("hotels").select("*").eq("stage", "stage2"),
    supabase.from("contacts").select("*"),
    supabase.from("pain_points").select("*"),
  ]);
  const contacts = (cRes.data ?? []) as Contact[];
  const pains = (pRes.data ?? []) as PainPoint[];
  const closed = ["Won", "Lost"];
  const hotels = ((hRes.data ?? []) as Hotel[])
    .filter((h) => show === "all" || !closed.includes(h.pipeline_status ?? ""))
    .sort((a, b) => {
      const ad = a.next_action_date ?? "9999-12-31";
      const bd = b.next_action_date ?? "9999-12-31";
      return ad === bd ? (effectiveScore(b) ?? 0) - (effectiveScore(a) ?? 0) : ad < bd ? -1 : 1;
    });

  const primaryContact = (hid: string) => {
    const cs = contacts.filter((c) => c.hotel_id === hid);
    return cs.find((c) => c.decision_maker === "yes") ?? cs.find((c) => c.influence === "high") ?? cs[0];
  };
  const topPain = (hid: string) =>
    pains.filter((p) => p.hotel_id === hid).sort((a, b) => (SEV[b.severity ?? ""] ?? 0) - (SEV[a.severity ?? ""] ?? 0))[0]?.description;

  return (
    <>
      <PageHeader
        title="Management outreach"
        subtitle="Stage 2 — daytime calls to people with operational or purchasing influence"
        actions={
          <Link href={show === "all" ? "/outreach" : "/outreach?show=all"} className="text-sm font-medium text-brand-600">
            {show === "all" ? "Hide won/lost" : "Show won/lost"}
          </Link>
        }
      />
      {hotels.length ? (
        <div className="space-y-3">
          {hotels.map((h) => {
            const c = primaryContact(h.id);
            const overdue = h.next_action_date && h.next_action_date < today;
            return (
              <Card key={h.id} className={overdue ? "border-red-300" : ""}>
                <div className="grid gap-4 p-4 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)]">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link href={`/hotels/${h.id}`} className="text-base font-semibold hover:underline">{h.name}</Link>
                      <ScoreBadge score={effectiveScore(h)} label={effectiveClass(h).label} />
                      <StageBadge stage={h.stage} status={h.pipeline_status} />
                    </div>
                    <p className="mt-1 text-sm text-slate-700">
                      <span className="text-slate-500">Largest pain: </span>
                      {topPain(h.id) ?? h.biggest_pain ?? "—"}
                    </p>
                  </div>
                  <div className="text-sm">
                    <div className="label">Management contact</div>
                    {c ? (
                      <>
                        <div className="font-medium">{c.name}</div>
                        <div className="text-xs text-slate-500">{c.title}</div>
                      </>
                    ) : (
                      <Link href={`/hotels/${h.id}`} className="text-brand-600">+ Identify contact</Link>
                    )}
                    <div className="mt-1 text-xs text-slate-500">Last contact: {fmtDate(h.last_contacted_at)}</div>
                  </div>
                  <div className="text-sm">
                    <div className="label">Next action</div>
                    <div>{h.next_action ?? <span className="text-slate-400">None set</span>}</div>
                    <div className={`text-xs ${overdue ? "font-semibold text-red-600" : "text-slate-500"}`}>
                      {h.next_action_date ? `${overdue ? "Overdue · " : ""}${fmtDate(h.next_action_date)}` : ""}
                    </div>
                  </div>
                </div>
                <div className="border-t border-slate-100 px-4 py-3">
                  <QuickActions hotelId={h.id} contactId={c?.id} phone={c?.phone ?? h.phone} email={c?.email} linkedin={c?.linkedin_url} />
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card>
          <Empty>No hotels in Stage 2 yet. Complete a Stage 1 call and choose “Move to Stage 2”.</Empty>
        </Card>
      )}
    </>
  );
}
