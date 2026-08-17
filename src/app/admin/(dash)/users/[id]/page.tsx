import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import BookingsTable from "@/components/admin/BookingsTable";
import DeleteUserButton from "@/components/admin/DeleteUserButton";
import { initialsOf, shortDate } from "@/lib/format";
import { formatShort } from "@/lib/availability";
import { getUserDetail } from "@/lib/repo";

export const metadata: Metadata = { title: "Patient — Admin" };
export const dynamic = "force-dynamic";

export default async function UserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const detail = await getUserDetail(id);
  if (!detail) notFound();

  const { user, bookings } = detail;
  const next = bookings.find(
    (booking) => booking.status === "confirmed" && booking.date >= new Date().toISOString().slice(0, 10),
  );

  return (
    <div>
      <Link
        href="/admin/users"
        className="focus-ring text-[14px] font-semibold text-plum-soft transition hover:text-wine"
      >
        ← All patients
      </Link>

      <div className="mt-4 flex flex-wrap items-start gap-5 rounded-2xl border border-mist bg-white p-6">
        <span className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-wine text-[20px] font-bold text-white">
          {initialsOf(user.name)}
        </span>

        <div className="min-w-[220px] flex-1">
          <h1 className="font-display text-[1.7rem] font-semibold leading-tight">{user.name}</h1>
          <p className="mt-0.5 text-plum-soft">
            <a href={`mailto:${user.email}`} className="link-underline">
              {user.email}
            </a>
          </p>
          <p className="mt-2 text-[14px] text-plum-soft">
            Registered {shortDate(user.createdAt)} · Last sign-in{" "}
            {user.lastLoginAt ? shortDate(user.lastLoginAt) : "never"}
          </p>
        </div>

        <div className="grid grid-cols-3 gap-3 text-center">
          <Stat value={user.bookingsTotal} label="Bookings" />
          <Stat value={user.bookingsUpcoming} label="Upcoming" />
          <Stat value={user.bookingsCancelled} label="Cancelled" />
        </div>

        <div className="w-full sm:w-auto">
          <DeleteUserButton id={user.id} name={user.name} bookings={user.bookingsTotal} />
        </div>
      </div>

      {next && (
        <p className="mt-4 rounded-2xl border border-sage/30 bg-sage-soft px-5 py-4 text-[15px] text-sage-ink">
          <strong className="font-semibold">Next visit:</strong> {formatShort(next.date)} at{" "}
          {next.time.toUpperCase()} — {next.reason}
        </p>
      )}

      <h2 className="mt-8 font-display text-[1.3rem] font-semibold">Their bookings</h2>
      <p className="mt-1 text-[15px] text-plum-soft">
        Cancelling here frees the slot, exactly as it does on the bookings page.
      </p>

      {bookings.length === 0 ? (
        <p className="mt-4 rounded-2xl border border-mist bg-white p-6 text-plum-soft">
          This patient hasn&apos;t booked an appointment yet.
        </p>
      ) : (
        <BookingsTable initial={bookings} />
      )}
    </div>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="rounded-xl bg-shell px-4 py-3">
      <p className="font-display text-[1.6rem] leading-none tabular-nums text-wine">{value}</p>
      <p className="mt-1 text-[12px] text-plum-soft">{label}</p>
    </div>
  );
}
