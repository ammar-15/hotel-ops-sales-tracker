"use client";

import { useRef, useState, useTransition } from "react";
import Papa from "papaparse";
import { Upload, X } from "lucide-react";
import { importHotels, type ImportRow } from "@/app/(app)/actions";
import { Button, buttonClass } from "./ui";

const yes = (v: unknown) => /^(y|yes|true|1|x)$/i.test(String(v ?? "").trim());
const pick = (row: Record<string, string>, ...keys: string[]) => {
  for (const k of Object.keys(row)) {
    const nk = k.toLowerCase().replace(/[^a-z]/g, "");
    if (keys.includes(nk)) return row[k]?.trim() || null;
  }
  return null;
};

function toRow(r: Record<string, string>): ImportRow {
  const rooms = pick(r, "rooms", "roomcount", "numberofrooms");
  const shuttle = pick(r, "shuttle", "airportshuttle");
  const parking = pick(r, "parking");
  const airport = pick(r, "airport", "airporthotel");
  return {
    name: pick(r, "hotelname", "name", "hotel") ?? "",
    brand: pick(r, "brand"),
    address: pick(r, "address", "streetaddress"),
    city: pick(r, "city"),
    phone: pick(r, "phone", "phonenumber"),
    website: pick(r, "website", "url"),
    rooms: rooms ? Number(rooms.replace(/[^0-9]/g, "")) || null : null,
    shuttle: yes(shuttle),
    parking: yes(parking),
    airport: yes(airport),
    notes: pick(r, "notes"),
  };
}

export function ImportCsv() {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [result, setResult] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const file = useRef<HTMLInputElement>(null);

  function onFile(f: File) {
    setResult(null);
    Papa.parse<Record<string, string>>(f, {
      header: true,
      skipEmptyLines: true,
      complete: (res) => setRows(res.data.map(toRow).filter((r) => r.name)),
    });
  }

  function run() {
    start(async () => {
      const r = await importHotels(rows);
      setResult(
        r.error
          ? `Import failed: ${r.error}`
          : `Imported ${r.inserted} hotel${r.inserted === 1 ? "" : "s"}.` + (r.duplicates.length ? ` Skipped ${r.duplicates.length} duplicate(s): ${r.duplicates.slice(0, 5).join(", ")}${r.duplicates.length > 5 ? "…" : ""}` : "")
      );
      setRows([]);
      if (file.current) file.current.value = "";
    });
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={buttonClass("secondary")}>
        <Upload className="h-4 w-4" /> Import CSV
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-slate-900/40 p-4 pt-20" onClick={() => setOpen(false)}>
          <div className="w-full max-w-2xl rounded-lg bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-semibold">Import prospect list</h2>
              <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-600"><X className="h-5 w-5" /></button>
            </div>
            <p className="mb-3 text-sm text-slate-600">
              Columns: <code className="text-xs">Hotel Name, Brand, Address, City, Phone, Website, Rooms, Shuttle, Parking, Notes</code> (optional <code className="text-xs">Airport</code>).
              Yes/No columns accept yes/no, true/false, 1/0. Duplicates (same name + address) are skipped.
            </p>
            <input ref={file} type="file" accept=".csv,text/csv" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} className="mb-3 block text-sm" />
            {rows.length > 0 && (
              <>
                <div className="mb-3 max-h-64 overflow-auto rounded border border-slate-200">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-slate-50">
                      <tr>
                        {["Hotel", "Brand", "City", "Rooms", "Shuttle", "Parking"].map((h) => <th key={h} className="px-2 py-1 text-left font-medium text-slate-500">{h}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.slice(0, 100).map((r, i) => (
                        <tr key={i} className="border-t border-slate-100">
                          <td className="px-2 py-1">{r.name}</td>
                          <td className="px-2 py-1">{r.brand}</td>
                          <td className="px-2 py-1">{r.city}</td>
                          <td className="px-2 py-1">{r.rooms}</td>
                          <td className="px-2 py-1">{r.shuttle ? "Yes" : ""}</td>
                          <td className="px-2 py-1">{r.parking ? "Yes" : ""}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <Button onClick={run} disabled={pending}>{pending ? "Importing…" : `Import ${rows.length} hotels`}</Button>
              </>
            )}
            {result && <p className="mt-3 rounded bg-slate-50 px-3 py-2 text-sm text-slate-700">{result}</p>}
          </div>
        </div>
      )}
    </>
  );
}
