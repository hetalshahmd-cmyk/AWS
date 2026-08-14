"use client";

export const FIELD =
  "focus-ring w-full rounded-lg border border-line-strong bg-white px-3 py-2.5 text-[15px] placeholder:text-plum-soft/70";

export const LABEL = "mb-1.5 block text-[13px] font-semibold text-plum";

export const BTN_PRIMARY =
  "focus-ring inline-flex items-center justify-center gap-2 rounded-lg bg-wine px-4 py-2.5 text-[15px] font-semibold text-white transition hover:bg-wine-deep disabled:opacity-60";

export const BTN_QUIET =
  "focus-ring inline-flex items-center justify-center gap-2 rounded-lg border border-line-strong bg-white px-3 py-2 text-[14px] font-semibold transition hover:bg-shell disabled:opacity-60";

export const BTN_DANGER =
  "focus-ring inline-flex items-center justify-center gap-2 rounded-lg border border-wine/30 bg-white px-3 py-2 text-[14px] font-semibold text-wine transition hover:bg-wine-soft disabled:opacity-60";

export const CARD =
  "rounded-2xl border border-mist bg-white p-6 shadow-[0_1px_2px_rgba(44,32,38,.05)]";

export function Notice({ tone, children }: { tone: "error" | "ok"; children: React.ReactNode }) {
  if (!children) return null;
  return (
    <p
      role="status"
      className={`mt-3 rounded-lg px-3 py-2 text-[14px] ${
        tone === "error"
          ? "bg-wine-soft text-wine-deep"
          : "bg-sage-soft text-sage-ink"
      }`}
    >
      {children}
    </p>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const confirmed = status === "confirmed";
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-[12px] font-semibold ${
        confirmed ? "bg-sage-soft text-sage-ink" : "bg-wine-soft text-wine-deep"
      }`}
    >
      {confirmed ? "Confirmed" : "Cancelled"}
    </span>
  );
}
