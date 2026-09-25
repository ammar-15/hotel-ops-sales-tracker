"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient, requireUser } from "@/lib/supabase/server";
import { bool, num, str } from "@/lib/utils";
import { biggestPain, buildSummary, manualFlags, scoreHotel } from "@/lib/scoring";
import { STATUS_ORDER, type Answers } from "@/lib/constants";
import type { Hotel } from "@/lib/types";

const refresh = () => revalidatePath("/", "layout");

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

async function log(
  supabase: Awaited<ReturnType<typeof createClient>>,
  hotel_id: string,
  kind: string,
  summary: string,
  extra: { contact_id?: string | null; outcome?: string | null; occurred_at?: string } = {}
) {
  await supabase.from("activities").insert({ hotel_id, kind, summary, ...extra });
}

// ───────────── Hotels ─────────────
function hotelFromForm(fd: FormData) {
  const tags = fd.getAll("tags").map(String);
  return {
    name: str(fd.get("name")) ?? "Untitled hotel",
    brand: str(fd.get("brand")),
    management_company: str(fd.get("management_company")),
    ownership_type: str(fd.get("ownership_type")),
    address: str(fd.get("address")),
    city: str(fd.get("city")),
    phone: str(fd.get("phone")),
    website: str(fd.get("website")),
    maps_url: str(fd.get("maps_url")),
    rooms: num(fd.get("rooms")),
    airport: bool(fd.get("airport")),
    shuttle: bool(fd.get("shuttle")),
    shuttle_24h: bool(fd.get("shuttle_24h")),
    long_term_parking: bool(fd.get("long_term_parking")),
    short_term_parking: bool(fd.get("short_term_parking")),
    restaurant: bool(fd.get("restaurant")),
    meeting_space: bool(fd.get("meeting_space")),
    front_desk_24h: bool(fd.get("front_desk_24h")),
    pms: str(fd.get("pms")),
    ops_software: str(fd.get("ops_software")),
    notes: str(fd.get("notes")),
    lead_owner: str(fd.get("lead_owner")),
    tags,
  };
}

export async function createHotel(fd: FormData) {
  const { supabase } = await requireUser();
  const { data, error } = await supabase.from("hotels").insert(hotelFromForm(fd)).select("id").single();
  if (error) throw new Error(error.message);
  await rescore(data.id);
  refresh();
  redirect(`/hotels/${data.id}`);
}

export async function updateHotel(id: string, fd: FormData) {
  const { supabase } = await requireUser();
  const { error } = await supabase.from("hotels").update(hotelFromForm(fd)).eq("id", id);
  if (error) throw new Error(error.message);
  await rescore(id);
  refresh();
  redirect(`/hotels/${id}`);
}

export async function deleteHotel(id: string) {
  const { supabase } = await requireUser();
  await supabase.from("hotels").delete().eq("id", id);
  refresh();
  redirect("/hotels");
}

