import type { Metadata } from "next";
import MyBookings from "@/components/auth/MyBookings";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: `My bookings — ${site.name}`,
  description: "See and cancel your appointments.",
};

export default function MyBookingsPage() {
  return (
    <div className="min-h-full bg-ivory">
      <div className="mx-auto w-full max-w-3xl px-[clamp(20px,5vw,48px)] py-[clamp(2.5rem,6vw,4.5rem)]">
        <MyBookings />
      </div>
    </div>
  );
}
