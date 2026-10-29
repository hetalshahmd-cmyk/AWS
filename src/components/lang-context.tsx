"use client";

import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { LANG_COOKIE, t, type Lang } from "@/lib/i18n";

type LangState = { lang: Lang; tr: ReturnType<typeof t>; setLang: (lang: Lang) => void };

const LangContext = createContext<LangState | null>(null);

export function LangProvider({ initial, children }: { initial: Lang; children: React.ReactNode }) {
  const router = useRouter();
  const [lang, setLangState] = useState<Lang>(initial);

  const setLang = useCallback(
    (next: Lang) => {
      // A year, so a returning patient sees their language again.
      document.cookie = `${LANG_COOKIE}=${next};path=/;max-age=${60 * 60 * 24 * 365};samesite=lax`;
      document.documentElement.lang = next;
      setLangState(next);
      // Server-rendered parts of the page (headings, banners) re-render too.
      router.refresh();
    },
    [router],
  );

  const value = useMemo(() => ({ lang, tr: t(lang), setLang }), [lang, setLang]);
  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}

export function useLang(): LangState {
  const ctx = useContext(LangContext);
  // Outside a provider (e.g. a component reused elsewhere) fall back to English.
  return ctx ?? { lang: "en", tr: t("en"), setLang: () => undefined };
}

/** English | Español switch. */
export function LanguageToggle({ className = "" }: { className?: string }) {
  const { lang, tr, setLang } = useLang();
  return (
    <div role="group" aria-label={tr.langLabel} className={`inline-flex rounded-full border border-line-strong bg-white p-1 ${className}`}>
      {(["en", "es"] as const).map((option) => (
        <button
          key={option}
          type="button"
          lang={option}
          aria-pressed={lang === option}
          onClick={() => setLang(option)}
          className={`focus-ring min-h-9 rounded-full px-3.5 text-[14px] font-medium transition ${
            lang === option ? "bg-ink text-white" : "text-ink-soft hover:text-ink"
          }`}
        >
          {option === "en" ? tr.langEnglish : tr.langSpanish}
        </button>
      ))}
    </div>
  );
}
