"use client";

import { useEffect, useRef, useState } from "react";
import { addDays, type DayAvailability, type DaySlot } from "@/lib/availability";
import { monthDay, shortDate, weekdayShort, type Lang } from "@/lib/i18n";
import {
  hoursEmpty,
  officeById,
  type OfficeHours,
  type OfficeId,
  type ProviderId,
} from "@/lib/scheduling";
import { site } from "@/lib/site";
import { getOffices } from "@/lib/site-content";
import { getProviders, type Provider } from "@/lib/providers";
import { weekLines } from "./site/WeekHours";
import PhoneLink from "./analytics/PhoneLink";
import ProviderAvatar from "./site/ProviderAvatar";
import { fetchAvailability, useBooking } from "./booking-context";
import { ChevronLeft, ChevronRight } from "./icons";
import { useLang } from "./lang-context";

const WINDOW = 14;
/** Times shown per day before "+N more". */
const PER_DAY = 4;

const LANGUAGE_ES: Record<string, string> = {
  English: "Inglés",
  Spanish: "Español",
  Hindi: "Hindi",
  Gujarati: "Guyaratí",
};


/**
 * Office tabs, then one card per provider with their own open times for the
 * next two weeks — Zocdoc-style. Picking an office shows its address and only
 * the providers (and times) at that office. The visit reason is chosen after
 * a time, from that provider's own list (see BookingFlowModal).
 */
