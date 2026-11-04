"use client";

import { useMemo, useState, type ReactNode } from "react";
import Ico from "@/components/site/Ico";

type Network = { name: string; plans: string[] };

/** Coverage filters, each matched against the plan names. */
const KINDS = [
  { key: "all", label: "All", test: () => true },
  { key: "ppo", label: "PPO", test: (plan: string) => /\bPPO\b/.test(plan) },
  { key: "auto", label: "Auto", test: (plan: string) => /\bAuto\b/.test(plan) },
  { key: "wc", label: "Workers' comp", test: (plan: string) => /workers comp/i.test(plan) },
  { key: "discount", label: "Discount", test: (plan: string) => /discount/i.test(plan) },
  { key: "medicare", label: "Medicare", test: (plan: string) => /medicare/i.test(plan) },
] as const;

type Kind = (typeof KINDS)[number]["key"];

/** "Galaxy Health" → GH, "MCCP" → MCCP, "Velocity" → V. */
function monogram(name: string) {
  const words = name.split(/\s+/);
  if (words.length > 1) return words.map((word) => word[0]).join("").slice(0, 2).toUpperCase();
  return name === name.toUpperCase() ? name : name[0];
}

/**
 * The Insurance page's list of accepted networks: search by name or plan,
 * filter by kind of coverage. Every network stays in the page's HTML.
 * `children` is the last tile of the grid ("Don't see your insurance?").
 */
