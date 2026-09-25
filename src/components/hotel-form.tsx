import { HOTEL_TAGS } from "@/lib/constants";
import type { Hotel } from "@/lib/types";
import { Card, Field, buttonClass } from "./ui";
import Link from "next/link";

const TOGGLES: [keyof Hotel, string][] = [
  ["airport", "Airport hotel"],
  ["shuttle", "Airport shuttle"],
  ["shuttle_24h", "24-hour shuttle"],
  ["long_term_parking", "Long-term parking"],
  ["short_term_parking", "Short-term parking"],
  ["restaurant", "Restaurant"],
  ["meeting_space", "Meeting / event space"],
  ["front_desk_24h", "24-hour front desk"],
];

export function HotelForm({ hotel, action, cancelHref }: { hotel?: Hotel; action: (fd: FormData) => Promise<void>; cancelHref: string }) {
  const h = hotel;
  return (
    <form action={action} className="space-y-6">
      <Card title="Basics">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Hotel name *" className="sm:col-span-2 lg:col-span-1">
            <input name="name" required defaultValue={h?.name} className="input" autoFocus={!h} />
          </Field>
          <Field label="Brand"><input name="brand" defaultValue={h?.brand ?? ""} className="input" placeholder="e.g. Best Western Plus" /></Field>
          <Field label="Management company"><input name="management_company" defaultValue={h?.management_company ?? ""} className="input" /></Field>
          <Field label="Ownership">
            <select name="ownership_type" defaultValue={h?.ownership_type ?? ""} className="input">
              <option value="">Unknown</option>
              <option value="independent">Independent</option>
              <option value="franchise">Franchise</option>
              <option value="corporate">Corporate</option>
            </select>
          </Field>
          <Field label="Rooms"><input name="rooms" type="number" min={0} defaultValue={h?.rooms ?? ""} className="input" /></Field>
          <Field label="Phone"><input name="phone" type="tel" defaultValue={h?.phone ?? ""} className="input" /></Field>
          <Field label="Address" className="sm:col-span-2"><input name="address" defaultValue={h?.address ?? ""} className="input" /></Field>
          <Field label="City"><input name="city" defaultValue={h?.city ?? ""} className="input" /></Field>
          <Field label="Website"><input name="website" defaultValue={h?.website ?? ""} className="input" placeholder="https://" /></Field>
          <Field label="Google Maps / profile URL"><input name="maps_url" defaultValue={h?.maps_url ?? ""} className="input" /></Field>
          <Field label="Lead owner"><input name="lead_owner" defaultValue={h?.lead_owner ?? ""} className="input" /></Field>
        </div>
      </Card>

      <Card title="Operations profile">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {TOGGLES.map(([k, label]) => (
            <label key={k} className="flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm has-[:checked]:border-brand-500 has-[:checked]:bg-brand-50">
              <input type="checkbox" name={k} defaultChecked={h ? Boolean(h[k]) : k === "front_desk_24h"} className="h-4 w-4" />
              {label}
            </label>
          ))}
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="PMS (if known)"><input name="pms" defaultValue={h?.pms ?? ""} className="input" placeholder="Opera, Choice Advantage, …" /></Field>
          <Field label="Existing ops software (if known)"><input name="ops_software" defaultValue={h?.ops_software ?? ""} className="input" placeholder="Quore, HotSOS, hotelkit, …" /></Field>
        </div>
        <div className="mt-4">
          <span className="label">Tags</span>
          <div className="flex flex-wrap gap-2">
            {HOTEL_TAGS.map((t) => (
              <label key={t} className="flex cursor-pointer items-center gap-1.5 rounded-full border border-slate-200 px-3 py-1 text-sm has-[:checked]:border-brand-500 has-[:checked]:bg-brand-50 has-[:checked]:text-brand-700">
                <input type="checkbox" name="tags" value={t} defaultChecked={h?.tags.includes(t)} className="sr-only" />
                {t}
              </label>
            ))}
          </div>
        </div>
        <Field label="Notes" className="mt-4">
          <textarea name="notes" rows={3} defaultValue={h?.notes ?? ""} className="input" />
        </Field>
      </Card>

      <div className="flex gap-2">
        <button className={buttonClass()}>{h ? "Save changes" : "Create hotel"}</button>
        <Link href={cancelHref} className={buttonClass("ghost")}>Cancel</Link>
      </div>
    </form>
  );
}
