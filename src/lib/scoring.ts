import { MANUAL, OPS_PLATFORMS, type Answers } from "./constants";
import type { Hotel } from "./types";

type HotelLike = Pick<
  Hotel,
  | "rooms"
  | "airport"
  | "shuttle"
  | "shuttle_24h"
  | "long_term_parking"
  | "short_term_parking"
  | "restaurant"
  | "meeting_space"
  | "tags"
  | "corporate_controlled"
  | "mgmt_no_pain"
  | "brand"
  | "ownership_type"
>;

const a = (ans: Answers, k: string) => (typeof ans[k] === "string" ? (ans[k] as string) : undefined);
const is = (ans: Answers, k: string, v: string) => a(ans, k) === v;
const inList = (ans: Answers, k: string, list: string[]) => {
  const v = a(ans, k);
  return !!v && list.includes(v);
};

// ───────────── Manual-workflow flags ─────────────
export type Area = "housekeeping" | "houseman" | "maintenance" | "shuttle" | "parking" | "wakeup";

export function manualFlags(ans: Answers, hotel?: Pick<Hotel, "shuttle">) {
  const known = (...keys: string[]) => keys.some((k) => ans[k] !== undefined && ans[k] !== "unknown" && ans[k] !== "Unknown");
  const flag = (keys: string[], cond: boolean) => (cond ? true : known(...keys) ? false : null);

  return {
    manual_housekeeping: flag(
      ["hk_system", "hk_fd_calls", "hk_digital_status"],
      inList(ans, "hk_system", MANUAL.hk) || is(ans, "hk_fd_calls", "yes") || is(ans, "hk_digital_status", "no")
    ),
    manual_houseman: flag(["hm_method", "hm_trackable"], inList(ans, "hm_method", MANUAL.hm) || is(ans, "hm_trackable", "no")),
    manual_maintenance: flag(["mt_method"], inList(ans, "mt_method", MANUAL.mt)),
    manual_shuttle:
      hotel && !hotel.shuttle && !ans.sh_record
        ? null
        : flag(["sh_record", "sh_driver_notify"], inList(ans, "sh_record", MANUAL.sh) || inList(ans, "sh_driver_notify", ["Phone", "Radio", "Paper"])),
    manual_parking: flag(["pk_record", "pk_digital_list"], inList(ans, "pk_record", MANUAL.pk) || is(ans, "pk_digital_list", "no")),
    manual_wakeup: is(ans, "wk_offered", "no")
      ? false
      : flag(["wk_mode", "wk_record"], is(ans, "wk_mode", "Manual") || inList(ans, "wk_record", MANUAL.wk)),
  };
}

// ───────────── Opportunity score ─────────────
export interface ScoreLine {
  label: string;
  points: number;
}