export default function ProviderSlots({ hours }: { hours: OfficeHours | null }) {
  const { todayIso, officeId, setOfficeId, providerId, version } = useBooking();
  // A "Book again with …" link puts that provider first; later clicks don't reorder.
  const [order] = useState(() =>
    [...getProviders()].sort((a, b) => Number(b.id === providerId) - Number(a.id === providerId)),
  );
  const { tr } = useLang();
  const [days, setDays] = useState<DayAvailability[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    // One request for everyone; each card picks out its own times.
    fetchAvailability(todayIso, WINDOW, { officeId, providerId: "any" })
      .then((result) => {
        if (cancelled) return;
        setDays(result);
        setError("");
      })
      .catch(() => {
        if (!cancelled) {
          setDays([]);
          setError(tr.availabilityError);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [todayIso, officeId, version, tr.availabilityError]);

  const timesFor = (id: string) =>
    days
      ? days.map((day) => ({ ...day, slots: day.slots.filter((slot) => slot.providerId === id) }))
      : null;
  const shown =
    officeId === "any" || days === null
      ? order
      : order.filter((provider) =>
          (timesFor(provider.id) ?? []).some((day) => day.slots.length > 0),
        );

  return (
    <section aria-labelledby="providers-title" className="mt-12">
      <h2 id="providers-title" className="text-[26px] font-bold leading-tight tracking-tight">
        {tr.providersTitle}
      </h2>
      <p className="mt-1 text-[15px] text-ink-soft">{tr.providersSub}</p>

      <OfficeTabs
        value={officeId}
        onChange={(next) => {
          setOfficeId(next);
          // Each office has its own shareable address, e.g. /book?office=arrowhead.
          const url = new URL(window.location.href);
          if (next === "any") url.searchParams.delete("office");
          else url.searchParams.set("office", next);
          window.history.replaceState(null, "", url);
        }}
      />
      {officeId !== "any" && <OfficeInfo officeId={officeId} hours={hours} />}

      {error && <p className="mt-3 text-[14px] text-muted">{error}</p>}

      <div className="mt-5 space-y-4">
        {officeId !== "any" && days !== null && shown.length === 0 && (
          <p className="rounded-card border border-line-strong bg-white p-5 text-[15px] text-ink-soft">
            {tr.noOpeningsOffice}
          </p>
        )}
        {shown.map((provider) => (
          <ProviderCard key={provider.id} provider={provider} days={timesFor(provider.id)} />
        ))}
        {officeId !== "any" && shown.length > 0 && shown.length < order.length && (
          <p className="text-[14px] text-muted">{tr.othersElsewhere}</p>
        )}
      </div>
    </section>
  );
}

/** Zocdoc-style location switch. */
function OfficeTabs({
  value,
  onChange,
}: {
  value: OfficeId | "any";
  onChange: (next: OfficeId | "any") => void;
}) {
  const { tr } = useLang();
  const options: { id: OfficeId | "any"; title: string; sub: string }[] = [
    { id: "any", title: tr.bothOffices, sub: getOffices().map((office) => office.area).join(" · ") },
    ...getOffices().map((office) => ({ id: office.id, title: office.name, sub: office.area })),
  ];
  return (
    <div role="radiogroup" aria-label={tr.chooseOffice} className="mt-5 flex flex-wrap gap-2">
      {options.map((option) => {
        const active = value === option.id;
        return (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(option.id)}
            className={`focus-ring min-w-40 rounded-xl border px-4 py-2.5 text-left transition ${
              active
                ? "border-ink bg-cream-deep"
                : "border-line-strong bg-white hover:border-ink/40"
            }`}
          >
            <span className="block text-[15px] font-semibold">{option.title}</span>
            <span className="block text-[13px] text-ink-soft">{option.sub}</span>
          </button>
        );
      })}
    </div>
  );
}

/** Address, hours, directions and phone for the chosen office. */
function OfficeInfo({ officeId, hours }: { officeId: OfficeId; hours: OfficeHours | null }) {
  const { lang, tr } = useLang();
  const office = officeById(officeId);
  if (!office) return null;
  const BUTTON =
    "focus-ring inline-flex min-h-11 items-center rounded-lg border border-line-strong px-4 text-[15px] font-medium transition hover:border-ink/40";
  return (
    <div className="mt-4 grid gap-4 rounded-card border border-line-strong bg-white p-5 sm:grid-cols-[1fr_auto] sm:items-center">
      <div className="text-[15px]">
        <p className="font-semibold">
          {office.name} <span className="font-normal text-ink-soft">· {office.area}</span>
        </p>
        <p className="mt-0.5 text-ink-soft">{office.address.join(", ")}</p>
        <p className="mt-1 text-[14px] text-ink-soft">
          {tr.hoursLabel}:{" "}
          {hoursEmpty(hours) || !hours
            ? tr.callForHours(site.phone)
            : weekLines(hours[officeId], lang)
                .map((line) => `${line.days} ${line.hours ?? tr.closed}`)
                .join(" · ")}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <a href={office.maps} target="_blank" rel="noreferrer" className={BUTTON}>
          {tr.directions}
        </a>
        <PhoneLink href={site.phoneHref} className={BUTTON}>
          {site.phone}
        </PhoneLink>
      </div>
    </div>
  );
}

function ProviderCard({ provider, days }: { provider: Provider; days: DayAvailability[] | null }) {
  const { openBooking, setProviderId, todayIso } = useBooking();
  const { lang, tr } = useLang();
  const strip = useRef<HTMLDivElement>(null);

  const openDays = (days ?? []).filter((day) => day.slots.length > 0);
  const total = openDays.reduce((sum, day) => sum + day.slots.length, 0);
  const firstOpen = openDays[0];
  const offices = [
    ...new Set(openDays.flatMap((day) => day.slots.map((slot) => slot.officeId)).filter(Boolean)),
  ]
    .map((id) => officeById(id)?.name)
    .filter(Boolean);
  const languages = provider.languages
    .map((name) => (lang === "es" ? (LANGUAGE_ES[name] ?? name) : name))
    .join(", ");

  // Choosing on a card focuses the whole page on that provider.
  function book(iso: string, slot: DaySlot) {
    setProviderId(provider.id as ProviderId);
    openBooking(iso, { iso, slot });
  }
  function openDay(iso: string | null) {
    setProviderId(provider.id as ProviderId);
    openBooking(iso);
  }
  const scroll = (direction: 1 | -1) =>
    strip.current?.scrollBy({ left: direction * 3 * 112, behavior: "smooth" });

  return (
    <article className="rounded-card border border-line-strong bg-white p-5 shadow-[0_2px_0_rgba(18,16,12,0.04)] sm:p-6">
      <div className="grid gap-5 lg:grid-cols-[260px_minmax(0,1fr)] lg:gap-7">
        {/* ---------------------------------------------------- profile -- */}
        <div className="flex gap-4 lg:flex-col">
          <ProviderAvatar provider={provider} size="md" />
          <div className="min-w-0">
            <h3 className="text-[19px] font-bold leading-tight tracking-tight">{provider.name}</h3>
            <p className="mt-0.5 text-[15px] text-ink-soft">{provider.cred}</p>
            {provider.zocdocReviews ? (
              <a
                href={provider.zocdocUrl ?? undefined}
                target="_blank"
                rel="noreferrer"
                className="focus-ring mt-1 inline-flex items-center gap-1 rounded text-[14px] text-ink-soft hover:underline"
              >
                <span aria-hidden="true" className="text-[#E0607E]">
                  ★
                </span>
                {provider.zocdocRating !== null && (
                  <span className="font-semibold text-ink">
                    {provider.zocdocRating.toFixed(2)} ·
                  </span>
                )}
                {tr.zocdocReviews(provider.zocdocReviews)}
              </a>
            ) : null}
            <p className="mt-1.5 text-[14px] text-ink-soft">
              {tr.speaks} {languages}
            </p>
            {offices.length > 0 && (
              <p className="mt-0.5 text-[14px] text-ink-soft">{offices.join(" · ")}</p>
            )}
            <a
              href={`/about#provider-${provider.id}`}
              className="focus-ring mt-2 inline-block text-[14px] font-medium link-underline"
            >
              {tr.viewProfile}
            </a>
          </div>
        </div>

        {/* ----------------------------------------------- availability -- */}
        <div className="min-w-0">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[15px] font-semibold">
              {days === null
                ? tr.loadingAvailability
                : firstOpen
                  ? tr.nextAvailable(
                      `${shortDate(firstOpen.iso, lang)} · ${firstOpen.slots[0].time.toUpperCase()}`,
                    )
                  : tr.noOpenings}
            </p>
            <div className="hidden items-center gap-1 sm:flex">
              <StripButton label={tr.earlierDays} onClick={() => scroll(-1)}>
                <ChevronLeft className="h-5 w-5" />
              </StripButton>
              <StripButton label={tr.laterDays} onClick={() => scroll(1)}>
                <ChevronRight className="h-5 w-5" />
              </StripButton>
            </div>
          </div>

          <div
            ref={strip}
            role="group"
            aria-label={tr.timesFor(provider.name)}
            className="mt-3 flex snap-x gap-2 overflow-x-auto pb-2"
          >
            {(days ?? placeholder(todayIso)).map((day) => (
              <DayColumn
                key={day.iso}
                day={day}
                lang={lang}
                loading={days === null}
                onTime={(slot) => book(day.iso, slot)}
                onMore={() => openDay(day.iso)}
              />
            ))}
          </div>

          {total > 0 && (
            <button
              type="button"
              onClick={() => openDay(firstOpen?.iso ?? null)}
              className="focus-ring mt-2 text-[15px] font-medium link-underline"
            >
              {tr.viewAllAvailability}
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

function DayColumn({
  day,
  lang,
  loading,
  onTime,
  onMore,
}: {
  day: DayAvailability;
  lang: Lang;
  loading: boolean;
  onTime: (slot: DaySlot) => void;
  onMore: () => void;
}) {
  const { tr } = useLang();
  const shown = day.slots.slice(0, PER_DAY);
  const extra = day.slots.length - shown.length;
  const officeNames = [
    ...new Set(day.slots.map((slot) => officeById(slot.officeId)?.area).filter(Boolean)),
  ];

  return (
    <div className="w-26 shrink-0 snap-start">
      <p className="text-center text-[13px] font-semibold leading-tight">
        {weekdayShort(day.iso, lang)}
      </p>
      <p className="text-center text-[13px] leading-tight text-ink-soft">
        {monthDay(day.iso, lang)}
      </p>
      <p className="mt-0.5 h-4 truncate text-center text-[11px] text-muted">
        {officeNames.join(" · ")}
      </p>
      <div className="mt-1.5 space-y-1.5">
        {loading ? (
          <span className="block h-9 animate-pulse rounded-md bg-cream-deep" />
        ) : shown.length === 0 ? (
          <span className="block rounded-md bg-cream-deep py-2 text-center text-[13px] text-muted">
            —
          </span>
        ) : (
          <>
            {shown.map((slot) => (
              <button
                key={slot.id}
                type="button"
                onClick={() => onTime(slot)}
                aria-label={`${weekdayShort(day.iso, lang)} ${monthDay(day.iso, lang)}, ${slot.time}${
                  officeById(slot.officeId) ? `, ${officeById(slot.officeId)?.name}` : ""
                }`}
                className="focus-ring block w-full rounded-md bg-gold py-2 text-center text-[14px] font-semibold text-teal transition hover:bg-gold-deep"
              >
                {slot.time.toUpperCase()}
              </button>
            ))}
            {extra > 0 && (
              <button
                type="button"
                onClick={onMore}
                className="focus-ring block w-full rounded-md border border-line-strong py-2 text-center text-[13px] font-medium transition hover:bg-cream"
              >
                {tr.moreTimes(extra)}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function StripButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="focus-ring flex h-9 w-9 items-center justify-center rounded-md text-ink transition hover:bg-cream-deep"
    >
      {children}
    </button>
  );
}

function placeholder(startIso: string): DayAvailability[] {
  return Array.from({ length: WINDOW }, (_, index) => ({
    iso: addDays(startIso, index),
    weekday: "",
    monthDay: "",
    slots: [],
  }));
}
