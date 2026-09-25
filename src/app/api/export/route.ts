import { NextResponse, type NextRequest } from "next/server";
import Papa from "papaparse";
import { createClient } from "@/lib/supabase/server";
import { INQUIRY_SECTIONS } from "@/lib/constants";
import { effectiveClass, effectiveScore } from "@/lib/scoring";
import type { Activity, Contact, Deal, Hotel, InquiryCall, PainPoint } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const type = req.nextUrl.searchParams.get("type") ?? "hotels";
  const { data: hotelsData } = await supabase.from("hotels").select("*").order("name");
  const hotels = (hotelsData ?? []) as Hotel[];
  const name = new Map(hotels.map((h) => [h.id, h.name]));
  let rows: Record<string, unknown>[] = [];

  switch (type) {
    case "hotels":
      rows = hotels.map((h) => ({
        "Hotel Name": h.name,
        Brand: h.brand,
        "Management Company": h.management_company,
        Ownership: h.ownership_type,
        Address: h.address,
        City: h.city,
        Phone: h.phone,
        Website: h.website,
        "Maps URL": h.maps_url,
        Rooms: h.rooms,
        Airport: yn(h.airport),
        Shuttle: yn(h.shuttle),
        "24h Shuttle": yn(h.shuttle_24h),
        "Long-term Parking": yn(h.long_term_parking),
        "Short-term Parking": yn(h.short_term_parking),
        Restaurant: yn(h.restaurant),
        "Meeting Space": yn(h.meeting_space),
        "24h Front Desk": yn(h.front_desk_24h),
        PMS: h.pms,
        "Ops Software": h.ops_software,
        Tags: h.tags.join("; "),
        Stage: h.stage,
        "Pipeline Status": h.pipeline_status,
        Score: effectiveScore(h),
        Classification: effectiveClass(h).label,
        "Biggest Pain": h.biggest_pain,
        "Manual Housekeeping": yn(h.manual_housekeeping),
        "Manual Houseman": yn(h.manual_houseman),
        "Manual Maintenance": yn(h.manual_maintenance),
        "Manual Shuttle": yn(h.manual_shuttle),
        "Manual Parking": yn(h.manual_parking),
        "Manual Wake-up": yn(h.manual_wakeup),
        "Next Action": h.next_action,
        "Next Action Date": h.next_action_date,
        "Last Contacted": h.last_contacted_at,
        "Lead Owner": h.lead_owner,
        "Not Fit Reason": h.not_fit_reason,
        Notes: h.notes,
      }));
      break;
    case "stage1": {
      const { data } = await supabase.from("inquiry_calls").select("*").order("called_at");
      const qs = INQUIRY_SECTIONS.flatMap((s) => [...s.questions.map((q) => ({ key: q.key, label: `${s.title}: ${q.label}` })), { key: s.notesKey, label: `${s.title}: notes` }]);
      rows = ((data ?? []) as InquiryCall[]).map((c) => ({
        Hotel: name.get(c.hotel_id),
        "Called At": c.called_at,
        Answered: yn(c.answered),
        "Spoke With": [c.spoke_role, c.spoke_with].filter(Boolean).join(" — "),
        Score: c.score,
        ...Object.fromEntries(qs.map((q) => [q.label, fmt(c.answers[q.key])])),
        "Outside the PMS": c.outside_pms,
        "Most Manual Workflow": c.most_manual,
        Notes: c.notes,
      }));
      break;
    }
    case "pipeline": {
      const { data } = await supabase.from("deals").select("*");
      const deals = new Map(((data ?? []) as Deal[]).map((d) => [d.hotel_id, d]));
      rows = hotels
        .filter((h) => h.stage !== "prospect")
        .map((h) => {
          const d = deals.get(h.id);
          return {
            Hotel: h.name,
            Stage: h.stage,
            "Pipeline Status": h.pipeline_status,
            Score: effectiveScore(h),
            "Biggest Pain": h.biggest_pain,
            "Next Action": h.next_action,
            "Next Action Date": h.next_action_date,
            "Last Contacted": h.last_contacted_at,
            "Lead Owner": h.lead_owner,
            Plan: d?.plan,
            "Setup Fee": d?.setup_fee,
            Monthly: d?.monthly,
            "Contract Months": d?.contract_months,
            "Free Months": d?.free_months,
            Discount: d?.discount,
            TCV: d?.tcv,
            MRR: d?.mrr,
            ARR: d?.arr,
            "Proposal Date": d?.proposal_date,
            "Contract Start": d?.start_date,
            "Contract End": d?.end_date,
          };
        });
      break;
    }
    case "contacts": {
      const { data } = await supabase.from("contacts").select("*").order("created_at");
      rows = ((data ?? []) as Contact[]).map((c) => ({
        Hotel: name.get(c.hotel_id),
        Name: c.name,
        Title: c.title,
        Phone: c.phone,
        Email: c.email,
        LinkedIn: c.linkedin_url,
        "Decision Maker": c.decision_maker,
        Influence: c.influence,
        "Preferred Contact": c.preferred_contact,
        Notes: c.notes,
      }));
      break;
    }
    case "pain_points": {
      const { data } = await supabase.from("pain_points").select("*").order("created_at");
      rows = ((data ?? []) as PainPoint[]).map((p) => ({
        Hotel: name.get(p.hotel_id),
        Department: p.department,
        Description: p.description,
        "Current Workflow": p.current_workflow,
        "Existing System": p.existing_system,
        Severity: p.severity,
        Frequency: p.frequency,
        Impact: p.impact,
        "Product Feature": p.product_feature,
        "Confirmed by Management": yn(p.confirmed_by_mgmt),
      }));
      break;
    }
    case "activities": {
      const { data } = await supabase.from("activities").select("*").order("occurred_at");
      rows = ((data ?? []) as Activity[]).map((a) => ({ Hotel: name.get(a.hotel_id), Date: a.occurred_at, Kind: a.kind, Summary: a.summary, Outcome: a.outcome }));
      break;
    }
    default:
      return new NextResponse("Unknown export", { status: 400 });
  }

  const csv = Papa.unparse(rows.length ? rows : [{ "No data": "" }]);
  const stamp = new Date().toISOString().slice(0, 10);
  return new NextResponse("﻿" + csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${type}-${stamp}.csv"`,
    },
  });
}

function yn(v: boolean | null | undefined) {
  return v == null ? "" : v ? "Yes" : "No";
}
function fmt(v: unknown) {
  if (v == null) return "";
  if (Array.isArray(v)) return v.join("; ");
  return v === "yes" ? "Yes" : v === "no" ? "No" : v === "unknown" ? "Unknown" : String(v);
}