export function scoreHotel(hotel: HotelLike, ans: Answers | null): { score: number; breakdown: ScoreLine[] } {
  const lines: ScoreLine[] = [];
  const add = (cond: boolean, label: string, points: number) => cond && lines.push({ label, points });

  if (ans) {
    const f = manualFlags(ans, hotel);
    add(
      inList(ans, "hk_system", ["Phone", "Radio"]) || is(ans, "hk_fd_calls", "yes"),
      "Housekeeping relies on phone/radio",
      10
    );
    add(f.manual_houseman === true, "Houseman requests not digitally tracked", 10);
    add(f.manual_maintenance === true, "Maintenance requests not digitally tracked", 10);
    add(
      is(ans, "hm_completion_visible", "no") || is(ans, "mt_fd_status", "no") || is(ans, "mt_completion", "no"),
      "Front desk can't see request completion",
      10
    );
    add(f.manual_shuttle === true, "Shuttle requests rely on phone/radio/paper", 10);
    add(is(ans, "sh_sms", "no") || is(ans, "sh_guest_track", "no"), "Shuttle guests get no status/SMS update", 10);
    add(f.manual_parking === true, "Parking tracked manually", 10);
    add(f.manual_wakeup === true, "Wake-up calls tracked manually", 10);
    add(is(ans, "gen_multi_systems", "yes"), "Multiple separate systems/logs", 10);
    add(
      is(ans, "gen_shift_visibility", "no") || is(ans, "wk_shift_clear", "no"),
      "Outstanding requests not visible across shifts",
      10
    );

    const platformHandlesMost =
      is(ans, "gen_ops_platform_most", "yes") ||
      (inList(ans, "mt_method", OPS_PLATFORMS) && inList(ans, "hk_system", ["Operations platform", "PMS automatically"]) && inList(ans, "hm_method", ["Operations software", "PMS"]));
    add(platformHandlesMost, "Ops platform (Quore/HotSOS/hotelkit) already covers most workflows", -20);
    add(is(ans, "gen_pms_most", "yes"), "PMS handles almost everything", -10);
  }

  const departments = [hotel.shuttle, hotel.long_term_parking || hotel.short_term_parking, hotel.restaurant, hotel.meeting_space].filter(Boolean).length;
  add((hotel.rooms ?? 0) >= 100, "100+ rooms", 5);
  add(hotel.airport, "Airport hotel", 5);
  add(hotel.shuttle_24h || (!!ans && is(ans, "sh_24h", "yes")), "24-hour shuttle", 5);
  add(hotel.long_term_parking || (!!ans && is(ans, "pk_long_term", "yes")), "Long-term parking", 5);
  add(hotel.tags?.includes("Full Service") || (hotel.restaurant && hotel.meeting_space), "Full-service property", 5);
  add(departments >= 2, "Multiple operational departments", 5);

  add(hotel.mgmt_no_pain, "Management says no meaningful pain", -20);
  add(hotel.corporate_controlled, "Tech decisions controlled by corporate", -15);

  const raw = lines.reduce((s, l) => s + l.points, 0);
  return { score: Math.max(0, Math.min(100, raw)), breakdown: lines };
}

export function classify(score: number | null | undefined) {
  if (score == null) return { label: "Unscored", tone: "gray" as const };
  if (score >= 85) return { label: "Very Strong", tone: "green" as const };
  if (score >= 70) return { label: "Strong", tone: "green" as const };
  if (score >= 50) return { label: "Good", tone: "blue" as const };
  if (score >= 30) return { label: "Monitor", tone: "amber" as const };
  return { label: "Low", tone: "red" as const };
}

export const CLASSIFICATIONS = ["Low", "Monitor", "Good", "Strong", "Very Strong"];

export function effectiveScore(h: Pick<Hotel, "opportunity_score" | "score_override">) {
  return h.score_override ?? h.opportunity_score;
}
export function effectiveClass(h: Pick<Hotel, "opportunity_score" | "score_override" | "classification_override">) {
  const c = classify(effectiveScore(h));
  if (h.classification_override) {
    const o = classify({ Low: 0, Monitor: 30, Good: 50, Strong: 70, "Very Strong": 85 }[h.classification_override] ?? 0);
    return { label: h.classification_override, tone: o.tone };
  }
  return c;
}

// ───────────── Pain areas, summary, recommendations ─────────────
const AREA_LABEL: Record<Area, string> = {
  shuttle: "Shuttle pickup coordination",
  houseman: "Houseman request completion",
  maintenance: "Maintenance request visibility",
  housekeeping: "Room readiness / housekeeping status",
  parking: "Parking & vehicle tracking",
  wakeup: "Wake-up call tracking",
};

