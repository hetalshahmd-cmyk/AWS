"use client";

import { useState } from "react";

/** Every <input> prop except `type` — `ref` included (React 19 passes it as a prop). */
type InputProps = Omit<React.ComponentProps<"input">, "type">;

/**
 * A date field whose calendar opens wherever it is clicked — not only on the
 * small icon. Typing the date still works, and so does the keyboard.
 */
export function DateInput({ className = "", onClick, ...props }: InputProps) {
  return (
    <input
      {...props}
      type="date"
      onClick={(event) => {
        onClick?.(event);
        try {
          // Needs a real click; some browsers don't have it — then the icon still works.
          event.currentTarget.showPicker?.();
        } catch {
          /* not supported here */
        }
      }}
      className={`${className} cursor-pointer`}
    />
  );
}

function EyeIcon({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="h-5 w-5"
    >
      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
      {!open && <path d="M3 3l18 18" />}
    </svg>
  );
}

/**
 * A password field with an eye button to show or hide what was typed.
 * Labels default to English; pass translated ones where the page has them.
 */
export function PasswordInput({
  className = "",
  showLabel = "Show password",
  hideLabel = "Hide password",
  ...props
}: InputProps & { showLabel?: string; hideLabel?: string }) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <input {...props} type={visible ? "text" : "password"} className={`${className} pr-12`} />
      <button
        type="button"
        onClick={() => setVisible((prev) => !prev)}
        aria-label={visible ? hideLabel : showLabel}
        aria-pressed={visible}
        title={visible ? hideLabel : showLabel}
        className="focus-ring absolute inset-y-0 right-0 flex w-12 items-center justify-center rounded-r-lg text-current opacity-60 transition hover:opacity-100"
      >
        <EyeIcon open={!visible} />
      </button>
    </div>
  );
}
