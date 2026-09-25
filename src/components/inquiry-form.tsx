"use client";

import { useMemo, useState, useTransition } from "react";
import { Phone } from "lucide-react";
import { INQUIRY_SECTIONS, type Answers, type Question } from "@/lib/constants";
import { classify, scoreHotel } from "@/lib/scoring";
import type { Hotel } from "@/lib/types";
import { saveInquiryCall } from "@/app/(app)/actions";
import { cn } from "@/lib/utils";
import { Badge, Button } from "./ui";

function localNow() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

function Chip({ on, onClick, children, tone = "brand" }: { on: boolean; onClick: () => void; children: React.ReactNode; tone?: "brand" | "green" | "red" | "gray" }) {
  const onCls = {
    brand: "border-brand-500 bg-brand-600 text-white",
    green: "border-emerald-600 bg-emerald-600 text-white",
    red: "border-red-600 bg-red-600 text-white",
    gray: "border-slate-500 bg-slate-500 text-white",
  }[tone];
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-md border px-3 py-1.5 text-sm font-medium transition-colors select-none",
        on ? onCls : "border-slate-300 bg-white text-slate-700 hover:border-slate-400 hover:bg-slate-50"
      )}
    >
      {children}
    </button>
  );
}

function QuestionRow({ q, value, set }: { q: Question; value: Answers[string]; set: (v: Answers[string]) => void }) {
  const toggle = (v: string) => set(value === v ? undefined : v);
  return (
    <div className="grid gap-2 py-2.5 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] md:items-center">
      <div className="text-sm text-slate-800">{q.label}</div>
      <div className="flex flex-wrap gap-1.5">
        {q.type === "yn" && (
          <>
            <Chip on={value === "yes"} onClick={() => toggle("yes")} tone="green">Yes</Chip>
            <Chip on={value === "no"} onClick={() => toggle("no")} tone="red">No</Chip>
            <Chip on={value === "unknown"} onClick={() => toggle("unknown")} tone="gray">?</Chip>
          </>
        )}
        {q.type === "choice" && q.options!.map((o) => <Chip key={o} on={value === o} onClick={() => toggle(o)}>{o}</Chip>)}
        {q.type === "multi" &&
          q.options!.map((o) => {
            const arr = Array.isArray(value) ? value : [];
            const on = arr.includes(o);
            return (
              <Chip key={o} on={on} onClick={() => set(on ? arr.filter((x) => x !== o) : [...arr, o])}>
                {o}
              </Chip>
            );
          })}
      </div>
    </div>
  );
}