/** Recompute score, flags, summary from the hotel profile + latest answered Stage 1 call. */
export async function rescore(hotelId: string) {
  const supabase = await createClient();
  const { data: hotel } = await supabase.from("hotels").select("*").eq("id", hotelId).single<Hotel>();
  if (!hotel) return;
  const { data: call } = await supabase
    .from("inquiry_calls")
    .select("answers, outside_pms, most_manual")
    .eq("hotel_id", hotelId)
    .eq("answered", true)
    .order("called_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const ans = (call?.answers ?? null) as Answers | null;
  const { score, breakdown } = scoreHotel(hotel, ans);
  const patch: Partial<Hotel> = { opportunity_score: score, score_breakdown: breakdown };
  if (ans) {
    Object.assign(patch, manualFlags(ans, hotel), {
      biggest_pain: biggestPain(ans, hotel),
      stage1_summary: buildSummary(hotel, ans, { outside_pms: call?.outside_pms, most_manual: call?.most_manual }),
    });
  }
  await supabase.from("hotels").update(patch).eq("id", hotelId);
}

// ───────────── Stage 1 ─────────────
export interface InquiryPayload {
  called_at: string;
  spoke_with: string | null;
  spoke_role: string | null;
  answered: boolean;
  answers: Answers;
  outside_pms: string | null;
  most_manual: string | null;
  notes: string | null;
  hotel_shuttle?: boolean;
}

export async function saveInquiryCall(hotelId: string, p: InquiryPayload) {
  const { supabase } = await requireUser();
  const { data: hotel } = await supabase.from("hotels").select("*").eq("id", hotelId).single<Hotel>();
  if (!hotel) throw new Error("Hotel not found");

  // Keep the profile in sync with what was learned on the call.
  const profilePatch: Partial<Hotel> = {};
  if (p.hotel_shuttle !== undefined && p.hotel_shuttle !== hotel.shuttle) profilePatch.shuttle = p.hotel_shuttle;
  if (p.answers.sh_24h === "yes") profilePatch.shuttle_24h = true;
  if (p.answers.pk_long_term === "yes") profilePatch.long_term_parking = true;
  if (p.answers.pk_short_term === "yes") profilePatch.short_term_parking = true;
  const merged = { ...hotel, ...profilePatch };

  const score = p.answered ? scoreHotel(merged, p.answers).score : null;
  const { error } = await supabase.from("inquiry_calls").insert({
    hotel_id: hotelId,
    called_at: p.called_at,
    spoke_with: p.spoke_with,
    spoke_role: p.spoke_role,
    answered: p.answered,
    answers: p.answers,
    outside_pms: p.outside_pms,
    most_manual: p.most_manual,
    notes: p.notes,
    score,
  });
  if (error) throw new Error(error.message);

  const stagePatch: Partial<Hotel> = p.answered
    ? {
        stage: hotel.stage === "stage2" ? "stage2" : "stage1_review",
        stage1_completed_at: p.called_at,
        next_action: hotel.stage === "stage2" ? hotel.next_action : "Decide: move to Stage 2?",
        next_action_date: hotel.stage === "stage2" ? hotel.next_action_date : p.called_at.slice(0, 10),
      }
    : {
        stage: hotel.stage === "prospect" ? "call_again" : hotel.stage,
        next_action: "Call again (no answer)",
        next_action_date: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
      };

  await supabase
    .from("hotels")
    .update({ ...profilePatch, ...stagePatch, inquiry_call_count: hotel.inquiry_call_count + 1, last_contacted_at: p.called_at })
    .eq("id", hotelId);

  await log(
    supabase,
    hotelId,
    "inquiry_call",
    p.answered ? `Stage 1 inquiry call${p.spoke_role ? ` — spoke with ${p.spoke_role}` : ""}` : "Stage 1 call — no answer",
    { outcome: p.answered && score != null ? `Score ${score}` : null, occurred_at: p.called_at }
  );
  if (p.answered) await rescore(hotelId);
  refresh();
  redirect(`/hotels/${hotelId}${p.answered ? "?decide=1" : ""}`);
}

export async function stageDecision(hotelId: string, fd: FormData) {
  const { supabase } = await requireUser();
  const decision = String(fd.get("decision"));
  const reason = str(fd.get("reason"));
  const today = new Date().toISOString().slice(0, 10);
  const patch: Partial<Hotel> = {};
  let summary = "";
  switch (decision) {
    case "stage2":
      Object.assign(patch, {
        stage: "stage2",
        pipeline_status: "Outreach not started",
        next_action: "Identify management contact",
        next_action_date: today,
        not_fit_reason: null,
      });
      summary = "Moved to Stage 2 — management outreach";
      break;
    case "research_more":
      Object.assign(patch, { stage: "research_more", next_action: reason ?? "Research more", next_action_date: today });
      summary = "Marked: research more";
      break;
    case "call_again":
      Object.assign(patch, {
        stage: "call_again",
        next_action: reason ?? "Call again",
        next_action_date: str(fd.get("date")) ?? new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10),
      });
      summary = "Marked: call again later";
      break;
    case "not_fit":
      if (!reason) throw new Error("A reason is required when marking Not a Fit");
      Object.assign(patch, { stage: "not_fit", not_fit_reason: reason, next_action: null, next_action_date: null });
      summary = `Marked not a fit: ${reason}`;
      break;
    default:
      return;
  }
  await supabase.from("hotels").update(patch).eq("id", hotelId);
  await log(supabase, hotelId, "stage_change", summary);
  refresh();
  redirect(`/hotels/${hotelId}`);
}

