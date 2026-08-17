"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { UserRow } from "@/lib/repo";
import { formatShort } from "@/lib/availability";
import { initialsOf, shortDate } from "@/lib/format";
import { FIELD } from "./ui";

type Sort = "newest" | "name" | "bookings" | "upcoming";

export default function UsersTable({ initial }: { initial: UserRow[] }) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort>("newest");

  const rows = useMemo(() => {
    const term = query.trim().toLowerCase();
    const filtered = initial.filter(
      (user) =>
        !term ||
        user.name.toLowerCase().includes(term) ||
        user.email.toLowerCase().includes(term),
    );

    const sorted = [...filtered];
    switch (sort) {
      case "name":
        sorted.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case "bookings":
        sorted.sort((a, b) => b.bookingsTotal - a.bookingsTotal);
        break;
      case "upcoming":
        sorted.sort((a, b) => b.bookingsUpcoming - a.bookingsUpcoming);
        break;
      default:
        sorted.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    }
    return sorted;
  }, [initial, query, sort]);

  const withUpcoming = initial.filter((user) => user.bookingsUpcoming > 0).length;
  const neverBooked = initial.filter((user) => user.bookingsTotal === 0).length;

  return (
    <div className="mt-6">
      <div className="grid gap-3 sm:grid-cols-3">
        <Tile value={initial.length} label="Registered patients" />
        <Tile value={withUpcoming} label="With an upcoming visit" />
        <Tile value={neverBooked} label="Never booked" />
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search name or email"
          className={`${FIELD} sm:max-w-xs`}
        />
        <div className="flex flex-wrap gap-1.5">
          {(
            [
              ["newest", "Newest"],
              ["name", "Name"],
              ["bookings", "Most bookings"],
              ["upcoming", "Upcoming"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setSort(value)}
              className={`focus-ring rounded-full px-3.5 py-1.5 text-[14px] font-semibold transition ${
                sort === value
                  ? "bg-wine text-white"
                  : "border border-line-strong bg-white hover:bg-shell"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <span className="text-[14px] text-plum-soft">
          {rows.length} of {initial.length}
        </span>
      </div>

      <div className="mt-4 overflow-x-auto rounded-2xl border border-mist bg-white">
        <table className="w-full min-w-[760px] border-collapse text-left text-[14px]">
          <thead className="bg-shell text-[13px] uppercase tracking-wide text-plum-soft">
            <tr>
              <th className="px-4 py-3 font-semibold">Patient</th>
              <th className="px-4 py-3 font-semibold">Registered</th>
              <th className="px-4 py-3 font-semibold">Last sign-in</th>
              <th className="px-4 py-3 font-semibold">Bookings</th>
              <th className="px-4 py-3 font-semibold">Latest visit</th>
              <th className="px-4 py-3 font-semibold" />
            </tr>
          </thead>
          <tbody className="divide-y divide-mist">
            {rows.map((user) => (
              <tr key={user.id}>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-wine-soft text-[13px] font-bold text-wine">
                      {initialsOf(user.name)}
                    </span>
                    <div>
                      <p className="font-semibold">{user.name}</p>
                      <p className="text-[13px] text-plum-soft">{user.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-plum-soft">
                  {shortDate(user.createdAt)}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-plum-soft">
                  {user.lastLoginAt ? shortDate(user.lastLoginAt) : "—"}
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1.5">
                    <span className="rounded-full bg-shell px-2.5 py-1 text-[12px] font-semibold">
                      {user.bookingsTotal} total
                    </span>
                    {user.bookingsUpcoming > 0 && (
                      <span className="rounded-full bg-sage-soft px-2.5 py-1 text-[12px] font-semibold text-sage-ink">
                        {user.bookingsUpcoming} upcoming
                      </span>
                    )}
                    {user.bookingsCancelled > 0 && (
                      <span className="rounded-full bg-wine-soft px-2.5 py-1 text-[12px] font-semibold text-wine-deep">
                        {user.bookingsCancelled} cancelled
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-plum-soft">
                  {user.lastBookingDate ? formatShort(user.lastBookingDate) : "—"}
                </td>
                <td className="px-4 py-3 text-right">
                  <Link
                    href={`/admin/users/${user.id}`}
                    className="focus-ring inline-flex rounded-lg border border-line-strong bg-white px-3 py-2 text-[14px] font-semibold transition hover:bg-shell"
                  >
                    View
                  </Link>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-plum-soft">
                  {initial.length === 0
                    ? "No one has registered an account yet."
                    : `No patient matches “${query}”.`}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Tile({ value, label }: { value: number; label: string }) {
  return (
    <div className="rounded-2xl border border-mist bg-white p-5">
      <p className="font-display text-[2rem] leading-none tabular-nums text-wine">{value}</p>
      <p className="mt-2 text-[14px] text-plum-soft">{label}</p>
    </div>
  );
}
