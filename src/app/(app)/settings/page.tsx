import { Download } from "lucide-react";
import { requireUser } from "@/lib/supabase/server";
import { updatePricing } from "../actions";
import type { Pricing } from "@/lib/types";
import { Card, Field, PageHeader, buttonClass } from "@/components/ui";
import { ImportCsv } from "@/components/import-csv";

export const dynamic = "force-dynamic";

const EXPORTS = [
  { type: "hotels", label: "All hotels" },
  { type: "stage1", label: "Stage 1 research (every call, every answer)" },
  { type: "pipeline", label: "Pipeline & deals" },
  { type: "contacts", label: "Contacts" },
  { type: "pain_points", label: "Pain points" },
  { type: "activities", label: "Activity timeline" },
];

export default async function Settings() {
  const { supabase, user } = await requireUser();
  const { data: org } = await supabase.from("organizations").select("*").limit(1).maybeSingle();
  const pricing = (org?.pricing ?? {}) as Pricing;

  const planFields = (key: string, title: string) => {
    const p = pricing[key] ?? { setup_fee: 0, monthly: 0, contract_months: 12, free_months: 0 };
    return (
      <fieldset className="rounded-md border border-slate-200 p-4">
        <legend className="px-1 text-sm font-semibold">{title}</legend>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Field label="Setup fee (CAD)"><input name={`${key}_setup_fee`} type="number" defaultValue={p.setup_fee} className="input" /></Field>
          <Field label="Monthly (CAD)"><input name={`${key}_monthly`} type="number" defaultValue={p.monthly} className="input" /></Field>
          <Field label="Contract months"><input name={`${key}_contract_months`} type="number" defaultValue={p.contract_months} className="input" /></Field>
          <Field label="Free months"><input name={`${key}_free_months`} type="number" defaultValue={p.free_months} className="input" /></Field>
        </div>
        <p className="mt-2 text-xs text-slate-500">
          Contract value: ${(p.setup_fee + p.monthly * Math.max(p.contract_months - p.free_months, 0)).toLocaleString()}
        </p>
      </fieldset>
    );
  };

  return (
    <>
      <PageHeader title="Settings" subtitle={`Signed in as ${user.email}`} />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Workspace & default pricing" className="lg:col-span-2">
          <form action={updatePricing} className="space-y-4">
            <Field label="Workspace name"><input name="org_name" defaultValue={org?.name} className="input max-w-sm" /></Field>
            {planFields("founding", "Founding customer")}
            {planFields("standard", "Standard future customer")}
            <button className={buttonClass()}>Save pricing</button>
          </form>
        </Card>

        <Card title="Export your data">
          <p className="mb-3 text-sm text-slate-600">CSV downloads. You own the data — export everything any time.</p>
          <ul className="space-y-2">
            {EXPORTS.map((e) => (
              <li key={e.type}>
                <a href={`/api/export?type=${e.type}`} className="flex items-center gap-2 text-sm font-medium text-brand-600 hover:underline">
                  <Download className="h-4 w-4" /> {e.label}
                </a>
              </li>
            ))}
          </ul>
        </Card>

        <Card title="Import prospects">
          <p className="mb-3 text-sm text-slate-600">
            Upload a CSV with Hotel Name, Brand, Address, City, Phone, Website, Rooms, Shuttle, Parking, Notes. Duplicates (same name + address) are skipped.
          </p>
          <ImportCsv />
        </Card>
      </div>
    </>
  );
}
