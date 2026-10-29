import Image from "next/image";
import Link from "next/link";
import type { IcoName } from "@/components/site/Ico";
import { site } from "@/lib/site";
import SignOutButton from "./SignOutButton";
import StaffNav from "./StaffNav";

export type StaffLink = { href: string; label: string; icon: IcoName; exact?: boolean };

/**
 * The back-office frame shared by admins and providers: a sidebar with the
 * sections and the signed-in account on large screens, a compact top bar with
 * a scrolling menu on phones.
 */
export default function StaffShell({
  links,
  home,
  badge,
  name,
  detail,
  avatar,
  children,
}: {
  links: StaffLink[];
  home: string;
  badge: string;
  name: string;
  detail: string;
  /** A photo or initials, shown beside the account name. */
  avatar: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-shell lg:grid lg:grid-cols-[256px_minmax(0,1fr)]">
      <aside className="border-b border-mist bg-white lg:border-b-0 lg:border-r">
        <div className="lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col">
          <div className="flex items-center gap-3 px-5 pb-3 pt-4 lg:px-6 lg:pb-5 lg:pt-6">
            <Link href={home} className="focus-ring inline-flex">
              <Image
                src="/logo2.png"
                alt={site.name}
                width={454}
                height={200}
                className="h-9 w-auto"
              />
            </Link>
            <span className="rounded-full bg-wine-soft px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-wine">
              {badge}
            </span>
            {/* Phones: account controls stay in the top bar. */}
            <div className="ml-auto lg:hidden">
              <SignOutButton />
            </div>
          </div>

          <StaffNav links={links} />

          <div className="mt-auto hidden border-t border-mist p-4 lg:block">
            <div className="flex items-center gap-3">
              {avatar}
              <div className="min-w-0">
                <p className="truncate text-[14px] font-semibold text-plum">{name}</p>
                <p className="truncate text-[12px] text-plum-soft">{detail}</p>
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between gap-2">
              <Link
                href="/"
                className="focus-ring text-[13px] font-medium text-plum-soft transition hover:text-wine"
              >
                View site ↗
              </Link>
              <SignOutButton />
            </div>
          </div>
        </div>
      </aside>

      <main className="min-w-0 px-5 py-7 lg:px-10 lg:py-9">
        <div className="mx-auto max-w-[1200px]">{children}</div>
      </main>
    </div>
  );
}

/** Two-letter badge for an account without a photo. */
export function Initials({ name }: { name: string }) {
  const letters = name
    .replace(/^(dr\.?\s+)/i, "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
  return (
    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-plum text-[13px] font-bold text-white">
      {letters || "A"}
    </span>
  );
}
