"use client";

import { useState } from "react";
import { stageDecision } from "@/app/(app)/actions";
import { buttonClass } from "./ui";

export function StageDecision({ hotelId }: { hotelId: string }) {
  const [mode, setMode] = useState<null | "not_fit" | "call_again" | "research_more">(null);
  const action = stageDecision.bind(null, hotelId);
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <form action={action}>
          <input type="hidden" name="decision" value="stage2" />
          <button className={buttonClass("success", "lg")}>Move to Stage 2</button>
        </form>
        <button type="button" onClick={() => setMode("research_more")} className={buttonClass("secondary", "lg")}>Research more</button>
        <button type="button" onClick={() => setMode("call_again")} className={buttonClass("secondary", "lg")}>Call again later</button>
        <button type="button" onClick={() => setMode("not_fit")} className={buttonClass("danger", "lg")}>Not a fit</button>
      </div>
      {mode && (
        <form action={action} className="flex flex-wrap items-end gap-2 rounded-md bg-slate-50 p-3">
          <input type="hidden" name="decision" value={mode} />
          <label className="min-w-[240px] flex-1">
            <span className="label">{mode === "not_fit" ? "Reason (required)" : mode === "call_again" ? "What to ask next time" : "What to research"}</span>
            <input name="reason" required={mode === "not_fit"} className="input" autoFocus placeholder={mode === "not_fit" ? "e.g. Already on HotSOS, happy with it" : ""} />
          </label>
          {mode === "call_again" && (
            <label>
              <span className="label">When</span>
              <input type="date" name="date" className="input" />
            </label>
          )}
          <button className={buttonClass(mode === "not_fit" ? "danger" : "primary")}>Confirm</button>
          <button type="button" onClick={() => setMode(null)} className={buttonClass("ghost")}>Cancel</button>
        </form>
      )}
    </div>
  );
}
