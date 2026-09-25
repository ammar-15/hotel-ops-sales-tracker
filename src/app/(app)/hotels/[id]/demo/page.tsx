import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/supabase/server";
import { demoPlan, effectiveClass, effectiveScore, existingTools, recommendedRole } from "@/lib/scoring";
import { fmtDateTime } from "@/lib/utils";
import type { Answers } from "@/lib/constants";
import type { Contact, Demo, Hotel, PainPoint } from "@/lib/types";
import { Badge, Card, Empty, PageHeader, ScoreBadge, buttonClass } from "@/components/ui";
import { PrintButton } from "@/components/print-button";

export const dynamic = "force-dynamic";

export default async function DemoPrep({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await requireUser();
  const [hRes, callRes, ppRes, cRes, dRes] = await Promise.all([
    supabase.from("hotels").select("*").eq("id", id).maybeSingle<Hotel>(),
    supabase.from("inquiry_calls").select("answers").eq("hotel_id", id).eq("answered", true).order("called_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("pain_points").select("*").eq("hotel_id", id).order("created_at"),
    supabase.from("contacts").select("*").eq("hotel_id", id),
    supabase.from("demos").select("*").eq("hotel_id", id).eq("status", "booked").order("scheduled_at").limit(1),
  ]);
  const h = hRes.data;
  if (!h) notFound();
  const ans = (callRes.data?.answers ?? {}) as Answers;
  const pains = (ppRes.data ?? []) as PainPoint[];
  const contacts = (cRes.data ?? []) as Contact[];
  const next = (dRes.data ?? [])[0] as Demo | undefined;
  const plan = demoPlan(ans, h);
  const sevRank = { High: 0, Medium: 1, Low: 2 } as Record<string, number>;
  const sortedPains = [...pains].sort((a, b) => (sevRank[a.severity ?? "Low"] ?? 3) - (sevRank[b.severity ?? "Low"] ?? 3));

  return (
    <>
      <PageHeader
        title={`Prepare demo — ${h.name}`}
        subtitle={next ? `Next demo: ${fmtDateTime(next.scheduled_at)}` : "No demo booked yet"}
        actions={
          <>
            <PrintButton />
            <Link href={`/hotels/${h.id}`} className={buttonClass("secondary")}>Back to hotel</Link>
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card title="Hotel's biggest problems">
            {plan.length ? (
              <ol className="list-decimal space-y-1 pl-5 text-[15px]">
                {plan.map((p) => <li key={p.area} className="font-medium">{p.label}</li>)}
              </ol>
            ) : (
              <Empty>No Stage 1 findings yet — log a Stage 1 call first.</Empty>
            )}
          </Card>

          <Card title="Recommended demo flow">
            {plan.length ? (
              <div className="space-y-5">
                {plan.map((p, i) => (
                  <div key={p.area}>
                    <h3 className="mb-2 text-sm font-semibold text-slate-800">
                      {i === 0 ? "Start with" : "Then"}: {p.title}
                    </h3>
                    <ol className="space-y-1.5">
                      {p.steps.map((s, j) => (
                        <li key={j} className="flex gap-3 text-sm">
                          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xs font-semibold text-brand-700">{j + 1}</span>
                          {s}
                        </li>
                      ))}
                    </ol>
                  </div>
                ))}
                <p className="border-t border-slate-100 pt-3 text-xs text-slate-500">
                  Only workflows with evidence from Stage 1 are included. Skip unrelated features unless they ask.
                </p>
              </div>
            ) : (
              <Empty>Nothing to recommend yet.</Empty>
            )}
          </Card>

          {h.stage1_summary && (
            <Card title="Stage 1 summary">
              <div className="space-y-2 text-sm whitespace-pre-line text-slate-700">{h.stage1_summary}</div>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card title="At a glance">
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between"><dt className="text-slate-500">Score</dt><dd><ScoreBadge score={effectiveScore(h)} label={effectiveClass(h).label} /></dd></div>
              <div className="flex justify-between gap-3"><dt className="text-slate-500">Existing tools</dt><dd className="text-right">{existingTools(ans, h).join(", ") || "—"}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-slate-500">Best audience</dt><dd className="text-right">{recommendedRole(ans, h)}</dd></div>
            </dl>
          </Card>

          <Card title="Who's attending">
            {contacts.length ? (
              <ul className="space-y-2 text-sm">
                {contacts.map((c) => (
                  <li key={c.id} className="flex justify-between gap-2">
                    <span className="font-medium">{c.name}</span>
                    <span className="text-slate-500">{c.title}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <Empty>No contacts yet.</Empty>
            )}
          </Card>

          <Card title="Pain points to address">
            {sortedPains.length ? (
              <ul className="space-y-2 text-sm">
                {sortedPains.map((p) => (
                  <li key={p.id}>
                    <div className="flex items-center gap-1.5">
                      <Badge tone="blue">{p.department}</Badge>
                      {p.confirmed_by_mgmt && <Badge tone="green">Confirmed</Badge>}
                    </div>
                    <p className="mt-1">{p.description}</p>
                    {p.product_feature && <p className="text-xs text-slate-500">Show: {p.product_feature}</p>}
                  </li>
                ))}
              </ul>
            ) : (
              <Empty>No structured pain points saved.</Empty>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
