import { seedProviders } from "./site";

/**
 * The practice's providers. They live in MongoDB ("providers") and are edited
 * from Admin → Doctors; the first time the collection is empty it is filled
 * from `seedProviders` in lib/site.ts.
 *
 * Most of the app reads them synchronously (a provider's name next to a
 * booking, the cards on /book), so the current list is kept here, in memory:
 *  - on the server, repo.loadProviders() refreshes it from the database;
 *  - in the browser, <ProvidersSync> (root layout) sets it from the list the
 *    server rendered with, before any page component reads it.
 * This file must stay free of server-only imports — it runs in both places.
 */
export type Provider = {
  /** What slots and bookings store. Never changes once created. */
  id: string;
  name: string;
  /** Title shown under the name, e.g. "Nurse Practitioner (OB-GYN)". */
  cred: string;
  initials: string;
  languages: string[];
  /** A built-in headshot (key into lib/photos providerPhotos), or null. */
  photo: string | null;
  /** An uploaded headshot (served from /api/provider-photos/…), or null. */
  photoUrl: string | null;
  /** Monogram colours — one of AVATAR_COLORS. */
  avatar: string;
  zocdocRating: number | null;
  zocdocReviews: number | null;
  zocdocUrl: string | null;
  /**
   * When someone last compared the rating and review count with Zocdoc
   * (YYYY-MM-DD). Zocdoc can't be read automatically — it blocks bots — so
   * the admin panel asks for a fresh look after 30 days.
   */
  zocdocCheckedAt: string | null;
  ecwUrl: string | null;
  npi: string;
  about: string[];
  education: string[];
  certifications: string[];
  focus: string[];
  /** Button text, e.g. "Book with Kylee". */
  cta: string;
  /** Hidden providers keep their bookings but leave the site and booking. */
  active: boolean;
  order: number;
};

/**
 * Monogram colours a provider can have. Listed in full so Tailwind generates
 * them (class names built at runtime would not exist in the stylesheet).
 */
export const AVATAR_COLORS = [
  "from-[#9C3E55] to-[#5C1E2D]",
  "from-[#6E9E95] to-[#4E7B73]",
  "from-[#7C2C3E] to-[#4E7B73]",
  "from-[#B0607A] to-[#7C2C3E]",
  "from-[#4E7B73] to-[#2F4F48]",
  "from-[#8A6A9E] to-[#5C3E70]",
] as const;

/** Days since the Zocdoc numbers were checked, or null if never. */
export function zocdocAgeDays(provider: Pick<Provider, "zocdocCheckedAt">, todayIso: string): number | null {
  if (!provider.zocdocCheckedAt) return null;
  const days = (Date.parse(`${todayIso}T00:00:00Z`) - Date.parse(`${provider.zocdocCheckedAt}T00:00:00Z`)) / 86_400_000;
  return Number.isFinite(days) ? Math.max(0, Math.round(days)) : null;
}

/** After this many days the admin panel asks for the Zocdoc numbers to be checked again. */
export const ZOCDOC_STALE_DAYS = 30;

export function initialsOf(name: string): string {
  return (
    name
      .replace(/^dr\.?\s+/i, "")
      .split(",")[0]
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "?"
  );
}

/** "Dr. Hetalkumar Shah, MD" → "Book with Dr. Shah"; "Kylee Tate, PA-C" → "Book with Kylee". */
export function ctaFor(name: string): string {
  const plain = name.split(",")[0].trim();
  if (/^dr\.?\s/i.test(plain)) {
    const parts = plain.split(/\s+/);
    return `Book with Dr. ${parts[parts.length - 1]}`;
  }
  return `Book with ${plain.split(/\s+/)[0]}`;
}

export const DEFAULT_PROVIDERS: Provider[] = seedProviders.map((provider, order) => ({
  id: provider.id,
  name: provider.name,
  cred: provider.cred,
  initials: provider.initials,
  languages: [...provider.languages],
  photo: provider.photo as string | null,
  photoUrl: null,
  avatar: provider.avatar,
  zocdocRating: provider.zocdocRating,
  zocdocReviews: provider.zocdocReviews,
  zocdocUrl: provider.zocdocUrl,
  // The day these numbers were read from Zocdoc for the seed list.
  zocdocCheckedAt: "2026-10-06",
  ecwUrl: provider.ecwUrl,
  npi: provider.npi,
  about: [...provider.about],
  education: [...provider.education],
  certifications: [...provider.certifications],
  focus: [...(provider.focus as readonly string[])],
  cta: provider.cta,
  active: true,
  order,
}));

/**
 * Kept on globalThis, not in a module variable: Next bundles each page and API
 * route separately, so a server process can hold several copies of this
 * module — a save made through one route must be seen by all of them.
 */
type Shared = { __awsProviders?: Provider[]; __awsProvidersLoadedAt?: number };
const shared = globalThis as typeof globalThis & Shared;

/** Replaces the in-memory list (server: from the database; browser: from the server). */
export function setProviders(list: Provider[]): void {
  if (list.length > 0) shared.__awsProviders = [...list].sort((a, b) => a.order - b.order);
}

/** When the server last read the list from the database (0 = never). */
export function providersLoadedAt(): number {
  return shared.__awsProvidersLoadedAt ?? 0;
}

export function markProvidersLoaded(at: number): void {
  shared.__awsProvidersLoadedAt = at;
}

/** Every provider, hidden ones too — for past bookings and the back office. */
export function getAllProviders(): Provider[] {
  return shared.__awsProviders ?? DEFAULT_PROVIDERS;
}

/** Providers patients can see and book — hidden ones left out. */
export function getProviders(): Provider[] {
  return getAllProviders().filter((provider) => provider.active);
}
