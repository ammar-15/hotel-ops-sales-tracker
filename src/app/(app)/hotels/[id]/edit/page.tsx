import { notFound } from "next/navigation";
import { requireUser } from "@/lib/supabase/server";
import { HotelForm } from "@/components/hotel-form";
import { PageHeader } from "@/components/ui";
import { deleteHotel, updateHotel } from "../../../actions";
import type { Hotel } from "@/lib/types";
import { ConfirmButton } from "@/components/confirm-button";

export default async function EditHotel({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await requireUser();
  const { data: hotel } = await supabase.from("hotels").select("*").eq("id", id).maybeSingle<Hotel>();
  if (!hotel) notFound();
  return (
    <>
      <PageHeader
        title={`Edit ${hotel.name}`}
        actions={
          <ConfirmButton action={deleteHotel.bind(null, id)} message={`Delete ${hotel.name} and all its calls, contacts and history?`}>
            Delete hotel
          </ConfirmButton>
        }
      />
      <HotelForm hotel={hotel} action={updateHotel.bind(null, id)} cancelHref={`/hotels/${id}`} />
    </>
  );
}
