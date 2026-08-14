"use client";

import { useEffect, useMemo, useState } from "react";
import { carriers, plansFor, type Carrier } from "@/lib/practice";
import { useBooking } from "./booking-context";
import { CheckIcon, ChevronLeft, CloseIcon, SearchIcon } from "./icons";

export default function InsuranceModal({ onClose }: { onClose: () => void }) {
  const { insurance, setInsurance } = useBooking();
  const [query, setQuery] = useState("");
  const [carrier, setCarrier] = useState<Carrier | null>(null);

  useEffect(() => {
    const onEsc = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onEsc);
    return () => document.removeEventListener("keydown", onEsc);
  }, [onClose]);

  const term = query.trim().toLowerCase();
  const matches = useMemo(
    () => carriers.filter((item) => item.name.toLowerCase().includes(term)),
    [term],
  );
  const popular = matches.filter((item) => item.popular);

  // Group the full list by first character, digits under "#" — like the real list.
  const groups = useMemo(() => {
    const map = new Map<string, Carrier[]>();
    for (const item of matches) {
      const first = item.name[0].toUpperCase();
      const key = /[A-Z]/.test(first) ? first : "#";
      map.set(key, [...(map.get(key) ?? []), item]);
    }
    return [...map.entries()].sort(([a], [b]) =>
      a === "#" ? -1 : b === "#" ? 1 : a.localeCompare(b),
    );
  }, [matches]);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-ink/50 p-0 sm:items-center sm:p-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={carrier ? `Select ${carrier.name} plan` : "Select insurance"}
        className="flex max-h-[92vh] w-full max-w-xl flex-col rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl"
      >
        <div className="flex items-start justify-between gap-4 px-6 pb-2 pt-6">
          {carrier ? (
            <button
              type="button"
              onClick={() => setCarrier(null)}
              className="focus-ring flex items-center gap-1.5 text-[15px] font-semibold"
            >
              <ChevronLeft className="h-4 w-4" />
              All insurance
            </button>
          ) : (
            <h2 className="text-[24px] font-bold tracking-tight">Select insurance</h2>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="focus-ring -mr-1 -mt-1 rounded-full p-1.5 text-ink transition hover:bg-cream-deep"
          >
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>

        {carrier ? (
          <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6">
            <div className="flex items-center gap-3 py-2">
              <CarrierLogo carrier={carrier} />
              <h3 className="text-[19px] font-bold tracking-tight">{carrier.name}</h3>
            </div>
            <p className="mb-2 mt-3 text-[15px] font-semibold">Select your plan</p>
            <ul className="divide-y divide-line border-y border-line">
              {plansFor(carrier.name).map((plan) => {
                const selected = insurance?.carrier === carrier.name && insurance.plan === plan;
                return (
                  <li key={plan}>
                    <button
                      type="button"
                      onClick={() => {
                        setInsurance({ carrier: carrier.name, plan });
                        onClose();
                      }}
                      className="focus-ring flex w-full items-center justify-between gap-4 px-1 py-3.5 text-left text-[16px] hover:bg-cream"
                    >
                      {plan}
                      {selected && <CheckIcon className="h-5 w-5 text-teal" />}
                    </button>
                  </li>
                );
              })}
            </ul>
            <p className="mt-4 text-[13px] text-muted">
              Not sure which plan you have? It is printed on the front of your insurance card.
            </p>
          </div>
        ) : (
          <>
            <div className="px-6 pb-3">
              <div className="relative">
                <SearchIcon className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-ink" />
                <input
                  autoFocus
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search for insurance"
                  aria-label="Search for insurance"
                  className="focus-ring w-full rounded-full border border-line-strong bg-white py-3 pl-12 pr-4 text-[16px] placeholder:text-muted"
                />
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-4">
              {matches.length === 0 && (
                <p className="py-8 text-center text-[15px] text-muted">
                  No carrier matches “{query}”.
                </p>
              )}

              {popular.length > 0 && (
                <>
                  <h3 className="pb-2 pt-1 text-[19px] font-bold tracking-tight">
                    Popular carriers
                  </h3>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {popular.map((item) => (
                      <CarrierTile
                        key={item.name}
                        carrier={item}
                        selected={insurance?.carrier === item.name}
                        onClick={() => setCarrier(item)}
                      />
                    ))}
                  </div>
                </>
              )}

              {groups.length > 0 && (
                <h3 className="pb-1 pt-6 text-[19px] font-bold tracking-tight">All carriers</h3>
              )}
              {groups.map(([letter, items]) => (
                <section key={letter}>
                  <h4 className="sticky top-0 bg-white py-1.5 text-[14px] font-bold text-ink-soft">
                    {letter}
                  </h4>
                  <ul>
                    {items.map((item) => (
                      <li key={item.name}>
                        <button
                          type="button"
                          onClick={() => setCarrier(item)}
                          className="focus-ring flex w-full items-center justify-between gap-3 rounded-lg px-1 py-2.5 text-left text-[16px] hover:bg-cream"
                        >
                          {item.name}
                          {insurance?.carrier === item.name && (
                            <CheckIcon className="h-5 w-5 shrink-0 text-teal" />
                          )}
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>

            <div className="border-t border-line px-6 py-4 text-center">
              <button
                type="button"
                onClick={() => {
                  setInsurance(null);
                  onClose();
                }}
                className="focus-ring text-[16px] font-medium link-underline"
              >
                I&apos;m paying for myself
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function CarrierTile({
  carrier,
  selected,
  onClick,
}: {
  carrier: Carrier;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`focus-ring flex items-center gap-3 rounded-lg border p-2.5 text-left transition ${
        selected ? "border-teal bg-teal-soft" : "border-transparent hover:bg-cream"
      }`}
    >
      <CarrierLogo carrier={carrier} />
      <span className="text-[16px] leading-snug">{carrier.name}</span>
    </button>
  );
}

function CarrierLogo({ carrier }: { carrier: Carrier }) {
  return (
    <span
      aria-hidden="true"
      className="flex h-14 w-14 shrink-0 items-center justify-center rounded-md border border-line bg-white px-1 text-center text-[11px] font-bold leading-none"
      style={{ color: carrier.color }}
    >
      {carrier.short}
    </span>
  );
}
