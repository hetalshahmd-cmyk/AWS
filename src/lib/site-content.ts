import type { PhotoKey } from "./photos";
import { locations, services, site } from "./site";

/**
 * Editable website content: the home page hero and the office cards.
 *
 * Stored in MongoDB (`settings`, _id "siteContent") and edited from
 * Admin → Site content. The values below are the starting content — they
 * seed an empty database and stand in if it can't be reached.
 *
 * Shared by the server and the browser, so no server-only imports here.
 */

/** A picture: one from the built-in library (`photo`) or an upload (`url`). */
export type ImageRef = {
  photo: PhotoKey | null;
  /** An uploaded image, served from /api/site-images/… */
  url: string | null;
  /** Empty = the library photo's own description. */
  alt: string;
  /** Focus point for the crop, "x% y%" — wide screens. */
  position: string;
};

export type HeroSlide = {
  image: ImageRef;
  /** Focus point on phones (portrait crop). */
  mobilePosition: string;
  title: string;
  body: string;
};

export type HeroContent = {
  eyebrow: string;
  title: string;
  /** The highlighted end of the headline, in italics. */
  emphasis: string;
  body: string;
  slides: HeroSlide[];
};

export type OfficeId = (typeof locations)[number]["id"];

export type Office = {
  /** Fixed: slots and bookings store it. */
  id: OfficeId;
  name: string;
  /** The short name the front desk uses (Maryvale, Arrowhead). */
  area: string;
  address: [string, string];
  maps: string;
  /** Null = the practice's main number. */
  phone: string | null;
  image: ImageRef;
};

export type SiteContent = { hero: HeroContent; offices: Office[] };

const serviceBody = (title: string) => services.find((service) => service.title === title)?.body ?? "";

const slide = (photo: PhotoKey, position: string, mobilePosition: string, title: string): HeroSlide => ({
  image: { photo, url: null, alt: "", position },
  mobilePosition,
  title,
  body: serviceBody(title),
});

const OFFICE_IMAGES: Record<OfficeId, { photo: PhotoKey; position: string }> = {
  maryvale: { photo: "phoenixAerial", position: "50% 55%" },
  arrowhead: { photo: "valleyView", position: "50% 70%" },
};

export const DEFAULT_SITE_CONTENT: SiteContent = {
  hero: {
    eyebrow: "Board-Certified OB-GYN · Phoenix & Glendale, AZ",
    title: "Women's health & pregnancy care,",
    emphasis: "the same day you call.",
    body: site.description,
    slides: [
      slide("heroConsultation", "50% 40%", "62% 50%", "Prenatal Care"),
      slide("heroUltrasound", "50% 35%", "66% 40%", "Ultrasound"),
      slide("heroPregnancy", "50% 50%", "64% 50%", "First-Trimester Care"),
    ],
  },
  offices: locations.map((office) => ({
    id: office.id,
    name: office.name,
    area: office.area,
    address: [office.address[0], office.address[1]],
    maps: office.maps,
    phone: null,
    image: { ...OFFICE_IMAGES[office.id], url: null, alt: "" },
  })),
};

/** Every office id, in display order. Fixed — offices can't be added or removed. */
export const OFFICE_IDS: OfficeId[] = locations.map((office) => office.id);

/** See lib/providers: globalThis, so every route bundle shares one copy. */
type Shared = { __awsSiteContent?: SiteContent; __awsSiteContentLoadedAt?: number };
const shared = globalThis as typeof globalThis & Shared;

export function setSiteContent(content: SiteContent): void {
  shared.__awsSiteContent = content;
}

export function siteContentLoadedAt(): number {
  return shared.__awsSiteContentLoadedAt ?? 0;
}

export function markSiteContentLoaded(at: number): void {
  shared.__awsSiteContentLoadedAt = at;
}

export function getSiteContent(): SiteContent {
  return shared.__awsSiteContent ?? DEFAULT_SITE_CONTENT;
}

export function getHero(): HeroContent {
  return getSiteContent().hero;
}

/** The offices, in order. */
export function getOffices(): Office[] {
  return getSiteContent().offices;
}

/** "(623) 846-7597" -> "tel:+16238467597" (US numbers). */
export function telHref(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return `tel:+${digits.length === 10 ? `1${digits}` : digits}`;
}

/** An office's phone, or the practice's main number. */
export function officePhone(office: Office | null | undefined): { label: string; href: string } {
  return office?.phone ? { label: office.phone, href: telHref(office.phone) } : { label: site.phone, href: site.phoneHref };
}
