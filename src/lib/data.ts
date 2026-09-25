import type { SupabaseClient } from "@supabase/supabase-js";
import type { Answers } from "./constants";
import type { Hotel } from "./types";
import type { Latest } from "./insights";

export async function getHotels(supabase: SupabaseClient) {
  const { data } = await supabase.from("hotels").select("*").order("name");
  return (data ?? []) as Hotel[];
}

/** Latest answered Stage 1 answers per hotel. */
export async function getLatestAnswers(supabase: SupabaseClient): Promise<Latest> {
  const { data } = await supabase
    .from("inquiry_calls")
    .select("hotel_id, answers, called_at")
    .eq("answered", true)
    .order("called_at", { ascending: false });
  const latest: Latest = {};
  for (const c of data ?? []) if (!latest[c.hotel_id]) latest[c.hotel_id] = c.answers as Answers;
  return latest;
}
