"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/bookings", label: "Bookings" },
  { href: "/admin/slots", label: "Appointment slots" },
  { href: "/admin/pricing", label: "Pricing" },
];

export default function AdminNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Admin sections" className="mx-auto max-w-[1180px] px-5">
      <div className="flex gap-6 overflow-x-auto">
        {LINKS.map((link) => {
          const active =
            link.href === "/admin" ? pathname === "/admin" : pathname.startsWith(link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              aria-current={active ? "page" : undefined}
              className={`focus-ring whitespace-nowrap border-b-2 pb-2.5 pt-1 text-[15px] transition ${
                active
                  ? "border-wine font-semibold text-wine"
                  : "border-transparent text-plum-soft hover:text-wine"
              }`}
            >
              {link.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