export async function updateScoring(hotelId: string, fd: FormData) {
  const { supabase } = await requireUser();
  await supabase
    .from("hotels")
    .update({
      score_override: num(fd.get("score_override")),
      classification_override: str(fd.get("classification_override")),
      corporate_controlled: bool(fd.get("corporate_controlled")),
      mgmt_no_pain: bool(fd.get("mgmt_no_pain")),
    })
    .eq("id", hotelId);
  await rescore(hotelId);
  refresh();
}

export async function setNextAction(hotelId: string, fd: FormData) {
  const { supabase } = await requireUser();
  await supabase
    .from("hotels")
    .update({
      next_action: str(fd.get("next_action")),
      next_action_date: str(fd.get("next_action_date")),
      lead_owner: str(fd.get("lead_owner")),
    })
    .eq("id", hotelId);
  refresh();
}

export async function setPipelineStatus(hotelId: string, fd: FormData) {
  const { supabase } = await requireUser();
  const status = str(fd.get("pipeline_status"));
  await supabase.from("hotels").update({ pipeline_status: status, stage: "stage2" }).eq("id", hotelId);
  if (status) await log(supabase, hotelId, "status", `Pipeline status → ${status}`);
  refresh();
}

// ───────────── Contacts ─────────────
function contactFromForm(fd: FormData) {
  return {
    name: str(fd.get("name")) ?? "Unknown",
    title: str(fd.get("title")),
    linkedin_url: str(fd.get("linkedin_url")),
    email: str(fd.get("email")),
    phone: str(fd.get("phone")),
    decision_maker: str(fd.get("decision_maker")) ?? "unknown",
    influence: str(fd.get("influence")),
    preferred_contact: str(fd.get("preferred_contact")),
    notes: str(fd.get("notes")),
  };
}

export async function addContact(hotelId: string, fd: FormData) {
  const { supabase } = await requireUser();
  const c = contactFromForm(fd);
  const { data: contact, error } = await supabase.from("contacts").insert({ ...c, hotel_id: hotelId }).select("id").single();
  if (error) throw new Error(error.message);
  await log(supabase, hotelId, "contact_added", `${c.title ?? "Contact"} identified — ${c.name}`, { contact_id: contact.id });
  const { data: h } = await supabase.from("hotels").select("stage, pipeline_status").eq("id", hotelId).single();
  if (h?.stage === "stage2" && (!h.pipeline_status || h.pipeline_status === "Outreach not started")) {
    await supabase
      .from("hotels")
      .update({ pipeline_status: "Management contact identified", next_action: `Reach out to ${c.name}`, next_action_date: new Date().toISOString().slice(0, 10) })
      .eq("id", hotelId);
  }
  refresh();
}

export async function updateContact(contactId: string, fd: FormData) {
  const { supabase } = await requireUser();
  await supabase.from("contacts").update(contactFromForm(fd)).eq("id", contactId);
  refresh();
}

export async function deleteContact(contactId: string) {
  const { supabase } = await requireUser();
  await supabase.from("contacts").delete().eq("id", contactId);
  refresh();
}

// ───────────── Activities (management calls, emails, LinkedIn, notes) ─────────────
const KIND_STATUS: Record<string, string> = { mgmt_call: "Called", email: "Email sent", linkedin: "LinkedIn sent" };

export async function logActivity(hotelId: string, fd: FormData) {
  const { supabase } = await requireUser();
  const kind = String(fd.get("kind") ?? "note");
  const summary = str(fd.get("summary")) ?? (kind === "note" ? "Note" : kind === "mgmt_call" ? "Called management" : kind === "email" ? "Email sent" : "LinkedIn message sent");
  const occurred_at = str(fd.get("occurred_at")) ? new Date(String(fd.get("occurred_at"))).toISOString() : new Date().toISOString();
  await log(supabase, hotelId, kind, summary, { contact_id: str(fd.get("contact_id")), outcome: str(fd.get("outcome")), occurred_at });

  const { data: h } = await supabase.from("hotels").select("pipeline_status, stage").eq("id", hotelId).single();
  const patch: Record<string, unknown> = {};
  if (kind !== "note") patch.last_contacted_at = occurred_at;
  const explicit = str(fd.get("pipeline_status"));
  const auto = KIND_STATUS[kind];
  if (explicit) patch.pipeline_status = explicit;
  else if (auto && h?.stage === "stage2" && (!h.pipeline_status || (STATUS_ORDER[h.pipeline_status] ?? -1) < STATUS_ORDER[auto]))
    patch.pipeline_status = auto;
  if (str(fd.get("next_action"))) {
    patch.next_action = str(fd.get("next_action"));
    patch.next_action_date = str(fd.get("next_action_date"));
  }
  if (Object.keys(patch).length) await supabase.from("hotels").update(patch).eq("id", hotelId);
  refresh();
}

