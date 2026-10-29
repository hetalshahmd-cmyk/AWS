"use client";

import { useState } from "react";
import { highlights, practice } from "@/lib/practice";
import { hoursEmpty, type OfficeHours } from "@/lib/scheduling";
import { getOffices } from "@/lib/site-content";
import { weekLines } from "./site/WeekHours";
import { useBooking } from "./booking-context";
import { useLang } from "./lang-context";
import { CalendarIcon, ClockIcon, GlobeIcon, PhoneIcon, PinIcon, ShieldIcon } from "./icons";

const TABS = ["Highlights", "Location"] as const;
type Tab = (typeof TABS)[number];

/**
 * Spanish for this panel. The English lives in lib/practice.ts; these say the
 * same things and should be checked by a Spanish speaker on staff, like the
 * rest of lib/i18n.ts.
 */
const ES = {
  tabs: { Highlights: "Información", Location: "Ubicación" } as Record<Tab, string>,
  showMore: "ver más",
  showLess: "ver menos",
  bio: [
    "Arizona Women's Specialists es una práctica de ginecología con amplia experiencia. El equipo atiende a pacientes en su oficina de Phoenix, AZ.",
    "Como parte de su formación, los médicos de Arizona Women's Specialists obtuvieron su título de medicina en la Universidad de Arizona, Tucson, e hicieron su residencia en Banner - University Medical Center, Phoenix. Están certificados por el American Board of Obstetrics and Gynecology.",
    "El equipo habla inglés y español con fluidez, lo que le permite atender a pacientes de distintos orígenes. En la consulta escuchan a cada paciente, le explican su condición y preparan un plan de tratamiento personalizado según sus necesidades, metas y preferencias.",
  ],
  highlights: [
    { title: "Citas para pacientes nuevos", body: "Hay citas disponibles para pacientes nuevos" },
    {
      title: "Seguros aceptados",
      body: "Aetna, BlueCross BlueShield, Cigna, Medicare, UnitedHealthcare",
      actionLabel: "(200+) planes más aceptados",
    },
    {
      title: "Poca espera",
      body: "Normalmente se atiende a los pacientes dentro de los 15 minutos de su hora",
    },
    { title: "Idiomas", body: "En la oficina se habla inglés, español, guyaratí e hindi" },
  ],
  directions: "Cómo llegar",
  hours: "Horario de esta semana",
  gettingHere: "Cómo llegar a la oficina",
  closed: "Cerrado",
  arrive: [
    "Estacionamiento gratuito justo enfrente de la Suite 5.",
    "Entrada en planta baja, sin escalones, con puertas automáticas.",
    "La Ruta 51 de Valley Metro para en 51st Ave y Camelback, a 4 minutos a pie.",
    "Consultorios y baños accesibles para silla de ruedas.",
  ],
};

const ICONS = {
  calendar: CalendarIcon,
  shield: ShieldIcon,
  clock: ClockIcon,
  globe: GlobeIcon,
};

export default function ProfilePanel({ hours }: { hours: OfficeHours | null }) {
  const [tab, setTab] = useState<Tab>("Highlights");
  const { lang } = useLang();
  const es = lang === "es";

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
              {es ? ES.tabs[item] : item}
            </button>
          );
        })}
      </div>

      <div role="tabpanel" aria-label={es ? ES.tabs[tab] : tab} className="pt-7">
        {tab === "Highlights" ? <Highlights /> : <Location hours={hours} />}
      </div>
    </div>
  );
}

function Highlights() {
  const { openInsurance } = useBooking();
  const [expanded, setExpanded] = useState(false);
  const es = useLang().lang === "es";
  const bio: readonly string[] = es ? ES.bio : practice.bio;

  return (
    <div>
      <div className="max-w-2xl space-y-4 text-[16px] leading-relaxed text-ink">
        {(expanded ? bio : bio.slice(0, 1)).map((paragraph, index, shown) => (
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
                  {expanded ? (es ? ES.showLess : "show less") : es ? ES.showMore : "show more"}
                </button>
              </>
            )}
          </p>
        ))}
      </div>

      <ul className="mt-7 divide-y divide-line border-t border-line">
        {highlights.map((item, index) => {
          const Icon = ICONS[item.icon];
          const text = es ? ES.highlights[index] : item;
          return (
            <li key={item.title} className="flex gap-4 py-5">
              <Icon className="mt-0.5 h-8 w-8 shrink-0 text-ink" />
              <div>
                <h3 className="text-[16px] font-semibold">{text.title}</h3>
                <p className="mt-1 max-w-md text-[15px] leading-relaxed text-ink-soft">
                  {text.body}
                </p>
                {item.action === "insurance" && (
                  <button
                    type="button"
                    onClick={openInsurance}
                    className="focus-ring mt-1.5 text-[15px] font-medium link-underline"
                  >
                    {(es ? ES.highlights[index].actionLabel : undefined) ?? item.actionLabel}
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

function Location({ hours }: { hours: OfficeHours | null }) {
  const { lang } = useLang();
  const es = lang === "es";
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
            {es ? ES.directions : "Get directions"}
          </a>
        </div>
      </div>

      <div className="mt-6 grid gap-6 sm:grid-cols-2">
        <div>
          <h3 className="text-[17px] font-semibold">{es ? ES.hours : "This week's hours"}</h3>
          {hoursEmpty(hours) || !hours ? (
            <p className="mt-3 text-[15px] text-ink-soft">
              {es
                ? `Llame al ${practice.phone} para el horario.`
                : `Call ${practice.phone} for times.`}
            </p>
          ) : (
            getOffices().map((office) => (
              <div key={office.id} className="mt-3">
                <p className="text-[14px] font-semibold">{office.name}</p>
                <dl className="mt-1 divide-y divide-line border-t border-line">
                  {weekLines(hours[office.id], lang).map((row) => (
                    <div key={row.days} className="flex justify-between py-2 text-[15px]">
                      <dt className="text-ink-soft">{row.days}</dt>
                      <dd className={row.hours ? "font-medium" : "text-muted"}>
                        {row.hours ?? (es ? ES.closed : "Closed")}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            ))
          )}
        </div>
        <div>
          <h3 className="text-[17px] font-semibold">{es ? ES.gettingHere : "Getting here"}</h3>
          <ul className="mt-3 space-y-2.5 text-[15px] leading-relaxed text-ink-soft">
            {es ? (
              ES.arrive.map((line) => <li key={line}>{line}</li>)
            ) : (
              <>
                <li>Free surface parking directly in front of Suite 5.</li>
                <li>Ground-floor, step-free entrance with automatic doors.</li>
                <li>Valley Metro Route 51 stops at 51st Ave &amp; Camelback, a 4-minute walk.</li>
                <li>Wheelchair accessible exam rooms and restrooms.</li>
              </>
            )}
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
    <svg
      viewBox="0 0 640 240"
      className="h-44 w-full sm:h-52"
      role="img"
      aria-label="Map of the office location"
    >
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
