"use client";

import { useState } from "react";
import { highlights, officeHours, practice } from "@/lib/practice";
import { useBooking } from "./booking-context";
import {
  CalendarIcon,
  ClockIcon,
  GlobeIcon,
  PhoneIcon,
  PinIcon,
  ShieldIcon,
} from "./icons";

const TABS = ["Highlights", "Location"] as const;
type Tab = (typeof TABS)[number];

const ICONS = {
  calendar: CalendarIcon,
  shield: ShieldIcon,
  clock: ClockIcon,
  globe: GlobeIcon,
};

export default function ProfilePanel() {
  const [tab, setTab] = useState<Tab>("Highlights");

  return (
    <div>
      <div role="tablist" aria-label="Profile sections" className="flex gap-8 border-b border-line">
        {TABS.map((item) => {
          const active = tab === item;
          return (
            <button
              key={item}
              role="tab"
              aria-selected={active}
              onClick={() => setTab(item)}
              className={`focus-ring -mb-px border-b-2 pb-2.5 text-[16px] transition ${
                active
                  ? "border-wine font-semibold text-wine"
                  : "border-transparent text-ink-soft hover:text-ink"
              }`}
            >
              {item}
            </button>
          );
        })}
      </div>

      <div role="tabpanel" aria-label={tab} className="pt-7">
        {tab === "Highlights" ? <Highlights /> : <Location />}
      </div>
    </div>
  );
}

function Highlights() {
  const { openInsurance } = useBooking();
  const [expanded, setExpanded] = useState(false);

  return (
    <div>
      <div className="max-w-2xl space-y-4 text-[16px] leading-relaxed text-ink">
        {(expanded ? practice.bio : practice.bio.slice(0, 1)).map((paragraph, index, shown) => (
          <p key={paragraph.slice(0, 24)}>
            {paragraph}
            {index === shown.length - 1 && (
              <>
                {expanded ? " " : "… "}
                <button
                  type="button"
                  onClick={() => setExpanded((prev) => !prev)}
                  className="focus-ring font-medium link-underline"
                >
                  {expanded ? "show less" : "show more"}
                </button>
              </>
            )}
          </p>
        ))}
      </div>

      <ul className="mt-7 divide-y divide-line border-t border-line">
        {highlights.map((item) => {
          const Icon = ICONS[item.icon];
          return (
            <li key={item.title} className="flex gap-4 py-5">
              <Icon className="mt-0.5 h-8 w-8 shrink-0 text-ink" />
              <div>
                <h3 className="text-[16px] font-semibold">{item.title}</h3>
                <p className="mt-1 max-w-md text-[15px] leading-relaxed text-ink-soft">
                  {item.body}
                </p>
                {item.action === "insurance" && (
                  <button
                    type="button"
                    onClick={openInsurance}
                    className="focus-ring mt-1.5 text-[15px] font-medium link-underline"
                  >
                    {item.actionLabel}
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Location() {
  const mapsHref = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    practice.mapsQuery,
  )}`;

  return (
    <div className="max-w-2xl">
      <div className="overflow-hidden rounded-xl border border-line">
        <MapArt />
        <div className="flex flex-wrap items-start justify-between gap-4 bg-white px-5 py-4">
          <div className="flex gap-3">
            <PinIcon className="mt-0.5 h-5 w-5 shrink-0 text-ink" />
            <div>
              <p className="text-[16px] font-semibold">{practice.name}</p>
              <p className="text-[15px] text-ink-soft">
                {practice.address.street}
                <br />
                {practice.address.city}, {practice.address.state} {practice.address.zip}
              </p>
            </div>
          </div>
          <a
            href={mapsHref}
            target="_blank"
            rel="noreferrer"
            className="focus-ring rounded-lg bg-wine px-4 py-2.5 text-[14px] font-semibold text-white transition hover:bg-wine-deep"
          >
            Get directions
          </a>
        </div>
      </div>

      <div className="mt-6 grid gap-6 sm:grid-cols-2">
        <div>
          <h3 className="text-[17px] font-semibold">Office hours</h3>
          <dl className="mt-3 divide-y divide-line border-t border-line">
            {officeHours.map((row) => (
              <div key={row.day} className="flex justify-between py-2.5 text-[15px]">
                <dt className="text-ink-soft">{row.day}</dt>
                <dd className={row.hours === "Closed" ? "text-muted" : "font-medium"}>
                  {row.hours}
                </dd>
              </div>
            ))}
          </dl>
        </div>
        <div>
          <h3 className="text-[17px] font-semibold">Getting here</h3>
          <ul className="mt-3 space-y-2.5 text-[15px] leading-relaxed text-ink-soft">
            <li>Free surface parking directly in front of Suite 5.</li>
            <li>Ground-floor, step-free entrance with automatic doors.</li>
            <li>Valley Metro Route 51 stops at 51st Ave &amp; Camelback, a 4-minute walk.</li>
            <li>Wheelchair accessible exam rooms and restrooms.</li>
          </ul>
          <a
            href={`tel:${practice.phone.replace(/[^\d]/g, "")}`}
            className="mt-4 inline-flex items-center gap-2 text-[15px] font-medium link-underline"
          >
            <PhoneIcon className="h-4 w-4" />
            {practice.phone}
          </a>
        </div>
      </div>
    </div>
  );
}

function MapArt() {
  return (
    <svg viewBox="0 0 640 240" className="h-44 w-full sm:h-52" role="img" aria-label="Map of the office location">
      <rect width="640" height="240" fill="#eef3ef" />
      <g stroke="#dbe4dc" strokeWidth="10">
        <path d="M0 60h640M0 170h640M120 0v240M300 0v240M470 0v240" />
      </g>
      <g stroke="#fff" strokeWidth="4">
        <path d="M0 60h640M0 170h640M120 0v240M300 0v240M470 0v240" />
      </g>
      <rect x="0" y="105" width="640" height="22" fill="#f6e7eb" />
      <rect x="0" y="105" width="640" height="22" fill="none" stroke="#e6d2d8" strokeWidth="2" />
      <g fill="#e3eae4">
        <rect x="150" y="80" width="110" height="70" rx="4" />
        <rect x="330" y="10" width="100" height="38" rx="4" />
        <rect x="500" y="185" width="90" height="45" rx="4" />
        <rect x="20" y="185" width="70" height="45" rx="4" />
      </g>
      <text x="16" y="52" fill="#8b968c" fontSize="13" fontFamily="system-ui">
        N 51st Ave
      </text>
      <text x="360" y="100" fill="#8b968c" fontSize="13" fontFamily="system-ui">
        W Camelback Rd
      </text>
      <g transform="translate(300 116)">
        <circle r="26" fill="#7c2c3e" opacity="0.08" />
        <path
          d="M0-26c-8.8 0-16 7.2-16 16 0 11.4 16 26 16 26s16-14.6 16-26c0-8.8-7.2-16-16-16z"
          fill="#7c2c3e"
        />
        <circle cy="-10" r="6" fill="#e8f1ee" />
      </g>
    </svg>
  );
}
