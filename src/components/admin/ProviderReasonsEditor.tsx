"use client";

import { getProviders } from "@/lib/providers";
import { useState } from "react";
import { visitReasons } from "@/lib/practice";
import { BTN_PRIMARY, BTN_QUIET, CARD, Notice } from "./ui";

const REASONS: string[] = [...visitReasons.popular, ...visitReasons.all];

/** Provider id -> the reasons they see. A provider not in the map sees all. */
type ReasonMap = Partial<Record<string, string[]>>;

function toTicks(map: ReasonMap): Record<string, Set<string>> {
  return Object.fromEntries(
    getProviders().map((provider) => [provider.id, new Set(map[provider.id] ?? REASONS)]),
  );
}

/**
 * Which visit reasons each provider takes — the list in their booking form
 * on /book. The server fills in each provider's Zocdoc list until saved.
 */
export default function ProviderReasonsEditor({ initial }: { initial: ReasonMap }) {
  const [ticks, setTicks] = useState(() => toTicks(initial));
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");

  function toggle(providerId: string, reason: string) {
    setTicks((prev) => {
      const next = new Set(prev[providerId]);
      if (next.has(reason)) next.delete(reason);
      else next.add(reason);
      return { ...prev, [providerId]: next };
    });
    setDirty(true);
    setOk("");
  }

  function setAll(providerId: string, on: boolean) {
    setTicks((prev) => ({ ...prev, [providerId]: new Set(on ? REASONS : []) }));
    setDirty(true);
    setOk("");
  }

  const empty = getProviders().filter((provider) => ticks[provider.id].size === 0);
  const uncovered = REASONS.filter((reason) =>
    getProviders().every((provider) => !ticks[provider.id].has(reason)),
  );

  async function save() {
    setBusy(true);
    setError("");
    setOk("");
    try {
      const reasons = Object.fromEntries(
        getProviders().map((provider) => [provider.id, [...ticks[provider.id]]]),
      );
      const response = await fetch("/api/admin/provider-reasons", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reasons }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? "Could not save visit reasons");
        return;
      }
      setTicks(toTicks(data.reasons));
      setDirty(false);
      setOk("Visit reasons saved. Booking now only shows each provider for the reasons ticked.");
    } catch {
      setError("Could not reach the server");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={`${CARD} mt-6`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-[1.25rem] font-semibold">Visit reasons by provider</h2>
          <p className="mt-0.5 max-w-[70ch] text-[14px] text-plum-soft">
            What each provider&apos;s booking form offers. Starts from their Zocdoc list;
            untick a reason they don&apos;t handle, tick one they do.
          </p>
        </div>
        <button
          type="button"
          onClick={save}
          disabled={busy || !dirty || empty.length > 0}
          className={BTN_PRIMARY}
        >
          {busy ? "Saving…" : "Save visit reasons"}
        </button>
      </div>

      <Notice tone="error">
        {error ||
          (empty.length > 0
            ? `${empty.map((p) => p.name.split(",")[0]).join(", ")} needs at least one visit reason.`
            : "")}
      </Notice>
      <Notice tone="ok">{ok}</Notice>
      {uncovered.length > 0 && (
        <p className="mt-3 rounded-lg bg-shell px-3 py-2 text-[14px] text-plum">
          No provider takes: {uncovered.join(", ")}. Patients can&apos;t book these online.
        </p>
      )}

      <div className="mt-5 overflow-x-auto">
        <table className="w-full min-w-140 border-collapse text-[14px]">
          <thead>
            <tr className="border-b border-mist text-left">
              <th scope="col" className="py-2 pr-3 font-semibold">
                Visit reason
              </th>
              {getProviders().map((provider) => (
                <th key={provider.id} scope="col" className="px-2 py-2 text-center font-semibold">
                  <span className="block">{provider.name.split(",")[0]}</span>
                  <span className="mt-1 flex justify-center gap-1">
                    <button
                      type="button"
                      onClick={() => setAll(provider.id, true)}
                      className={`${BTN_QUIET} px-2! py-0.5! text-[12px]!`}
                    >
                      All
                    </button>
                    <button
                      type="button"
                      onClick={() => setAll(provider.id, false)}
                      className={`${BTN_QUIET} px-2! py-0.5! text-[12px]!`}
                    >
                      None
                    </button>
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {REASONS.map((reason) => (
              <tr key={reason} className="border-b border-mist/70 last:border-0">
                <th scope="row" className="py-2 pr-3 text-left font-normal text-plum">
                  {reason}
                </th>
                {getProviders().map((provider) => (
                  <td key={provider.id} className="px-2 py-2 text-center">
                    <input
                      type="checkbox"
                      aria-label={`${provider.name.split(",")[0]} — ${reason}`}
                      checked={ticks[provider.id].has(reason)}
                      onChange={() => toggle(provider.id, reason)}
                      className="h-4 w-4 accent-wine"
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