export async function deleteActivity(id: string) {
  const { supabase } = await requireUser();
  await supabase.from("activities").delete().eq("id", id);
  refresh();
}

// ───────────── Pain points ─────────────
export async function addPainPoint(hotelId: string, fd: FormData) {
  const { supabase } = await requireUser();
  const { error } = await supabase.from("pain_points").insert({
    hotel_id: hotelId,
    department: str(fd.get("department")) ?? "Other",
    description: str(fd.get("description")) ?? "",
    current_workflow: str(fd.get("current_workflow")),
    existing_system: str(fd.get("existing_system")),
    severity: str(fd.get("severity")),
    frequency: str(fd.get("frequency")),
    impact: str(fd.get("impact")),
    product_feature: str(fd.get("product_feature")),
    confirmed_by_mgmt: bool(fd.get("confirmed_by_mgmt")),
  });
  if (error) throw new Error(error.message);
  refresh();
}

export async function togglePainConfirmed(id: string, value: boolean) {
  const { supabase } = await requireUser();
  await supabase.from("pain_points").update({ confirmed_by_mgmt: value }).eq("id", id);
  refresh();
}

export async function deletePainPoint(id: string) {
  const { supabase } = await requireUser();
  await supabase.from("pain_points").delete().eq("id", id);
  refresh();
}

// ───────────── Deals ─────────────
export async function saveDeal(hotelId: string, fd: FormData) {
  const { supabase } = await requireUser();
  const deal = {
    hotel_id: hotelId,
    plan: str(fd.get("plan")) ?? "founding",
    setup_fee: num(fd.get("setup_fee")) ?? 0,
    monthly: num(fd.get("monthly")) ?? 0,
    contract_months: num(fd.get("contract_months")) ?? 12,
    free_months: num(fd.get("free_months")) ?? 0,
    discount: num(fd.get("discount")) ?? 0,
    proposal_date: str(fd.get("proposal_date")),
    start_date: str(fd.get("start_date")),
    end_date: str(fd.get("end_date")),
    notes: str(fd.get("notes")),
  };
  const { data: existing } = await supabase.from("deals").select("id, proposal_date").eq("hotel_id", hotelId).maybeSingle();
  const { error } = await supabase.from("deals").upsert(deal, { onConflict: "hotel_id" });
  if (error) throw new Error(error.message);
  await log(supabase, hotelId, "deal", existing ? "Deal updated" : `Deal created (${deal.plan})`);
  if (deal.proposal_date && existing?.proposal_date !== deal.proposal_date) {
    const { data: h } = await supabase.from("hotels").select("pipeline_status").eq("id", hotelId).single();
    if (!h?.pipeline_status || (STATUS_ORDER[h.pipeline_status] ?? -1) < STATUS_ORDER["Proposal sent"]) {
      await supabase.from("hotels").update({ pipeline_status: "Proposal sent", stage: "stage2" }).eq("id", hotelId);
      await log(supabase, hotelId, "status", "Proposal sent", { occurred_at: new Date(deal.proposal_date + "T12:00:00").toISOString() });
    }
  }
  refresh();
}

