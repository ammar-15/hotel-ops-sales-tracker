import Link from "next/link";
import { Download } from "lucide-react";
import { requireUser } from "@/lib/supabase/server";
import { getHotels } from "@/lib/data";
import { effectiveClass, effectiveScore } from "@/lib/scoring";
import { STAGES, reachedStatus } from "@/lib/constants";
import { fmtDate, todayISO } from "@/lib/utils";
import { Card, Empty, HotelFacts, PageHeader, ScoreBadge, StageBadge, buttonClass } from "@/components/ui";
import { ImportCsv } from "@/components/import-csv";
import type { Hotel } from "@/lib/types";

export const dynamic = "force-dynamic";

type SP = Record<string, string | undefined>;

const CHECKS: { key: string; label: string; test: (h: Hotel, today: string) => boolean }[] = [
  { key: "airport", label: "Airport", test: (h) => h.airport },
  { key: "shuttle", label: "Shuttle", test: (h) => h.shuttle },
  { key: "parking", label: "Parking", test: (h) => h.long_term_parking || h.short_term_parking },
  { key: "m_hk", label: "Manual housekeeping", test: (h) => h.manual_housekeeping === true },
  { key: "m_mt", label: "Manual maintenance", test: (h) => h.manual_maintenance === true },
  { key: "m_hm", label: "Manual houseman", test: (h) => h.manual_houseman === true },
  { key: "m_sh", label: "Manual shuttle", test: (h) => h.manual_shuttle === true },
  { key: "m_pk", label: "Manual parking", test: (h) => h.manual_parking === true },
  { key: "m_wk", label: "Manual wake-ups", test: (h) => h.manual_wakeup === true },
  { key: "overdue", label: "Next action overdue", test: (h, t) => !!h.next_action_date && h.next_action_date < t },
  { key: "demo", label: "Demo booked", test: (h) => reachedStatus(h.pipeline_status, "Demo booked") || h.pipeline_status === "Won" },
  { key: "proposal", label: "Proposal sent", test: (h) => reachedStatus(h.pipeline_status, "Proposal sent") || h.pipeline_status === "Won" },
];