export default function NetworksExplorer({ networks, children }: { networks: Network[]; children?: ReactNode }) {
  const [kind, setKind] = useState<Kind>("all");
  const [query, setQuery] = useState("");
  const term = query.trim().toLowerCase();
  const test = KINDS.find((item) => item.key === kind)!.test;

  const counts = useMemo(
    () =>
      Object.fromEntries(
        KINDS.map((item) => [item.key, networks.filter((network) => network.plans.some(item.test)).length]),
      ) as Record<Kind, number>,
    [networks],
  );

  const shown = networks.filter(
    (network) =>
      network.plans.some(test) &&
      (!term || network.name.toLowerCase().includes(term) || network.plans.some((plan) => plan.toLowerCase().includes(term))),
  );

  return (
    <div>
      {/* Search and filters */}
      <div className="reveal flex flex-col gap-4 rounded-[24px] border border-mist bg-white/80 p-3 shadow-[0_24px_60px_-40px_rgba(36,28,32,0.45)] backdrop-blur min-[900px]:flex-row min-[900px]:items-center">
        <label className="relative block min-[900px]:w-[300px] min-[900px]:shrink-0">
          <span className="sr-only">Search networks and plans</span>
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-stone"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search your insurance"
            className="focus-ring h-12 w-full rounded-full border border-mist bg-ivory pl-11 pr-4 text-[1rem] text-plum placeholder:text-stone"
          />
        </label>
        <div role="group" aria-label="Filter by coverage" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-0.5 min-[900px]:flex-wrap">
          {KINDS.map((item) => {
            const active = kind === item.key;
            return (
              <button
                key={item.key}
                type="button"
                aria-pressed={active}
                onClick={() => setKind(item.key)}
                className={`focus-ring inline-flex h-10 shrink-0 items-center gap-2 whitespace-nowrap rounded-full border px-4 text-[0.92rem] font-medium transition duration-300 ${
                  active
                    ? "border-plum bg-plum text-white shadow-[0_10px_24px_-14px_rgba(36,28,32,0.9)]"
                    : "border-mist bg-white text-plum-soft hover:border-plum/30 hover:text-plum"
                }`}
              >
                {item.label}
                <span
                  className={`grid h-5 min-w-5 place-items-center rounded-full px-1.5 text-[0.72rem] font-semibold ${
                    active ? "bg-white/15 text-white" : "bg-shell text-stone"
                  }`}
                >
                  {counts[item.key]}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <p aria-live="polite" className="sr-only">
        {shown.length} {shown.length === 1 ? "network" : "networks"} shown
      </p>

      {/* Network cards */}
      <ul className="mt-6 grid gap-5 min-[680px]:grid-cols-2 min-[1080px]:grid-cols-3">
        {networks.map((network) => {
          const visible = shown.includes(network);
          return (
            <li
              key={network.name}
              hidden={!visible}
              className="group relative overflow-hidden rounded-[26px] border border-mist bg-white p-[clamp(1.35rem,2.4vw,1.75rem)] transition duration-500 ease-[cubic-bezier(.22,1,.36,1)] hover:-translate-y-1 hover:border-wine/20 hover:shadow-[0_30px_60px_-36px_rgba(92,30,45,0.45)]"
            >
              {/* Hairline accent that draws in on hover */}
              <span
                aria-hidden="true"
                className="absolute inset-x-0 top-0 h-[3px] origin-left scale-x-0 bg-gradient-to-r from-wine via-[#b65a6d] to-sage transition-transform duration-500 group-hover:scale-x-100"
              />
              <div className="flex items-start gap-4">
                <span
                  aria-hidden="true"
                  className={`grid h-[3.4rem] w-[3.4rem] shrink-0 place-items-center rounded-full bg-gradient-to-br from-wine to-wine-deep font-display tracking-[0.04em] text-white ring-[5px] ring-wine-soft transition duration-500 group-hover:ring-[#ecd3d8] ${
                    monogram(network.name).length > 3 ? "text-[0.82rem]" : monogram(network.name).length > 2 ? "text-[0.98rem]" : "text-[1.15rem]"
                  }`}
                >
                  {monogram(network.name)}
                </span>
                <div className="min-w-0 flex-1 pt-0.5">
                  <h3 className="font-display text-[1.45rem] leading-[1.15] text-plum">{network.name}</h3>
                  <p className="mt-1 text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-stone">
                    {network.plans.length} {network.plans.length === 1 ? "plan" : "plans"}
                  </p>
                </div>
                <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-sage-soft px-2.5 py-1 text-[0.72rem] font-semibold text-sage-ink">
                  <Ico name="check" className="h-3 w-3" />
                  Accepted
                </span>
              </div>

              <ul aria-label={`${network.name} plans`} className="mt-5 space-y-2.5 border-t border-dashed border-mist pt-5">
                {network.plans.map((plan) => {
                  const match = kind !== "all" && test(plan);
                  return (
                    <li
                      key={plan}
                      className={`flex items-start gap-2.5 text-[0.95rem] leading-snug transition-colors ${
                        match ? "font-medium text-wine" : "text-plum-soft"
                      }`}
                    >
                      <span
                        aria-hidden="true"
                        className={`mt-[0.2rem] grid h-4 w-4 shrink-0 place-items-center rounded-full ${
                          match ? "bg-wine text-white" : "bg-shell text-wine"
                        }`}
                      >
                        <Ico name="check" className="h-2.5 w-2.5" />
                      </span>
                      {plan}
                    </li>
                  );
                })}
              </ul>
            </li>
          );
        })}
        {children && shown.length > 0 && <li className="flex">{children}</li>}
      </ul>

      {shown.length === 0 && (
        <div className="mt-6 rounded-[26px] border border-dashed border-mist bg-white px-6 py-12 text-center">
          <p className="font-display text-[1.5rem] text-plum">No match in this list</p>
          <p className="mx-auto mt-2 max-w-[44ch] text-plum-soft">
            We accept most major plans too — call us and we&apos;ll check yours before your visit.
          </p>
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setKind("all");
            }}
            className="focus-ring mt-5 rounded-full border border-plum/20 px-5 py-2.5 text-[0.95rem] font-medium text-plum transition hover:bg-plum hover:text-white"
          >
            Show all networks
          </button>
        </div>
      )}
    </div>
  );
}
