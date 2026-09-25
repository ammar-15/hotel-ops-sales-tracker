import { notFound } from "next/navigation";
import { requireUser } from "@/lib/supabase/server";
import { InquiryForm } from "@/components/inquiry-form";
import type { Hotel } from "@/lib/types";

export default async function CallPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await requireUser();
  const { data: hotel } = await supabase.from("hotels").select("*").eq("id", id).maybeSingle<Hotel>();
  if (!hotel) notFound();
  return <InquiryForm hotel={hotel} />;
}
