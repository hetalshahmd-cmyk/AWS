"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useSession } from "@/components/auth/session-context";

export default function UserMenu() {
  const { user, loading, logout } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onEsc = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  // Placeholder keeps the header from jumping while the session loads.
  if (loading) return <span className="h-10 w-10 rounded-full bg-shell" aria-hidden="true" />;

  if (!user) {
    // Don't point `next` at an auth page — that used to send new registrations
    // straight back to /login instead of into the site.
    const returnable =
      pathname && pathname !== "/" && !/^\/(login|register|admin)(\/|$)/.test(pathname);
    const next = returnable ? `?next=${encodeURIComponent(pathname)}` : "";
    return (
      <Link
        href={`/login${next}`}
        className="focus-ring inline-flex items-center gap-1.5 rounded-full border-[1.5px] border-wine px-3.5 py-2 text-[15px] font-semibold text-wine transition hover:bg-wine hover:text-white"
      >
        <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" fill="none" stroke="currentColor" strokeWidth="1.8">
          <circle cx="12" cy="8" r="3.5" />
          <path d="M4.5 20a7.5 7.5 0 0 1 15 0" strokeLinecap="round" />
        </svg>
        Log in
      </Link>
    );
  }

  const initials = user.name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <div className="relative" ref={wrapRef}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Account menu for ${user.name}`}
        className="focus-ring flex items-center gap-2 rounded-full border-[1.5px] border-mist bg-white py-1 pl-1 pr-2.5 transition hover:border-wine"
      >
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-wine text-[13px] font-bold text-white">
          {initials || (
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
              <circle cx="12" cy="8" r="3.5" />
              <path d="M4.5 20a7.5 7.5 0 0 1 15 0" strokeLinecap="round" />
            </svg>
          )}
        </span>
        <span className="hidden max-w-[10ch] truncate text-[15px] font-semibold min-[600px]:inline">
          {user.name.split(/\s+/)[0]}
        </span>
        <svg viewBox="0 0 20 20" className="h-4 w-4 text-plum-soft" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M5 8l5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-[calc(100%+8px)] z-50 w-60 overflow-hidden rounded-xl border border-mist bg-white shadow-[0_18px_40px_-16px_rgba(92,30,45,.35)]"
        >
          <div className="border-b border-mist px-4 py-3">
            <p className="truncate font-semibold">{user.name}</p>
            <p className="truncate text-[13px] text-plum-soft">{user.email}</p>
          </div>

          <Link
            href="/my-bookings"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="focus-ring flex items-center gap-2.5 px-4 py-3 text-[15px] transition hover:bg-shell"
          >
            <svg viewBox="0 0 24 24" className="h-4.5 w-4.5 text-wine" fill="none" stroke="currentColor" strokeWidth="1.7">
              <rect x="3" y="4.5" width="18" height="17" rx="2.5" />
              <path d="M16 2.5v4M8 2.5v4M3 9.5h18" strokeLinecap="round" />
            </svg>
            My bookings
          </Link>

          <button
            type="button"
            role="menuitem"
            onClick={async () => {
              setOpen(false);
              await logout();
              router.push("/");
              router.refresh();
            }}
            className="focus-ring flex w-full items-center gap-2.5 border-t border-mist px-4 py-3 text-left text-[15px] transition hover:bg-shell"
          >
            <svg viewBox="0 0 24 24" className="h-4.5 w-4.5 text-wine" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 17l5-5-5-5M20 12H9M12 20H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h6" />
            </svg>
            Log out
          </button>
        </div>
      )}
    </div>
  );
}