/** Pain areas ranked by how much evidence was found (most painful first). */
export function rankAreas(ans: Answers, hotel?: Pick<Hotel, "shuttle">): Area[] {
  const f = manualFlags(ans, hotel);
  const weight: Record<Area, number> = {
    shuttle: (f.manual_shuttle ? 3 : 0) + (is(ans, "sh_sms", "no") ? 2 : 0) + (is(ans, "sh_fd_driver_status", "no") ? 1 : 0) + (is(ans, "sh_pickup_confirmed", "no") ? 1 : 0),
    houseman: (f.manual_houseman ? 3 : 0) + (is(ans, "hm_completion_visible", "no") ? 2 : 0) + (is(ans, "hm_ack_visible", "no") ? 1 : 0) + (is(ans, "hm_history", "no") ? 1 : 0),
    maintenance: (f.manual_maintenance ? 3 : 0) + (is(ans, "mt_fd_status", "no") ? 2 : 0) + (is(ans, "mt_room_history", "no") ? 1 : 0) + (is(ans, "mt_recurring_visible", "no") ? 1 : 0),
    housekeeping: (f.manual_housekeeping ? 2 : 0) + (is(ans, "hk_fd_sees_ready", "no") ? 2 : 0) + (is(ans, "hk_guest_notified", "no") ? 1 : 0),
    parking: (f.manual_parking ? 2 : 0) + (inList(ans, "pk_overdue_known", ["Manual check", "Don't really know"]) ? 1 : 0) + (is(ans, "pk_overstays", "Not tracked") ? 1 : 0),
    wakeup: (f.manual_wakeup ? 2 : 0) + (is(ans, "wk_completion", "no") ? 1 : 0) + (is(ans, "wk_shift_clear", "no") ? 1 : 0),
  };
  return (Object.keys(weight) as Area[]).filter((k) => weight[k] > 0).sort((x, y) => weight[y] - weight[x]);
}

export function biggestPain(ans: Answers, hotel?: Pick<Hotel, "shuttle">) {
  const areas = rankAreas(ans, hotel);
  if (!areas.length) return null;
  const requestAreas = areas.filter((x) => ["houseman", "maintenance", "housekeeping"].includes(x));
  if (requestAreas.length >= 2) {
    return areas.includes("shuttle") ? "Cross-department request tracking + shuttle" : "Cross-department request tracking";
  }
  return AREA_LABEL[areas[0]];
}

export function recommendedRole(ans: Answers, hotel: Pick<Hotel, "shuttle" | "ownership_type" | "rooms">) {
  const areas = rankAreas(ans, hotel);
  const top = areas[0];
  const cross = areas.filter((x) => ["houseman", "maintenance", "housekeeping"].includes(x)).length >= 2;
  if (hotel.ownership_type === "independent" && (hotel.rooms ?? 0) < 120) return "Owner or General Manager";
  if (cross) return "General Manager or Operations Manager";
  switch (top) {
    case "shuttle":
      return "General Manager or Front Office Manager";
    case "housekeeping":
      return "Executive Housekeeper or Director of Rooms";
    case "maintenance":
      return "Chief Engineer or General Manager";
    case "houseman":
      return "Front Office Manager or Director of Rooms";
    case "parking":
    case "wakeup":
      return "Front Office Manager";
    default:
      return "General Manager";
  }
}

export function existingTools(ans: Answers, hotel: Pick<Hotel, "pms" | "ops_software">) {
  const tools = new Set<string>();
  if (hotel.pms) tools.add(`PMS: ${hotel.pms}`);
  if (hotel.ops_software) tools.add(hotel.ops_software);
  for (const k of ["hk_system", "hm_method", "mt_method", "sh_record", "pk_record", "wk_record"]) {
    const v = a(ans, k);
    if (v && !["Unknown", "Other", "Verbal"].includes(v)) tools.add(v);
  }
  return [...tools];
}

const lc = (s?: string) => (s ? s.charAt(0).toLowerCase() + s.slice(1) : "");

