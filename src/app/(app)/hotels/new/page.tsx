import { HotelForm } from "@/components/hotel-form";
import { PageHeader } from "@/components/ui";
import { createHotel } from "../../actions";

export default function NewHotel() {
  return (
    <>
      <PageHeader title="Add hotel" />
      <HotelForm action={createHotel} cancelHref="/hotels" />
    </>
  );
}
