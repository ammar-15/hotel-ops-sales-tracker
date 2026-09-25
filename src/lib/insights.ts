import type { Answers } from "./constants";
import type { Demo, Hotel } from "./types";
import { effectiveScore } from "./scoring";

export type Latest = Record<string, Answers>; // hotel_id → latest answered Stage 1 answers

const get = (a: Answers | undefined, k: string) => (a && typeof a[k] === "string" ? (a[k] as string) : undefined);

const AREA_NAMES: Record<string, string> = {
  manual_housekeeping: "Housekeeping status",
  manual_houseman: "Houseman request tracking",
  manual_maintenance: "Maintenance tracking",
  manual_shuttle: "Shuttle coordination",
  manual_parking: "Parking tracking",
  manual_wakeup: "Wake-up call tracking",
};
export const FLAG_KEYS = Object.keys(AREA_NAMES) as (keyof typeof AREA_NAMES)[];
export { AREA_NAMES };

export function manualPrevalence(hotels: Hotel[]) {
  return FLAG_KEYS.map((k) => {
    const known = hotels.filter((h) => (h as unknown as Record<string, unknown>)[k] !== null);
    const manual = known.filter((h) => (h as unknown as Record<string, unknown>)[k] === true);
    return { key: k, label: AREA_NAMES[k], manual: manual.length, known: known.length };
  }).sort((a, b) => b.manual - a.manual);
}

export function generateInsights(hotels: Hotel[], latest: Latest, demos: Demo[], today: string): string[] {
  const out: string[] = [];
  const researched = hotels.filter((h) => latest[h.id]);

  const airportShuttle = researched.filter((h) => h.airport && (h.shuttle || get(latest[h.id], "sh_record")));
  if (airportShuttle.length) {
    const phone = airportShuttle.filter(
      (h) => get(latest[h.id], "sh_guest_calls") === "yes" || ["Phone", "Radio"].includes(get(latest[h.id], "sh_record") ?? "")
    ).length;
    if (phone) out.push(`${phone} of ${airportShuttle.length} airport hotels with a shuttle rely on front desk phone calls for shuttle requests.`);
    const noSms = airportShuttle.filter((h) => get(latest[h.id], "sh_sms") === "no").length;
    if (noSms) out.push(`${noSms} of ${airportShuttle.length} shuttle hotels send guests no SMS pickup updates.`);
  }

  const hmKnown = researched.filter((h) => get(latest[h.id], "hm_method") && get(latest[h.id], "hm_method") !== "Unknown");
  const radio = hmKnown.filter((h) => get(latest[h.id], "hm_method") === "Radio").length;
  if (radio) out.push(`${radio} of ${hmKnown.length} hotels use radios for houseman requests.`);

  const mtKnown = researched.filter((h) => get(latest[h.id], "mt_method") && get(latest[h.id], "mt_method") !== "Unknown");
  const paper = mtKnown.filter((h) => ["Paper log", "Excel"].includes(get(latest[h.id], "mt_method")!)).length;
  if (paper) out.push(`${paper} of ${mtKnown.length} hotels track maintenance on paper or Excel.`);

  const prev = manualPrevalence(hotels).filter((p) => p.known >= 2 && p.manual > 0);
  if (prev.length) out.push(`${prev[0].label} is the most common unsolved workflow (${prev[0].manual} of ${prev[0].known} hotels).`);

  const untouched = hotels.filter(
    (h) =>
      (effectiveScore(h) ?? 0) >= 70 &&
      h.stage !== "not_fit" &&
      (h.stage !== "stage2" || !h.pipeline_status || ["Outreach not started", "Management contact identified"].includes(h.pipeline_status))
  ).length;
  if (untouched) out.push(`${untouched} high-scoring hotel${untouched > 1 ? "s have" : " has"} not yet had management outreach.`);

  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
  const followUps = demos.filter((d) => {
    const h = hotels.find((x) => x.id === d.hotel_id);
    return d.status === "completed" && d.scheduled_at >= weekAgo && h?.pipeline_status === "Demo completed";
  }).length;
  if (followUps) out.push(`${followUps} demo${followUps > 1 ? "s require" : " requires"} follow-up this week.`);

  const overdue = hotels.filter((h) => h.next_action_date && h.next_action_date < today && h.stage !== "not_fit").length;
  if (overdue) out.push(`${overdue} next action${overdue > 1 ? "s are" : " is"} overdue.`);

  return out;
}

// ───────────── Market discovery analytics ─────────────
type Bucketer = (v: string | undefined) => string | null;
const bucket = (map: Record<string, string>, fallback = "Other / unknown"): Bucketer => (v) => (v ? map[v] ?? fallback : null);

export const MARKET_CATEGORIES: { title: string; key: string; buckets: string[]; fn: Bucketer }[] = [
  {
    title: "Housekeeping / room status",
    key: "hk_system",
    buckets: ["PMS", "Operations platform", "Phone / radio", "Manual system", "Other / unknown"],
    fn: bucket({ "PMS automatically": "PMS", "Operations platform": "Operations platform", Phone: "Phone / radio", Radio: "Phone / radio", Paper: "Manual system", Spreadsheet: "Manual system", Verbal: "Manual system" }),
  },
  {
    title: "Houseman requests",
    key: "hm_method",
    buckets: ["Digital tracking", "Radio", "Phone", "Manual", "Other / unknown"],
    fn: bucket({ "Operations software": "Digital tracking", PMS: "Digital tracking", Radio: "Radio", Phone: "Phone", "Messaging app": "Manual", Paper: "Manual", Verbal: "Manual" }),
  },
  {
    title: "Maintenance",
    key: "mt_method",
    buckets: ["Quore", "HotSOS", "PMS", "Manual", "Other"],
    fn: bucket({ Quore: "Quore", HotSOS: "HotSOS", PMS: "PMS", "Paper log": "Manual", Excel: "Manual", Radio: "Manual", Phone: "Manual", Verbal: "Manual" }, "Other"),
  },
  {
    title: "Shuttle requests",
    key: "sh_record",
    buckets: ["Dedicated software", "PMS", "Paper", "Spreadsheet", "Phone / radio", "Other"],
    fn: bucket({ "Shuttle software": "Dedicated software", PMS: "PMS", Paper: "Paper", Spreadsheet: "Spreadsheet", Phone: "Phone / radio", Radio: "Phone / radio" }, "Other"),
  },
  {
    title: "Parking",
    key: "pk_record",
    buckets: ["Dedicated software", "PMS", "Paper", "Spreadsheet", "Phone / radio", "Other"],
    fn: bucket({ "Parking software": "Dedicated software", PMS: "PMS", Paper: "Paper", Spreadsheet: "Spreadsheet", Verbal: "Phone / radio" }, "Other"),
  },
];

export function marketBreakdown(latest: Latest) {
  return MARKET_CATEGORIES.map((c) => {
    const counts: Record<string, number> = Object.fromEntries(c.buckets.map((b) => [b, 0]));
    let total = 0;
    for (const ans of Object.values(latest)) {
      const b = c.fn(get(ans, c.key));
      if (!b) continue;
      counts[b] = (counts[b] ?? 0) + 1;
      total++;
    }
    return { title: c.title, total, rows: c.buckets.map((b) => ({ label: b, count: counts[b] ?? 0 })) };
  });
}
