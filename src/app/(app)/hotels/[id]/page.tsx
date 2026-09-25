import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink, Globe, MapPin, Pencil, Phone, Presentation, Trash2 } from "lucide-react";
import { requireUser } from "@/lib/supabase/server";
import {
  addContact,
  addPainPoint,
  bookDemo,
  deleteActivity,
  deleteContact,
  deletePainPoint,
  logActivity,
  setDemoStatus,
  setNextAction,
  setPipelineStatus,
  togglePainConfirmed,
  updateScoring,
} from "../../actions";
import { CONTACT_TITLES, DEPARTMENTS, INQUIRY_SECTIONS, PIPELINE_STATUSES, type Answers } from "@/lib/constants";
import { CLASSIFICATIONS, effectiveClass, effectiveScore, existingTools, rankAreas, recommendedRole, AREA_LABEL } from "@/lib/scoring";
import { fmtDate, fmtDateTime, money, todayISO } from "@/lib/utils";
import type { Activity, Contact, Deal, Demo, Hotel, InquiryCall, PainPoint, Pricing } from "@/lib/types";
import { Badge, Card, Empty, Field, ScoreBadge, StageBadge, buttonClass } from "@/components/ui";
import { StageDecision } from "@/components/stage-decision";
import { ActivityIcon } from "@/components/activity-icon";
import { DealForm } from "@/components/deal-form";

export const dynamic = "force-dynamic";

const FLAGS: [keyof Hotel, string][] = [
  ["manual_housekeeping", "Housekeeping"],
  ["manual_houseman", "Houseman"],
  ["manual_maintenance", "Maintenance"],
  ["manual_shuttle", "Shuttle"],
  ["manual_parking", "Parking"],
  ["manual_wakeup", "Wake-up calls"],
];