export function buildSummary(
  hotel: Pick<Hotel, "rooms" | "airport" | "brand" | "shuttle" | "name">,
  ans: Answers,
  extra?: { outside_pms?: string | null; most_manual?: string | null }
) {
  const parts: string[] = [];
  const size = hotel.rooms ? `${hotel.rooms}-room ` : "";
  parts.push(`${size}${hotel.airport ? "airport " : ""}hotel${hotel.brand ? ` (${hotel.brand})` : ""}.`);

  const shuttle: string[] = [];
  if (hotel.shuttle || ans.sh_record) {
    if (is(ans, "sh_guest_calls", "yes")) shuttle.push("Shuttle requests are made by phone after guests land.");
    const rec = a(ans, "sh_record");
    if (rec && rec !== "Unknown") shuttle.push(`Pickup requests are recorded via ${lc(rec)}.`);
    const drv = a(ans, "sh_driver_notify");
    if (drv && drv !== "Unknown") shuttle.push(`Front desk notifies the driver by ${lc(drv)}.`);
    if (is(ans, "sh_fd_driver_status", "no")) shuttle.push("Front desk can't see driver status.");
    if (is(ans, "sh_sms", "no")) shuttle.push("Guests do not receive SMS status updates.");
  }
  if (shuttle.length) parts.push(shuttle.join(" "));

  const hm: string[] = [];
  const hmm = a(ans, "hm_method");
  if (hmm && hmm !== "Unknown") hm.push(`Houseman requests are passed by ${lc(hmm)}.`);
  if (is(ans, "hm_completion_visible", "no")) hm.push("Front desk can't see when they're completed.");
  if (hm.length) parts.push(hm.join(" "));

  const mt: string[] = [];
  const mtm = a(ans, "mt_method");
  if (mtm && mtm !== "Unknown") mt.push(mtm === "Paper log" || mtm === "Excel" ? `Maintenance requests are kept in ${mtm === "Excel" ? "Excel" : "a paper log"}.` : `Maintenance requests are recorded in ${mtm}.`);
  if (is(ans, "mt_fd_status", "no")) mt.push("Front desk can't see ticket status.");
  if (mt.length) parts.push(mt.join(" "));

  const hk: string[] = [];
  if (is(ans, "hk_fd_calls", "yes")) hk.push("Front desk has to call/radio housekeeping to check room readiness.");
  else if (is(ans, "hk_fd_sees_ready", "no")) hk.push("Front desk can't immediately see when rooms are ready.");
  if (hk.length) parts.push(hk.join(" "));

  const pk = a(ans, "pk_record");
  if (pk && (MANUAL.pk.includes(pk) || is(ans, "pk_digital_list", "no"))) parts.push(`Parking vehicles tracked via ${lc(pk)}.`);
  if (is(ans, "wk_mode", "Manual")) parts.push("Wake-up calls are handled manually.");

  if (extra?.outside_pms) parts.push(`Outside the PMS: ${extra.outside_pms}`);
  if (extra?.most_manual) parts.push(`Most manual workflow: ${extra.most_manual}`);

  const big = biggestPain(ans, hotel);
  if (big) parts.push(`Biggest opportunity: ${lc(big)}.`);
  return parts.join("\n\n");
}

// ───────────── Demo plan ─────────────
export const DEMO_SCRIPTS: Record<Area, { title: string; steps: string[] }> = {
  shuttle: {
    title: "Airport shuttle pickup",
    steps: [
      "Guest calls from Terminal 1",
      "Front desk creates shuttle request",
      "Driver receives request",
      "Guest receives SMS",
      "Pickup status changes",
      "Front desk sees completion",
    ],
  },
  houseman: {
    title: "Houseman guest request",
    steps: ["Guest requests towels", "Front desk creates houseman request", "Houseman acknowledges", "Completes request", "Front desk sees completion"],
  },
  maintenance: {
    title: "Maintenance ticket",
    steps: ["Room reports AC problem", "Maintenance ticket created", "Engineering acknowledges", "Status tracked", "History remains attached to room"],
  },
  housekeeping: {
    title: "Room readiness / early check-in",
    steps: [
      "Guest arrives early; room not ready",
      "Front desk flags room as priority",
      "Housekeeper marks room clean on phone",
      "Front desk sees room ready instantly",
      "Guest is notified",
    ],
  },
  parking: {
    title: "Long-term parking",
    steps: ["Guest checks in with vehicle", "Plate & departure date captured against reservation", "Digital vehicle list updates", "Overstay flagged automatically"],
  },
  wakeup: {
    title: "Wake-up calls",
    steps: ["Guest requests 5:00 a.m. wake-up", "Request logged with room & time", "Night shift sees pending list", "Completion / no-answer recorded"],
  },
};

export function demoPlan(ans: Answers, hotel?: Pick<Hotel, "shuttle">) {
  const areas = rankAreas(ans, hotel);
  return areas.map((area) => ({ area, label: AREA_LABEL[area], ...DEMO_SCRIPTS[area] }));
}

export { AREA_LABEL };
