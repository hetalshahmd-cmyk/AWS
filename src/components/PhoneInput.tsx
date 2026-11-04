"use client";

import { useMemo } from "react";
import type { CountryCode } from "libphonenumber-js/min";
import { dialCode, flagEmoji, phoneCountries } from "@/lib/phone";

/**
 * A mobile number with its country: the flag and calling code on the left
 * (United States by default), the number on the right. The country list is
 * the device's own dropdown, laid invisibly over the flag button, so it works
 * with a keyboard, a screen reader and the phone's native picker.
 */
export default function PhoneInput({
  id,
  country,
  number,
  onChange,
  lang = "en",
  countryLabel,
  describedBy,
  required,
  inputClassName,
  title,
}: {
  id: string;
  country: CountryCode;
  number: string;
  onChange: (value: { country: CountryCode; number: string }) => void;
  lang?: string;
  /** Read aloud for the country dropdown, e.g. "Country code". */
  countryLabel: string;
  describedBy?: string;
  required?: boolean;
  /** Classes for the number box (the field look of the form it sits in). */
  inputClassName: string;
  title?: string;
}) {
  const countries = useMemo(() => phoneCountries(lang), [lang]);
  return (
    <div className="flex gap-2">
      <div className="relative shrink-0">
        <span
          aria-hidden="true"
          className={`${inputClassName} pointer-events-none flex h-full w-auto items-center gap-2 pr-8`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- a tiny local SVG */}
          <img src={`/flags/${country}.svg`} alt="" width={22} height={15} className="h-[15px] w-[22px] rounded-[2px] object-cover shadow-[0_0_0_1px_rgba(0,0,0,.12)]" />
          <span className="tabular-nums">{dialCode(country)}</span>
          <svg viewBox="0 0 24 24" className="absolute right-2.5 h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2}>
            <path d="M6 9l6 6 6-6" />
          </svg>
        </span>
        <select
          aria-label={countryLabel}
          value={country}
          onChange={(event) => onChange({ country: event.target.value as CountryCode, number })}
          className="focus-ring absolute inset-0 h-full w-full cursor-pointer appearance-none rounded-lg opacity-0"
        >
          {countries.map((item) => (
            <option key={item.code} value={item.code}>
              {flagEmoji(item.code)} {item.name} ({item.dial})
            </option>
          ))}
        </select>
      </div>
      <input
        id={id}
        required={required}
        type="tel"
        inputMode="tel"
        autoComplete="tel-national"
        maxLength={20}
        title={title}
        placeholder={country === "US" ? "(623) 555-0123" : ""}
        value={number}
        onChange={(event) => onChange({ country, number: event.target.value })}
        aria-describedby={describedBy}
        className={`${inputClassName} min-w-0 flex-1`}
      />
    </div>
  );
}
