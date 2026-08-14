"use client";

import { visitReasons } from "@/lib/practice";
import { ChevronDown, StethoscopeIcon } from "./icons";

export default function VisitReasonSelect({
  value,
  onChange,
  withIcon = false,
}: {
  value: string;
  onChange: (value: string) => void;
  withIcon?: boolean;
}) {
  return (
    <div className="relative">
      {withIcon && (
        <StethoscopeIcon className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-ink" />
      )}
      <select
        aria-label="Visit reason"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={`focus-ring w-full appearance-none rounded-lg border border-line-strong bg-white py-3 pr-10 text-[16px] transition hover:border-ink/40 ${
          withIcon ? "pl-11" : "pl-3.5"
        }`}
      >
        <optgroup label="Popular Visit Reasons">
          {visitReasons.popular.map((reason) => (
            <option key={reason} value={reason}>
              {reason}
            </option>
          ))}
        </optgroup>
        <optgroup label="All Visit Reasons">
          {visitReasons.all.map((reason) => (
            <option key={reason} value={reason}>
              {reason}
            </option>
          ))}
        </optgroup>
      </select>
      <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink" />
    </div>
  );
}
