"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Ico from "@/components/site/Ico";
import type { StaffLink } from "./StaffShell";

/** Sidebar menu on large screens, a sideways-scrolling row on phones. */
export default function StaffNav({ links }: { links: StaffLink[] }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Sections" className="px-3 pb-3 lg:px-4 lg:pb-0">
      <ul className="flex gap-1 overflow-x-auto lg:flex-col lg:overflow-visible">
        {links.map((link) => {
          const active = link.exact ? pathname === link.href : pathname.startsWith(link.href);
          return (
            <li key={link.href} className="shrink-0">
              <Link
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={`focus-ring flex min-h-10 items-center gap-3 whitespace-nowrap rounded-lg px-3 text-[14px] font-medium transition ${
                  active
                    ? "bg-wine-soft font-semibold text-wine-deep"
                    : "text-plum-soft hover:bg-shell hover:text-plum"
                }`}
              >
                <Ico name={link.icon} className="h-[18px] w-[18px] shrink-0" />
                {link.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