// ───────────── Demos ─────────────
export async function bookDemo(hotelId: string, fd: FormData) {
  const { supabase } = await requireUser();
  const when = str(fd.get("scheduled_at"));
  if (!when) throw new Error("Pick a date/time");
  const scheduled_at = new Date(when).toISOString();
  await supabase.from("demos").insert({ hotel_id: hotelId, contact_id: str(fd.get("contact_id")), scheduled_at, notes: str(fd.get("notes")) });
  await supabase
    .from("hotels")
    .update({ pipeline_status: "Demo booked", stage: "stage2", next_action: "Run demo", next_action_date: scheduled_at.slice(0, 10) })
    .eq("id", hotelId);
  await log(supabase, hotelId, "demo", `Demo booked for ${new Date(scheduled_at).toLocaleString("en-CA", { dateStyle: "medium", timeStyle: "short" })}`);
  refresh();
}

export async function setDemoStatus(demoId: string, hotelId: string, status: string) {
  const { supabase } = await requireUser();
  await supabase.from("demos").update({ status }).eq("id", demoId);
  if (status === "completed") {
    await supabase
      .from("hotels")
      .update({ pipeline_status: "Demo completed", next_action: "Send proposal / follow up", next_action_date: new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10) })
      .eq("id", hotelId);
    await log(supabase, hotelId, "demo", "Demo completed");
  } else {
    await log(supabase, hotelId, "demo", `Demo ${status.replace("_", " ")}`);
  }
  refresh();
}

// ───────────── CSV import ─────────────
export interface ImportRow {
  name: string;
  brand?: string | null;
  address?: string | null;
  city?: string | null;
  phone?: string | null;
  website?: string | null;
  rooms?: number | null;
  shuttle?: boolean;
  parking?: boolean;
  airport?: boolean;
  notes?: string | null;
}

const norm = (s: string | null | undefined) => (s ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");

export async function importHotels(rows: ImportRow[]) {
  const { supabase } = await requireUser();
  const { data: existing } = await supabase.from("hotels").select("name, address");
  const seen = new Set((existing ?? []).map((h) => norm(h.name) + "|" + norm(h.address)));
  const toInsert: Record<string, unknown>[] = [];
  const duplicates: string[] = [];
  for (const r of rows) {
    if (!r.name?.trim()) continue;
    const key = norm(r.name) + "|" + norm(r.address);
    if (seen.has(key)) {
      duplicates.push(r.name);
      continue;
    }
    seen.add(key);
    const tags: string[] = [];
    if (r.airport) tags.push("Airport");
    if (r.shuttle) tags.push("Shuttle");
    if (r.parking) tags.push("Parking");
    if ((r.rooms ?? 0) >= 100) tags.push("100+ Rooms");
    toInsert.push({
      name: r.name.trim(),
      brand: r.brand || null,
      address: r.address || null,
      city: r.city || null,
      phone: r.phone || null,
      website: r.website || null,
      rooms: r.rooms ?? null,
      shuttle: !!r.shuttle,
      airport: !!r.airport,
      long_term_parking: false,
      short_term_parking: !!r.parking,
      notes: r.notes || null,
      tags,
    });
  }
  if (toInsert.length) {
    const { data, error } = await supabase.from("hotels").insert(toInsert).select("*");
    if (error) return { inserted: 0, duplicates, error: error.message };
    // initial profile-only scores
    await Promise.all(
      (data as Hotel[]).map((h) => {
        const { score, breakdown } = scoreHotel(h, null);
        return supabase.from("hotels").update({ opportunity_score: score, score_breakdown: breakdown }).eq("id", h.id);
      })
    );
  }
  refresh();
  return { inserted: toInsert.length, duplicates, error: null as string | null };
}

// ───────────── Settings ─────────────
export async function updatePricing(fd: FormData) {
  const { supabase } = await requireUser();
  const { data: org } = await supabase.from("organizations").select("id").limit(1).single();
  if (!org) return;
  const plan = (p: string, label: string) => ({
    label,
    setup_fee: num(fd.get(`${p}_setup_fee`)) ?? 0,
    monthly: num(fd.get(`${p}_monthly`)) ?? 0,
    contract_months: num(fd.get(`${p}_contract_months`)) ?? 12,
    free_months: num(fd.get(`${p}_free_months`)) ?? 0,
  });
  await supabase
    .from("organizations")
    .update({ name: str(fd.get("org_name")) ?? "My workspace", pricing: { founding: plan("founding", "Founding Customer"), standard: plan("standard", "Standard") } })
    .eq("id", org.id);
  refresh();
}
