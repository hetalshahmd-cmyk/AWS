"use client";

import { reasonLabel } from "@/lib/i18n";
import { ALL_VISIT_REASONS } from "@/lib/practice";
import { useLang } from "./lang-context";
import { ChevronDown, StethoscopeIcon } from "./icons";

/** How many of a provider's reasons show as "popular", as on Zocdoc. */
const POPULAR = 5;

/**
 * The visit-reason dropdown: a provider's own list (Zocdoc order), its first
 * five grouped as popular and the rest A–Z.
 */
export default function VisitReasonSelect({
  value,
  onChange,
  options = ALL_VISIT_REASONS,
  withIcon = false,
  id,
}: {
  value: string;
  onChange: (value: string) => void;
  options?: readonly string[];
  withIcon?: boolean;
  id?: string;
}) {
  const { lang, tr } = useLang();
  const popular = options.slice(0, POPULAR);
  const rest = options
    .slice(POPULAR)
    .sort((a, b) => reasonLabel(a, lang).localeCompare(reasonLabel(b, lang), lang));
  return (
    <div className="relative">
      {withIcon && (
        <StethoscopeIcon className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-ink" />
      )}
      <select
        id={id}
        aria-label={id ? undefined : tr.visitReason}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={`focus-ring w-full appearance-none rounded-lg border border-line-strong bg-white py-3 pr-10 text-[16px] transition hover:border-ink/40 ${
          withIcon ? "pl-11" : "pl-3.5"
        }`}
      >
        <optgroup label={tr.popularReasons}>
          {popular.map((reason) => (
            <option key={reason} value={reason}>
              {reasonLabel(reason, lang)}
            </option>
          ))}
        </optgroup>
        {rest.length > 0 && (
          <optgroup label={tr.allReasons}>
            {rest.map((reason) => (
              <option key={reason} value={reason}>
                {reasonLabel(reason, lang)}
              </option>
            ))}
          </optgroup>
        )}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink" />
    </div>
  );
}
