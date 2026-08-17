import type { Metadata } from "next";
import MyBookings from "@/components/auth/MyBookings";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: `My bookings — ${site.name}`,
  description: "See and cancel your appointments.",
};

export default function MyBookingsPage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-5 py-[clamp(2.2rem,5vw,3.6rem)]">
      <MyBookings />
    </div>
  );
}
