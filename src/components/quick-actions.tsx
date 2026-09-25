"use client";

import { useState } from "react";
import { Calendar, Network, Mail, NotebookPen, Phone } from "lucide-react";
import { bookDemo, logActivity } from "@/app/(app)/actions";
import { buttonClass } from "./ui";

type Mode = null | "mgmt_call" | "email" | "linkedin" | "note" | "demo";

export function QuickActions({
  hotelId,
  contactId,
  phone,
  email,
  linkedin,
}: {
  hotelId: string;
  contactId?: string | null;
  phone?: string | null;
  email?: string | null;
  linkedin?: string | null;
}) {
  const [mode, setMode] = useState<Mode>(null);
  const btn = buttonClass("secondary", "sm");
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        <a href={phone ? `tel:${phone}` : undefined} onClick={() => setMode("mgmt_call")} className={btn} aria-disabled={!phone}>
          <Phone className="h-3.5 w-3.5" /> Call
        </a>
        <a href={email ? `mailto:${email}` : undefined} onClick={() => setMode("email")} className={btn}>
          <Mail className="h-3.5 w-3.5" /> Email
        </a>
        <a href={linkedin ?? undefined} target="_blank" rel="noreferrer" onClick={() => setMode("linkedin")} className={btn}>
          <Network className="h-3.5 w-3.5" /> LinkedIn
        </a>
        <button type="button" onClick={() => setMode(mode === "note" ? null : "note")} className={btn}>
          <NotebookPen className="h-3.5 w-3.5" /> Add note
        </button>
        <button type="button" onClick={() => setMode(mode === "demo" ? null : "demo")} className={buttonClass("primary", "sm")}>
          <Calendar className="h-3.5 w-3.5" /> Book demo
        </button>
      </div>

      {mode && mode !== "demo" && (
        <form
          action={async (fd) => {
            await logActivity(hotelId, fd);
            setMode(null);
          }}
          className="flex flex-wrap items-center gap-2 rounded-md bg-slate-50 p-2"
        >
          <select name="kind" defaultValue={mode} className="input h-8 w-auto py-0 text-xs">
            <option value="mgmt_call">Call</option>
            <option value="email">Email</option>
            <option value="linkedin">LinkedIn</option>
            <option value="note">Note</option>
          </select>
          {contactId && <input type="hidden" name="contact_id" value={contactId} />}
          <input name="summary" className="input h-8 min-w-[180px] flex-1 text-xs" placeholder="What happened?" autoFocus />
          <input name="next_action" className="input h-8 w-40 text-xs" placeholder="Next action" />
          <input type="date" name="next_action_date" className="input h-8 w-36 text-xs" />
          <button className={buttonClass("primary", "sm")}>Log</button>
        </form>
      )}
      {mode === "demo" && (
        <form
          action={async (fd) => {
            await bookDemo(hotelId, fd);
            setMode(null);
          }}
          className="flex flex-wrap items-center gap-2 rounded-md bg-slate-50 p-2"
        >
          {contactId && <input type="hidden" name="contact_id" value={contactId} />}
          <input type="datetime-local" name="scheduled_at" required className="input h-8 w-auto text-xs" />
          <input name="notes" className="input h-8 min-w-[160px] flex-1 text-xs" placeholder="Notes" />
          <button className={buttonClass("primary", "sm")}>Book</button>
        </form>
      )}
    </div>
  );
}