export default async function HotelPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ decide?: string }> }) {
  const { id } = await params;
  const { decide } = await searchParams;
  const { supabase } = await requireUser();
  const [hRes, cRes, callsRes, ppRes, actRes, dealRes, demoRes, orgRes] = await Promise.all([
    supabase.from("hotels").select("*").eq("id", id).maybeSingle<Hotel>(),
    supabase.from("contacts").select("*").eq("hotel_id", id).order("created_at"),
    supabase.from("inquiry_calls").select("*").eq("hotel_id", id).order("called_at", { ascending: false }),
    supabase.from("pain_points").select("*").eq("hotel_id", id).order("created_at"),
    supabase.from("activities").select("*").eq("hotel_id", id).order("occurred_at", { ascending: false }),
    supabase.from("deals").select("*").eq("hotel_id", id).maybeSingle<Deal>(),
    supabase.from("demos").select("*").eq("hotel_id", id).order("scheduled_at", { ascending: false }),
    supabase.from("organizations").select("pricing").limit(1).maybeSingle(),
  ]);
  const h = hRes.data;
  if (!h) notFound();
  const contacts = (cRes.data ?? []) as Contact[];
  const calls = (callsRes.data ?? []) as InquiryCall[];
  const pains = (ppRes.data ?? []) as PainPoint[];
  const acts = (actRes.data ?? []) as Activity[];
  const demos = (demoRes.data ?? []) as Demo[];
  const pricing = (orgRes.data?.pricing ?? {}) as Pricing;
  const latest = calls.find((c) => c.answered);
  const ans: Answers = latest?.answers ?? {};
  const today = todayISO();
  const score = effectiveScore(h);
  const cls = effectiveClass(h);
  const contactName = new Map(contacts.map((c) => [c.id, c.name]));
  const showDecision = !!latest && (h.stage === "stage1_review" || decide === "1") && h.stage !== "stage2";
  const areas = latest ? rankAreas(ans, h) : [];

  return (
    <>
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{h.name}</h1>
            <StageBadge stage={h.stage} status={h.pipeline_status} />
            <ScoreBadge score={score} label={cls.label} />
          </div>
          <p className="mt-1 text-sm text-slate-500">
            {[h.brand, h.rooms && `${h.rooms} rooms`, h.airport && "Airport", h.shuttle && "Shuttle", (h.long_term_parking || h.short_term_parking) && "Parking", h.city]
              .filter(Boolean)
              .join(" · ")}
          </p>
          {h.tags.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {h.tags.map((t) => <Badge key={t} tone={t === "High Priority" ? "red" : "gray"}>{t}</Badge>)}
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {h.phone && (
            <a href={`tel:${h.phone}`} className={buttonClass("secondary")}>
              <Phone className="h-4 w-4" /> {h.phone}
            </a>
          )}
          <Link href={`/hotels/${h.id}/call`} className={buttonClass("primary")}>
            <Phone className="h-4 w-4" /> Start Stage 1 call
          </Link>
          {h.stage === "stage2" && (
            <Link href={`/hotels/${h.id}/demo`} className={buttonClass("secondary")}>
              <Presentation className="h-4 w-4" /> Prepare demo
            </Link>
          )}
          <Link href={`/hotels/${h.id}/edit`} className={buttonClass("ghost")}>
            <Pencil className="h-4 w-4" /> Edit
          </Link>
        </div>
      </div>

      {h.stage === "not_fit" && h.not_fit_reason && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <strong>Not a fit:</strong> {h.not_fit_reason}
        </div>
      )}

      {/* Move to Stage 2? */}
      {showDecision && (
        <section className="mb-6 rounded-lg border-2 border-brand-500 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold">Move to Stage 2?</h2>
          <dl className="mb-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <div>
              <dt className="label">Opportunity score</dt>
              <dd className="flex items-center gap-2"><span className="text-3xl font-semibold tabular-nums">{score ?? "—"}</span><Badge tone={cls.tone}>{cls.label}</Badge></dd>
            </div>
            <div>
              <dt className="label">Biggest discovered pain</dt>
              <dd className="text-sm font-medium">{h.biggest_pain ?? "None found"}</dd>
            </div>
            <div>
              <dt className="label">Existing tools</dt>
              <dd className="text-sm">{existingTools(ans, h).join(", ") || "—"}</dd>
            </div>
            <div>
              <dt className="label">Most promising workflow</dt>
              <dd className="text-sm">{areas[0] ? AREA_LABEL[areas[0]] : latest?.most_manual ?? "—"}</dd>
            </div>
            <div>
              <dt className="label">Recommended contact</dt>
              <dd className="text-sm font-medium">{recommendedRole(ans, h)}</dd>
            </div>
          </dl>
          <StageDecision hotelId={h.id} />
        </section>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* ─────────── Main column ─────────── */}
        <div className="space-y-6 lg:col-span-2">
          {h.stage1_summary ? (
            <section className="rounded-lg border border-amber-200 bg-amber-50/60 p-5">
              <div className="mb-2 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-amber-900">Stage 1 findings — read before calling management</h2>
                <span className="text-xs text-amber-800">{fmtDate(h.stage1_completed_at)}</span>
              </div>
              <div className="space-y-2 text-[15px] leading-relaxed whitespace-pre-line text-slate-800">{h.stage1_summary}</div>
            </section>
          ) : (
            <Card>
              <div className="flex flex-wrap items-center justify-between gap-3 p-4">
                <p className="text-sm text-slate-600">No Stage 1 call yet. Call during a quiet period and ask how operations work.</p>
                <Link href={`/hotels/${h.id}/call`} className={buttonClass("primary", "lg")}>
                  <Phone className="h-4 w-4" /> Start Stage 1 call
                </Link>
              </div>
            </Card>
          )}

          <Card title="Workflows">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {FLAGS.map(([k, label]) => {
                const v = h[k] as boolean | null;
                return (
                  <div key={k} className="flex items-center justify-between rounded-md border border-slate-200 px-3 py-2">
                    <span className="text-sm">{label}</span>
                    {v === true ? <Badge tone="red">Manual</Badge> : v === false ? <Badge tone="green">Digital</Badge> : <Badge>Unknown</Badge>}
                  </div>
                );
              })}
            </div>
          </Card>

          <Card title="Pain points" action={<span className="text-xs text-slate-500">{pains.length}</span>}>
            {pains.length > 0 && (
              <ul className="mb-4 space-y-3">
                {pains.map((p) => (
                  <li key={p.id} className="rounded-md border border-slate-200 p-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Badge tone="blue">{p.department}</Badge>
                          {p.severity && <Badge tone={p.severity === "High" ? "red" : p.severity === "Medium" ? "amber" : "gray"}>{p.severity}</Badge>}
                          {p.frequency && <Badge>{p.frequency}</Badge>}
                          {p.confirmed_by_mgmt && <Badge tone="green">Confirmed by mgmt</Badge>}
                        </div>
                        <p className="mt-1.5 text-sm font-medium">{p.description}</p>
                        <dl className="mt-1 grid gap-x-4 text-xs text-slate-600 sm:grid-cols-2">
                          {p.current_workflow && <div><dt className="inline font-medium">Now: </dt><dd className="inline">{p.current_workflow}</dd></div>}
                          {p.existing_system && <div><dt className="inline font-medium">System: </dt><dd className="inline">{p.existing_system}</dd></div>}
                          {p.impact && <div><dt className="inline font-medium">Impact: </dt><dd className="inline">{p.impact}</dd></div>}
                          {p.product_feature && <div><dt className="inline font-medium">Solves it: </dt><dd className="inline">{p.product_feature}</dd></div>}
                        </dl>
                      </div>
                      <div className="flex gap-1">
                        <form action={togglePainConfirmed.bind(null, p.id, !p.confirmed_by_mgmt)}>
                          <button className={buttonClass("ghost", "sm")}>{p.confirmed_by_mgmt ? "Unconfirm" : "Mgmt confirmed"}</button>
                        </form>
                        <form action={deletePainPoint.bind(null, p.id)}>
                          <button className={buttonClass("ghost", "sm")} aria-label="Delete"><Trash2 className="h-3.5 w-3.5" /></button>
                        </form>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <details className="group" open={pains.length === 0 && !!latest}>
              <summary className="cursor-pointer text-sm font-medium text-brand-600">+ Add pain point</summary>
              <form action={addPainPoint.bind(null, h.id)} className="mt-3 grid gap-3 sm:grid-cols-2">
                <Field label="Description *" className="sm:col-span-2">
                  <input name="description" required className="input" placeholder="Front desk cannot see whether houseman delivered guest request" />
                </Field>
                <Field label="Department">
                  <select name="department" className="input">{DEPARTMENTS.map((d) => <option key={d}>{d}</option>)}</select>
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Severity">
                    <select name="severity" className="input"><option value="">—</option><option>Low</option><option>Medium</option><option>High</option></select>
                  </Field>
                  <Field label="Frequency">
                    <select name="frequency" className="input"><option value="">—</option><option>Rare</option><option>Weekly</option><option>Daily</option><option>Multiple times daily</option></select>
                  </Field>
                </div>
                <Field label="Current workflow"><input name="current_workflow" className="input" /></Field>
                <Field label="Existing system"><input name="existing_system" className="input" /></Field>
                <Field label="Impact"><input name="impact" className="input" /></Field>
                <Field label="Product feature that solves it"><input name="product_feature" className="input" /></Field>
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="confirmed_by_mgmt" /> Confirmed by management</label>
                <div className="sm:col-span-2"><button className={buttonClass("primary", "sm")}>Save pain point</button></div>
              </form>
            </details>
          </Card>

          <Card title="Activity timeline">
            {acts.length ? (
              <ol className="relative space-y-4 before:absolute before:top-2 before:bottom-2 before:left-3.5 before:w-px before:bg-slate-200">
                {acts.map((a) => (
                  <li key={a.id} className="group relative flex gap-3">
                    <ActivityIcon kind={a.kind} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="text-sm">
                          <span className="font-medium">{a.summary}</span>
                          {a.contact_id && contactName.get(a.contact_id) && <span className="text-slate-500"> · {contactName.get(a.contact_id)}</span>}
                        </p>
                        <span className="shrink-0 text-xs text-slate-500">{fmtDate(a.occurred_at)}</span>
                      </div>
                      {a.outcome && <p className="text-sm text-slate-600">{a.outcome}</p>}
                    </div>
                    <form action={deleteActivity.bind(null, a.id)} className="opacity-0 group-hover:opacity-100">
                      <button className="text-slate-400 hover:text-red-600" aria-label="Delete"><Trash2 className="h-3.5 w-3.5" /></button>
                    </form>
                  </li>
                ))}
              </ol>
            ) : (
              <Empty>No activity yet.</Empty>
            )}
          </Card>

          <Card title={`Stage 1 calls (${calls.length})`}>
            {calls.length ? (
              <div className="space-y-2">
                {calls.map((c) => (
                  <details key={c.id} className="rounded-md border border-slate-200" open={c.id === latest?.id && calls.length === 1}>
                    <summary className="flex cursor-pointer flex-wrap items-center gap-2 px-3 py-2 text-sm">
                      <span className="font-medium">{fmtDateTime(c.called_at)}</span>
                      <span className="text-slate-500">{c.answered ? `${c.spoke_role ?? ""}${c.spoke_with ? ` — ${c.spoke_with}` : ""}` : "No answer"}</span>
                      {c.score != null && <span className="ml-auto"><ScoreBadge score={c.score} /></span>}
                    </summary>
                    {c.answered && (
                      <div className="space-y-3 border-t border-slate-100 px-3 py-3">
                        {INQUIRY_SECTIONS.map((s) => {
                          const rows = s.questions.filter((q) => c.answers[q.key] !== undefined);
                          const note = c.answers[s.notesKey];
                          if (!rows.length && !note) return null;
                          return (
                            <div key={s.id}>
                              <div className="mb-1 text-xs font-semibold text-slate-500 uppercase">{s.title}</div>
                              <dl className="grid gap-x-6 gap-y-0.5 text-sm sm:grid-cols-2">
                                {rows.map((q) => (
                                  <div key={q.key} className="flex justify-between gap-3">
                                    <dt className="text-slate-600">{q.label}</dt>
                                    <dd className={`shrink-0 font-medium ${c.answers[q.key] === "no" ? "text-red-600" : ""}`}>
                                      {Array.isArray(c.answers[q.key]) ? (c.answers[q.key] as string[]).join(", ") : String(c.answers[q.key]).replace(/^yes$/, "Yes").replace(/^no$/, "No").replace(/^unknown$/, "?")}
                                    </dd>
                                  </div>
                                ))}
                              </dl>
                              {note && <p className="mt-1 text-sm text-slate-600 italic">{String(note)}</p>}
                            </div>
                          );
                        })}
                        {c.outside_pms && <p className="text-sm"><span className="font-medium">Outside the PMS:</span> {c.outside_pms}</p>}
                        {c.most_manual && <p className="text-sm"><span className="font-medium">Most manual:</span> {c.most_manual}</p>}
                      </div>
                    )}
                    {c.notes && <p className="border-t border-slate-100 px-3 py-2 text-sm text-slate-600">{c.notes}</p>}
                  </details>
                ))}
              </div>
            ) : (
              <Empty>No calls logged.</Empty>
            )}
          </Card>

          <Card title="Score breakdown">
            {h.score_breakdown.length ? (
              <ul className="mb-4 space-y-1 text-sm">
                {h.score_breakdown.map((b, i) => (
                  <li key={i} className="flex justify-between">
                    <span className="text-slate-700">{b.label}</span>
                    <span className={`font-medium tabular-nums ${b.points < 0 ? "text-red-600" : "text-emerald-700"}`}>{b.points > 0 ? `+${b.points}` : b.points}</span>
                  </li>
                ))}
                <li className="flex justify-between border-t border-slate-100 pt-1 font-semibold">
                  <span>Calculated (capped 0–100)</span>
                  <span className="tabular-nums">{h.opportunity_score}</span>
                </li>
              </ul>
            ) : (
              <Empty>No scoring signals yet.</Empty>
            )}
            <form action={updateScoring.bind(null, h.id)} className="grid gap-3 border-t border-slate-100 pt-4 sm:grid-cols-2">
              <Field label="Manual score override">
                <input name="score_override" type="number" min={0} max={100} defaultValue={h.score_override ?? ""} className="input" placeholder="Leave blank to use calculated" />
              </Field>
              <Field label="Classification override">
                <select name="classification_override" defaultValue={h.classification_override ?? ""} className="input">
                  <option value="">Automatic</option>
                  {CLASSIFICATIONS.map((c) => <option key={c}>{c}</option>)}
                </select>
              </Field>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="mgmt_no_pain" defaultChecked={h.mgmt_no_pain} /> Management says no meaningful pain (−20)</label>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="corporate_controlled" defaultChecked={h.corporate_controlled} /> Tech decisions controlled by corporate (−15)</label>
              <div><button className={buttonClass("secondary", "sm")}>Update scoring</button></div>
            </form>
          </Card>
        </div>

        {/* ─────────── Side column ─────────── */}
        <div className="space-y-6">
          <Card title="Next action">
            <form action={setNextAction.bind(null, h.id)} className="space-y-3">
              <input name="next_action" defaultValue={h.next_action ?? ""} className="input" placeholder="What happens next?" />
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="date"
                  name="next_action_date"
                  defaultValue={h.next_action_date ?? ""}
                  className={`input ${h.next_action_date && h.next_action_date < today ? "border-red-400 text-red-700" : ""}`}
                />
                <input name="lead_owner" defaultValue={h.lead_owner ?? ""} className="input" placeholder="Lead owner" />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">Last contacted: {fmtDate(h.last_contacted_at)}</span>
                <button className={buttonClass("primary", "sm")}>Save</button>
              </div>
            </form>
          </Card>

          {h.stage === "stage2" && (
            <Card title="Pipeline status">
              <form action={setPipelineStatus.bind(null, h.id)} className="flex gap-2">
                <select name="pipeline_status" defaultValue={h.pipeline_status ?? ""} className="input">
                  <option value="">—</option>
                  {PIPELINE_STATUSES.map((s) => <option key={s}>{s}</option>)}
                </select>
                <button className={buttonClass("secondary")}>Set</button>
              </form>
            </Card>
          )}

          <Card title="Log touchpoint">
            <form action={logActivity.bind(null, h.id)} className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <select name="kind" className="input" defaultValue={h.stage === "stage2" ? "mgmt_call" : "note"}>
                  <option value="mgmt_call">Call</option>
                  <option value="email">Email</option>
                  <option value="linkedin">LinkedIn</option>
                  <option value="note">Note</option>
                </select>
                <select name="contact_id" className="input">
                  <option value="">No contact</option>
                  {contacts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <input name="summary" className="input" placeholder="Summary (e.g. Called GM, left voicemail)" />
              <input name="outcome" className="input" placeholder="Outcome / notes" />
              <details>
                <summary className="cursor-pointer text-xs font-medium text-brand-600">Also set next action / status</summary>
                <div className="mt-2 space-y-2">
                  <input name="next_action" className="input" placeholder="Next action" />
                  <input type="date" name="next_action_date" className="input" />
                  <select name="pipeline_status" className="input" defaultValue="">
                    <option value="">Keep pipeline status (auto)</option>
                    {PIPELINE_STATUSES.map((s) => <option key={s}>{s}</option>)}
                  </select>
                </div>
              </details>
              <button className={buttonClass("primary", "sm")}>Log</button>
            </form>
          </Card>

          <Card title={`Management contacts (${contacts.length})`}>
            {h.stage !== "stage2" && contacts.length === 0 && (
              <p className="mb-3 text-xs text-slate-500">Contacts unlock the Stage 2 workflow. You can add them any time.</p>
            )}
            <ul className="mb-3 space-y-3">
              {contacts.map((c) => (
                <li key={c.id} className="rounded-md border border-slate-200 p-3 text-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-medium">{c.name}</div>
                      <div className="text-xs text-slate-500">{c.title ?? "—"}</div>
                    </div>
                    <div className="flex items-center gap-1">
                      {c.decision_maker === "yes" && <Badge tone="green">Decision maker</Badge>}
                      {c.influence && <Badge tone={c.influence === "high" ? "purple" : "gray"}>{c.influence}</Badge>}
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs">
                    {c.phone && <a className="text-brand-600" href={`tel:${c.phone}`}>{c.phone}</a>}
                    {c.email && <a className="text-brand-600" href={`mailto:${c.email}`}>{c.email}</a>}
                    {c.linkedin_url && <a className="text-brand-600" href={c.linkedin_url} target="_blank" rel="noreferrer">LinkedIn</a>}
                    {c.preferred_contact && <span className="text-slate-500">Prefers {c.preferred_contact}</span>}
                  </div>
                  {c.notes && <p className="mt-1 text-xs text-slate-600">{c.notes}</p>}
                  <form action={deleteContact.bind(null, c.id)} className="mt-1 text-right">
                    <button className="text-xs text-slate-400 hover:text-red-600">Remove</button>
                  </form>
                </li>
              ))}
            </ul>
            <details open={h.stage === "stage2" && contacts.length === 0}>
              <summary className="cursor-pointer text-sm font-medium text-brand-600">+ Add contact</summary>
              <form action={addContact.bind(null, h.id)} className="mt-3 space-y-2">
                <input name="name" required className="input" placeholder="Name *" />
                <input name="title" list="titles" className="input" placeholder={`Title (recommend: ${latest ? recommendedRole(ans, h) : "General Manager"})`} />
                <datalist id="titles">{CONTACT_TITLES.map((t) => <option key={t} value={t} />)}</datalist>
                <input name="phone" type="tel" className="input" placeholder="Phone" />
                <input name="email" type="email" className="input" placeholder="Email" />
                <input name="linkedin_url" className="input" placeholder="LinkedIn URL" />
                <div className="grid grid-cols-3 gap-2">
                  <select name="decision_maker" className="input" defaultValue="unknown" aria-label="Decision maker">
                    <option value="unknown">DM?</option><option value="yes">DM: yes</option><option value="no">DM: no</option>
                  </select>
                  <select name="influence" className="input" defaultValue="" aria-label="Influence">
                    <option value="">Influence</option><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option>
                  </select>
                  <select name="preferred_contact" className="input" defaultValue="" aria-label="Preferred contact">
                    <option value="">Prefers</option><option>Phone</option><option>Email</option><option>LinkedIn</option><option>In person</option>
                  </select>
                </div>
                <textarea name="notes" rows={2} className="input" placeholder="Notes" />
                <button className={buttonClass("primary", "sm")}>Save contact</button>
              </form>
            </details>
          </Card>

          <Card title="Demos">
            {demos.length > 0 && (
              <ul className="mb-3 space-y-2">
                {demos.map((d) => (
                  <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm">
                    <div>
                      <div className="font-medium">{fmtDateTime(d.scheduled_at)}</div>
                      <div className="text-xs text-slate-500">{d.contact_id ? contactName.get(d.contact_id) : ""}</div>
                    </div>
                    {d.status === "booked" ? (
                      <div className="flex gap-1">
                        <form action={setDemoStatus.bind(null, d.id, h.id, "completed")}><button className={buttonClass("success", "sm")}>Done</button></form>
                        <form action={setDemoStatus.bind(null, d.id, h.id, "no_show")}><button className={buttonClass("ghost", "sm")}>No-show</button></form>
                      </div>
                    ) : (
                      <Badge tone={d.status === "completed" ? "green" : "gray"}>{d.status.replace("_", " ")}</Badge>
                    )}
                  </li>
                ))}
              </ul>
            )}
            <details>
              <summary className="cursor-pointer text-sm font-medium text-brand-600">+ Book demo</summary>
              <form action={bookDemo.bind(null, h.id)} className="mt-3 space-y-2">
                <input type="datetime-local" name="scheduled_at" required className="input" />
                <select name="contact_id" className="input">
                  <option value="">Contact</option>
                  {contacts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <input name="notes" className="input" placeholder="Notes" />
                <button className={buttonClass("primary", "sm")}>Book</button>
              </form>
            </details>
            {h.stage === "stage2" && (
              <Link href={`/hotels/${h.id}/demo`} className="mt-3 block text-sm font-medium text-brand-600">Prepare demo →</Link>
            )}
          </Card>

          <Card title="Deal">
            <DealForm hotelId={h.id} deal={dealRes.data ?? null} pricing={pricing} />
            {dealRes.data && (
              <dl className="mt-3 grid grid-cols-3 gap-2 border-t border-slate-100 pt-3 text-center">
                <div><dt className="text-[11px] text-slate-500">TCV</dt><dd className="font-semibold">{money(dealRes.data.tcv)}</dd></div>
                <div><dt className="text-[11px] text-slate-500">MRR</dt><dd className="font-semibold">{money(dealRes.data.mrr)}</dd></div>
                <div><dt className="text-[11px] text-slate-500">ARR</dt><dd className="font-semibold">{money(dealRes.data.arr)}</dd></div>
              </dl>
            )}
          </Card>

          <Card title="Hotel info" action={<Link href={`/hotels/${h.id}/edit`} className="text-xs font-medium text-brand-600">Edit</Link>}>
            <dl className="space-y-1.5 text-sm">
              {h.address && <div className="flex gap-2"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />{h.address}{h.city ? `, ${h.city}` : ""}</div>}
              {h.website && <a href={h.website.startsWith("http") ? h.website : `https://${h.website}`} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-brand-600"><Globe className="h-4 w-4" />Website</a>}
              {h.maps_url && <a href={h.maps_url} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-brand-600"><ExternalLink className="h-4 w-4" />Google profile</a>}
              <Row k="Ownership" v={h.ownership_type} />
              <Row k="Management co." v={h.management_company} />
              <Row k="PMS" v={h.pms} />
              <Row k="Ops software" v={h.ops_software} />
              <Row k="24h front desk" v={h.front_desk_24h ? "Yes" : "No"} />
              <Row k="Restaurant" v={h.restaurant ? "Yes" : "No"} />
              <Row k="Meeting space" v={h.meeting_space ? "Yes" : "No"} />
              <Row k="Lead owner" v={h.lead_owner} />
            </dl>
            {h.notes && <p className="mt-3 border-t border-slate-100 pt-3 text-sm whitespace-pre-line text-slate-700">{h.notes}</p>}
          </Card>
        </div>
      </div>
    </>
  );
}

function Row({ k, v }: { k: string; v: string | null | undefined }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-slate-500">{k}</dt>
      <dd className="text-right">{v ? v.charAt(0).toUpperCase() + v.slice(1) : "—"}</dd>
    </div>
  );
}
