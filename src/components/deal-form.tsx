"use client";

import { useState } from "react";
import { saveDeal } from "@/app/(app)/actions";
import type { Deal, Pricing } from "@/lib/types";
import { money } from "@/lib/utils";
import { buttonClass } from "./ui";

export function DealForm({ hotelId, deal, pricing }: { hotelId: string; deal: Deal | null; pricing: Pricing }) {
  const init = deal ?? { plan: "founding", ...(pricing.founding ?? { setup_fee: 2000, monthly: 500, contract_months: 13, free_months: 1 }), discount: 0 };
  const [v, setV] = useState({
    plan: init.plan ?? "founding",
    setup_fee: Number(init.setup_fee),
    monthly: Number(init.monthly),
    contract_months: Number(init.contract_months),
    free_months: Number(init.free_months),
    discount: Number((init as Deal).discount ?? 0),
  });
  const [open, setOpen] = useState(!!deal);
  const tcv = v.setup_fee + v.monthly * Math.max(v.contract_months - v.free_months, 0) - v.discount;

  function applyPlan(plan: string) {
    const p = pricing[plan];
    setV((s) => ({ ...s, plan, ...(p ? { setup_fee: p.setup_fee, monthly: p.monthly, contract_months: p.contract_months, free_months: p.free_months } : {}) }));
  }
  const n = (k: keyof typeof v) => ({
    name: k,
    type: "number",
    step: "any",
    value: v[k] as number,
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => setV((s) => ({ ...s, [k]: Number(e.target.value) })),
    className: "input",
  });

  if (!open)
    return (
      <button type="button" onClick={() => setOpen(true)} className="text-sm font-medium text-brand-600">
        + Create deal
      </button>
    );

  return (
    <form action={saveDeal.bind(null, hotelId)} className="space-y-2">
      <select name="plan" value={v.plan} onChange={(e) => applyPlan(e.target.value)} className="input">
        {Object.entries(pricing).map(([k, p]) => <option key={k} value={k}>{p.label}</option>)}
        <option value="custom">Custom</option>
      </select>
      <div className="grid grid-cols-2 gap-2">
        <label><span className="label">Setup fee</span><input {...n("setup_fee")} /></label>
        <label><span className="label">Monthly</span><input {...n("monthly")} /></label>
        <label><span className="label">Contract months</span><input {...n("contract_months")} /></label>
        <label><span className="label">Free months</span><input {...n("free_months")} /></label>
        <label><span className="label">Discount ($)</span><input {...n("discount")} /></label>
        <label><span className="label">Proposal date</span><input type="date" name="proposal_date" defaultValue={deal?.proposal_date ?? ""} className="input" /></label>
        <label><span className="label">Contract start</span><input type="date" name="start_date" defaultValue={deal?.start_date ?? ""} className="input" /></label>
        <label><span className="label">Contract end</span><input type="date" name="end_date" defaultValue={deal?.end_date ?? ""} className="input" /></label>
      </div>
      <textarea name="notes" rows={2} defaultValue={deal?.notes ?? ""} className="input" placeholder="Deal notes" />
      <div className="flex items-center justify-between">
        <span className="text-sm text-slate-600">
          TCV <strong>{money(tcv)}</strong> · ARR <strong>{money(v.monthly * 12)}</strong>
        </span>
        <button className={buttonClass("primary", "sm")}>{deal ? "Update" : "Save deal"}</button>
      </div>
    </form>
  );
}
