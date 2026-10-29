import { redirect } from "next/navigation";

/** The week plan now lives on the Appointment slots page. */
export default function SchedulePage() {
  redirect("/admin/slots");
}
