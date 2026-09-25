import Link from "next/link";
import { requireUser } from "@/lib/supabase/server";
import type { Activity, Contact, Hotel, InquiryCall, PainPoint } from "@/lib/types";
import { Badge, Card, Empty, HotelFacts, PageHeader, StageBadge } from "@/components/ui";
import { fmtDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = "" } = await searchParams;
  const term = q.trim();
  const { supabase } = await requireUser();
  if (!term) return <PageHeader title="Search" subtitle="Type in the search bar above." />;

  const safe = term.replace(/[%,()]/g, " ");
  const p = `%${safe}%`;
  const [hRes, cRes, ppRes, aRes, callRes] = await Promise.all([
    supabase.from("hotels").select("*").or(`name.ilike.${p},brand.ilike.${p},city.ilike.${p},notes.ilike.${p},address.ilike.${p},stage1_summary.ilike.${p}`).limit(50),
    supabase.from("contacts").select("*").or(`name.ilike.${p},title.ilike.${p},email.ilike.${p},notes.ilike.${p}`).limit(50),
    supabase.from("pain_points").select("*").or(`description.ilike.${p},current_workflow.ilike.${p},impact.ilike.${p},existing_system.ilike.${p}`).limit(50),
    supabase.from("activities").select("*").or(`summary.ilike.${p},outcome.ilike.${p}`).limit(50),
    supabase.from("inquiry_calls").select("*").or(`notes.ilike.${p},outside_pms.ilike.${p},most_manual.ilike.${p}`).limit(50),
  ]);
  const hotels = (hRes.data ?? []) as Hotel[];
  const contacts = (cRes.data ?? []) as Contact[];
  const pains = (ppRes.data ?? []) as PainPoint[];
  const acts = (aRes.data ?? []) as Activity[];
  const calls = (callRes.data ?? []) as InquiryCall[];

  const ids = new Set([...contacts, ...pains, ...acts, ...calls].map((x) => x.hotel_id));
  const { data: names } = ids.size ? await supabase.from("hotels").select("id, name").in("id", [...ids]) : { data: [] };
  const nameOf = new Map((names ?? []).map((n) => [n.id, n.name]));
  const total = hotels.length + contacts.length + pains.length + acts.length + calls.length;

  return (
    <>
      <PageHeader title={`Results for “${term}”`} subtitle={`${total} match${total === 1 ? "" : "es"}`} />
      <div className="space-y-6">
        {hotels.length > 0 && (
          <Card title={`Hotels (${hotels.length})`}>
            <ul className="divide-y divide-slate-100">
              {hotels.map((h) => (
                <li key={h.id} className="flex items-center justify-between gap-2 py-2">
                  <div>
                    <Link href={`/hotels/${h.id}`} className="font-medium hover:underline">{h.name}</Link>
                    <div><HotelFacts h={h} /></div>
                  </div>
                  <StageBadge stage={h.stage} status={h.pipeline_status} />
                </li>
              ))}
            </ul>
          </Card>
        )}
        {contacts.length > 0 && (
          <Card title={`Contacts (${contacts.length})`}>
            <ul className="divide-y divide-slate-100">
              {contacts.map((c) => (
                <li key={c.id} className="py-2 text-sm">
                  <span className="font-medium">{c.name}</span> <span className="text-slate-500">{c.title}</span> ·{" "}
                  <Link href={`/hotels/${c.hotel_id}`} className="text-brand-600 hover:underline">{nameOf.get(c.hotel_id)}</Link>
                </li>
              ))}
            </ul>
          </Card>
        )}
        {pains.length > 0 && (
          <Card title={`Pain points (${pains.length})`}>
            <ul className="divide-y divide-slate-100">
              {pains.map((pp) => (
                <li key={pp.id} className="py-2 text-sm">
                  <Badge tone="blue">{pp.department}</Badge> {pp.description} ·{" "}
                  <Link href={`/hotels/${pp.hotel_id}`} className="text-brand-600 hover:underline">{nameOf.get(pp.hotel_id)}</Link>
                </li>
              ))}
            </ul>
          </Card>
        )}
        {(acts.length > 0 || calls.length > 0) && (
          <Card title={`Notes (${acts.length + calls.length})`}>
            <ul className="divide-y divide-slate-100">
              {calls.map((c) => (
                <li key={c.id} className="py-2 text-sm">
                  <span className="text-slate-500">{fmtDate(c.called_at)} · Stage 1 call · </span>
                  {[c.notes, c.outside_pms, c.most_manual].filter(Boolean).join(" — ")} ·{" "}
                  <Link href={`/hotels/${c.hotel_id}`} className="text-brand-600 hover:underline">{nameOf.get(c.hotel_id)}</Link>
                </li>
              ))}
              {acts.map((a) => (
                <li key={a.id} className="py-2 text-sm">
                  <span className="text-slate-500">{fmtDate(a.occurred_at)} · </span>
                  {a.summary}{a.outcome ? ` — ${a.outcome}` : ""} ·{" "}
                  <Link href={`/hotels/${a.hotel_id}`} className="text-brand-600 hover:underline">{nameOf.get(a.hotel_id)}</Link>
                </li>
              ))}
            </ul>
          </Card>
        )}
        {total === 0 && <Card><Empty>Nothing found.</Empty></Card>}
      </div>
    </>
  );
}
