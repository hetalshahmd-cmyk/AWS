"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LanguageToggle, useLang } from "@/components/lang-context";
import Ico, { type IcoName } from "@/components/site/Ico";
import { monthDay } from "@/lib/i18n";
import { useSession } from "./session-context";

/**
 * The patient's account card and menu: who is signed in, the panel's
 * sections, language and log out. A column beside the content on large
 * screens; a compact header with a tab bar on phones.
 */
export default function PatientSidebar({
  name,
  email,
  memberSince,
}: {
  name: string;
  email: string;
  memberSince: string;
}) {
  const { lang, tr } = useLang();
  const pathname = usePathname();
  const router = useRouter();
  const { logout } = useSession();

  const links: { href: string; label: string; icon: IcoName; exact?: boolean }[] = [
    { href: "/my-bookings", label: tr.panelOverview, icon: "pulse", exact: true },
    { href: "/my-bookings/appointments", label: tr.panelAppointments, icon: "cal" },
    { href: "/my-bookings/profile", label: tr.panelProfile, icon: "users" },
  ];
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
  const since = memberSince
    ? `${monthDay(memberSince.slice(0, 10), lang)}, ${memberSince.slice(0, 4)}`
    : "";

  async function signOut() {
    await logout();
    router.push("/");
    router.refresh();
  }

  return (
    <aside className="rounded-[20px] border border-mist bg-white p-3 lg:sticky lg:top-24 lg:p-4">
      <div className="flex items-center gap-3 px-1 py-1 lg:px-2 lg:pt-2">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-wine text-[14px] font-bold tracking-wide text-white">
          {initials || "?"}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold leading-tight text-plum">{name}</p>
          <p className="truncate text-[13px] text-plum-soft">{email}</p>
        </div>
        <button
          type="button"
          onClick={signOut}
          className="focus-ring min-h-10 shrink-0 rounded-full px-3 text-[14px] font-medium text-plum-soft transition hover:bg-ivory hover:text-wine lg:hidden"
        >
          {tr.signOut}
        </button>
      </div>
      {since && (
        <p className="mt-1 hidden px-2 text-[12px] text-stone lg:block">{tr.memberSince(since)}</p>
      )}

      <nav aria-label={tr.accountMenu} className="mt-3 lg:mt-5">
        <ul className="grid grid-cols-3 gap-1 rounded-2xl bg-ivory p-1 lg:flex lg:flex-col lg:gap-0.5 lg:bg-transparent lg:p-0">
          {links.map((link) => {
            const active = link.exact ? pathname === link.href : pathname.startsWith(link.href);
            return (
              <li key={link.href}>
                <Link
                  href={link.href}
                  aria-current={active ? "page" : undefined}
                  className={`focus-ring flex min-h-11 items-center justify-center gap-2 rounded-xl px-2 text-[14px] font-medium transition lg:justify-start lg:gap-3 lg:px-3 lg:text-[15px] ${
                    active
                      ? "bg-white font-semibold text-wine-deep shadow-[0_1px_3px_rgba(36,28,32,0.1)] lg:bg-wine-soft lg:shadow-none"
                      : "text-plum-soft hover:bg-white hover:text-plum lg:hover:bg-ivory"
                  }`}
                >
                  <Ico name={link.icon} className="hidden h-4.5 w-4.5 shrink-0 sm:block" />
                  {link.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="mt-3 flex flex-col items-start gap-1 lg:mt-5 lg:border-t lg:border-mist lg:pt-4">
        <LanguageToggle />
        <button
          type="button"
          onClick={signOut}
          className="focus-ring hidden min-h-11 w-full items-center gap-3 rounded-xl px-3 text-[15px] font-medium text-plum-soft transition hover:bg-ivory hover:text-wine lg:mt-2 lg:flex"
        >
          <Ico name="back" className="h-4.5 w-4.5 shrink-0" />
          {tr.signOut}
        </button>
      </div>
    </aside>
  );
}