export default async function HotelsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const { supabase } = await requireUser();
  const all = await getHotels(supabase);
  const today = todayISO();
  const cities = [...new Set(all.map((h) => h.city).filter(Boolean))].sort() as string[];
  const brands = [...new Set(all.map((h) => h.brand).filter(Boolean))].sort() as string[];

  const q = sp.q?.toLowerCase().trim();
  const like = (v: string | null, needle?: string) => !needle || (v ?? "").toLowerCase().includes(needle.toLowerCase());
  const hotels = all
    .filter((h) => !sp.stage || h.stage === sp.stage)
    .filter((h) => !sp.min_score || (effectiveScore(h) ?? -1) >= Number(sp.min_score))
    .filter((h) => !sp.city || h.city === sp.city)
    .filter((h) => !sp.brand || h.brand === sp.brand)
    .filter((h) => !sp.min_rooms || (h.rooms ?? 0) >= Number(sp.min_rooms))
    .filter((h) => like(h.pms, sp.pms) && like(h.ops_software, sp.ops))
    .filter((h) => CHECKS.every((c) => sp[c.key] !== "1" || c.test(h, today)))
    .filter((h) => !q || [h.name, h.brand, h.city, h.notes, h.address].some((v) => (v ?? "").toLowerCase().includes(q)))
    .sort((a, b) => {
      if (sp.sort === "name") return a.name.localeCompare(b.name);
      if (sp.sort === "next") return (a.next_action_date ?? "9999") < (b.next_action_date ?? "9999") ? -1 : 1;
      return (effectiveScore(b) ?? -1) - (effectiveScore(a) ?? -1) || a.name.localeCompare(b.name);
    });

  const active = Object.keys(sp).filter((k) => sp[k] && k !== "sort").length;

  return (
    <>
      <PageHeader
        title="Hotels"
        subtitle={`${hotels.length} of ${all.length} hotels`}
        actions={
          <>
            <ImportCsv />
            <a href="/api/export?type=hotels" className={buttonClass("secondary")}>
              <Download className="h-4 w-4" /> Export
            </a>
            <Link href="/hotels/new" className={buttonClass()}>Add hotel</Link>
          </>
        }
      />

      <Card className="mb-4 p-4">
        <form className="space-y-3">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-8">
            <input name="q" defaultValue={sp.q} placeholder="Name, city, notes…" className="input col-span-2" />
            <select name="stage" defaultValue={sp.stage ?? ""} className="input">
              <option value="">Any stage</option>
              {Object.entries(STAGES).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
            <select name="min_score" defaultValue={sp.min_score ?? ""} className="input">
              <option value="">Any score</option>
              <option value="85">85+ Very strong</option>
              <option value="70">70+ Strong</option>
              <option value="50">50+ Good</option>
              <option value="30">30+ Monitor</option>
            </select>
            <select name="city" defaultValue={sp.city ?? ""} className="input">
              <option value="">Any city</option>
              {cities.map((c) => <option key={c}>{c}</option>)}
            </select>
            <select name="brand" defaultValue={sp.brand ?? ""} className="input">
              <option value="">Any brand</option>
              {brands.map((c) => <option key={c}>{c}</option>)}
            </select>
            <select name="min_rooms" defaultValue={sp.min_rooms ?? ""} className="input">
              <option value="">Any size</option>
              <option value="80">80+ rooms</option>
              <option value="100">100+ rooms</option>
              <option value="150">150+ rooms</option>
            </select>
            <select name="sort" defaultValue={sp.sort ?? ""} className="input">
              <option value="">Sort: score</option>
              <option value="name">Sort: name</option>
              <option value="next">Sort: next action</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <input name="pms" defaultValue={sp.pms} placeholder="PMS contains…" className="input" />
            <input name="ops" defaultValue={sp.ops} placeholder="Ops software contains…" className="input" />
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            {CHECKS.map((c) => (
              <label key={c.key} className="flex items-center gap-1.5 text-sm text-slate-700">
                <input type="checkbox" name={c.key} value="1" defaultChecked={sp[c.key] === "1"} className="h-4 w-4 rounded border-slate-300" />
                {c.label}
              </label>
            ))}
          </div>
          <div className="flex gap-2">
            <button className={buttonClass("primary", "sm")}>Apply filters</button>
            {active > 0 && <Link href="/hotels" className={buttonClass("ghost", "sm")}>Clear ({active})</Link>}
          </div>
        </form>
      </Card>

      <Card>
        {hotels.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px]">
              <thead className="border-b border-slate-200 bg-slate-50">
                <tr>
                  <th className="th">Hotel</th>
                  <th className="th">Stage</th>
                  <th className="th">Score</th>
                  <th className="th">Biggest pain</th>
                  <th className="th">Next action</th>
                  <th className="th">Last contact</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {hotels.map((h) => (
                  <tr key={h.id} className="hover:bg-slate-50">
                    <td className="td">
                      <Link href={`/hotels/${h.id}`} className="font-medium text-slate-900 hover:underline">{h.name}</Link>
                      <div><HotelFacts h={h} /></div>
                    </td>
                    <td className="td"><StageBadge stage={h.stage} status={h.pipeline_status} /></td>
                    <td className="td"><ScoreBadge score={effectiveScore(h)} label={effectiveClass(h).label} /></td>
                    <td className="td max-w-[220px] text-slate-600">{h.biggest_pain ?? "—"}</td>
                    <td className="td">
                      <div className="text-slate-700">{h.next_action ?? <span className="text-slate-400">None</span>}</div>
                      {h.next_action_date && (
                        <div className={`text-xs ${h.next_action_date < today ? "font-medium text-red-600" : "text-slate-500"}`}>{fmtDate(h.next_action_date)}</div>
                      )}
                    </td>
                    <td className="td text-slate-500">{fmtDate(h.last_contacted_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty>{all.length ? "No hotels match these filters." : "No hotels yet — add one or import a CSV."}</Empty>
        )}
      </Card>
    </>
  );
}
