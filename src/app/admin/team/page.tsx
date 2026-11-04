import { redirect } from "next/navigation";

export default function TeamHome() {
  redirect("/admin/team/bookings");
}