export function InquiryForm({ hotel }: { hotel: Hotel }) {
  const [answered, setAnswered] = useState(true);
  const [calledAt, setCalledAt] = useState(localNow);
  const [spokeWith, setSpokeWith] = useState("");
  const [role, setRole] = useState<string>("Front desk");
  const [hasShuttle, setHasShuttle] = useState(hotel.shuttle);
  const [answers, setAnswers] = useState<Answers>({});
  const [outside, setOutside] = useState("");
  const [mostManual, setMostManual] = useState("");
  const [notes, setNotes] = useState("");
  const [openNotes, setOpenNotes] = useState<Record<string, boolean>>({});
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const set = (k: string) => (v: Answers[string]) => setAnswers((a) => ({ ...a, [k]: v }));
  const { score, breakdown } = useMemo(() => scoreHotel({ ...hotel, shuttle: hasShuttle }, answers), [hotel, hasShuttle, answers]);
  const cls = classify(score);
  const answeredCount = Object.values(answers).filter((v) => v !== undefined && !(Array.isArray(v) && !v.length)).length;

  function submit() {
    setError(null);
    const clean: Answers = {};
    for (const [k, v] of Object.entries(answers)) {
      if (v === undefined || (Array.isArray(v) && !v.length) || v === "") continue;
      if (!hasShuttle && k.startsWith("sh_")) continue;
      clean[k] = v;
    }
    start(async () => {
      try {
        await saveInquiryCall(hotel.id, {
          called_at: new Date(calledAt).toISOString(),
          spoke_with: spokeWith || null,
          spoke_role: role,
          answered,
          answers: answered ? clean : {},
          outside_pms: outside || null,
          most_manual: mostManual || null,
          notes: notes || null,
          hotel_shuttle: hasShuttle,
        });
      } catch (e) {
        if (e && typeof e === "object" && "digest" in e && String((e as { digest: string }).digest).startsWith("NEXT_REDIRECT")) throw e;
        setError(e instanceof Error ? e.message : "Could not save");
      }
    });
  }

  return (
    <div className="pb-28">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-xs font-medium tracking-wide text-slate-500 uppercase">Stage 1 · Operations inquiry</div>
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{hotel.name}</h1>
          <p className="text-sm text-slate-500">
            {[hotel.rooms && `${hotel.rooms} rooms`, hotel.airport && "Airport", hotel.brand, hotel.city].filter(Boolean).join(" · ")}
          </p>
        </div>
        {hotel.phone && (
          <a href={`tel:${hotel.phone}`} className="inline-flex h-11 items-center gap-2 rounded-md bg-emerald-600 px-5 text-base font-medium text-white shadow-sm hover:bg-emerald-700">
            <Phone className="h-5 w-5" /> {hotel.phone}
          </a>
        )}
      </div>

      <section className="mb-4 rounded-lg border border-slate-200 bg-white p-4 shadow-xs">
        <div className="grid gap-4 md:grid-cols-4">
          <div>
            <span className="label">Call answered?</span>
            <div className="flex gap-1.5">
              <Chip on={answered} onClick={() => setAnswered(true)} tone="green">Yes</Chip>
              <Chip on={!answered} onClick={() => setAnswered(false)} tone="red">No answer</Chip>
            </div>
          </div>
          <div>
            <span className="label">Spoke with</span>
            <div className="flex flex-wrap gap-1.5">
              {["Front desk", "Night audit", "Manager", "Other"].map((r) => (
                <Chip key={r} on={role === r} onClick={() => setRole(r)}>{r}</Chip>
              ))}
            </div>
          </div>
          <label>
            <span className="label">Name / department (optional)</span>
            <input className="input" value={spokeWith} onChange={(e) => setSpokeWith(e.target.value)} placeholder="e.g. Priya, night auditor" />
          </label>
          <label>
            <span className="label">Date / time</span>
            <input type="datetime-local" className="input" value={calledAt} onChange={(e) => setCalledAt(e.target.value)} />
          </label>
        </div>
      </section>

      {answered && (
        <>
          <section className="mb-4 rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-xs">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-sm text-slate-700">Hotel runs an airport shuttle?</span>
              <Chip on={hasShuttle} onClick={() => setHasShuttle(true)} tone="green">Yes</Chip>
              <Chip on={!hasShuttle} onClick={() => setHasShuttle(false)} tone="red">No</Chip>
            </div>
          </section>

          <div className="space-y-4">
            {INQUIRY_SECTIONS.filter((s) => s.onlyIf !== "shuttle" || hasShuttle).map((s) => (
              <section key={s.id} className="rounded-lg border border-slate-200 bg-white shadow-xs">
                <header className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5">
                  <h2 className="text-sm font-semibold text-slate-800">{s.title}</h2>
                  <button type="button" onClick={() => setOpenNotes((o) => ({ ...o, [s.id]: !o[s.id] }))} className="text-xs font-medium text-brand-600">
                    {openNotes[s.id] || answers[s.notesKey] ? "Notes" : "+ Notes"}
                  </button>
                </header>
                <div className="divide-y divide-slate-100 px-4">
                  {s.questions.map((q) => (
                    <QuestionRow key={q.key} q={q} value={answers[q.key]} set={set(q.key)} />
                  ))}
                </div>
                {(openNotes[s.id] || answers[s.notesKey]) && (
                  <div className="px-4 pb-3">
                    <textarea
                      rows={2}
                      className="input"
                      placeholder="Optional notes"
                      value={(answers[s.notesKey] as string) ?? ""}
                      onChange={(e) => set(s.notesKey)(e.target.value || undefined)}
                    />
                  </div>
                )}
              </section>
            ))}

            <section className="rounded-lg border-2 border-brand-100 bg-white p-4 shadow-xs">
              <label className="block">
                <span className="mb-1 block text-sm font-semibold text-slate-800">What operational work still happens outside the PMS?</span>
                <textarea rows={2} className="input" value={outside} onChange={(e) => setOutside(e.target.value)} />
              </label>
              <label className="mt-3 block">
                <span className="mb-1 block text-sm font-semibold text-slate-800">What appears to be the most manual or annoying workflow here?</span>
                <textarea rows={2} className="input" value={mostManual} onChange={(e) => setMostManual(e.target.value)} />
              </label>
            </section>
          </div>
        </>
      )}

      <section className="mt-4 rounded-lg border border-slate-200 bg-white p-4 shadow-xs">
        <label className="block">
          <span className="label">Call notes</span>
          <textarea rows={2} className="input" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </label>
      </section>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 backdrop-blur lg:left-60">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-3 sm:px-6">
          {answered ? (
            <div className="flex items-center gap-2" title={breakdown.map((b) => `${b.points > 0 ? "+" : ""}${b.points} ${b.label}`).join("\n")}>
              <span className="text-2xl font-semibold tabular-nums">{score}</span>
              <Badge tone={cls.tone}>{cls.label}</Badge>
              <span className="hidden text-xs text-slate-500 sm:inline">{answeredCount} answers</span>
            </div>
          ) : (
            <span className="text-sm text-slate-500">Logs a no-answer attempt and schedules a call-back for tomorrow.</span>
          )}
          {error && <span className="text-sm text-red-600">{error}</span>}
          <Button size="lg" className="ml-auto" onClick={submit} disabled={pending}>
            {pending ? "Saving…" : answered ? "Save call" : "Log no answer"}
          </Button>
        </div>
      </div>
    </div>
  );
}
