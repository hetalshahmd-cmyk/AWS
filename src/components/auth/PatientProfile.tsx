"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { PasswordInput } from "@/components/form-fields";
import { useLang } from "@/components/lang-context";
import { useSession } from "./session-context";

const SECTION = "grid gap-5 p-5 sm:p-7 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-10";
const FIELD =
  "focus-ring w-full rounded-xl border border-mist bg-white px-4 py-3 text-[16px] transition hover:border-plum/30 focus-visible:border-wine";
const LABEL = "mb-1.5 block text-[14px] font-medium text-plum";
const BUTTON =
  "focus-ring inline-flex min-h-11 items-center rounded-full bg-wine px-6 text-[15px] font-medium text-white transition hover:bg-wine-deep disabled:cursor-not-allowed disabled:bg-mist disabled:text-plum-soft";

function Message({ tone, text }: { tone: "ok" | "error"; text: string }) {
  if (!text) return null;
  return (
    <p
      role={tone === "error" ? "alert" : "status"}
      className={`mt-4 rounded-xl px-4 py-3 text-[15px] ${
        tone === "ok" ? "bg-sage-soft text-sage-ink" : "bg-wine-soft text-wine-deep"
      }`}
    >
      {text}
    </p>
  );
}

function SectionTitle({ title, sub }: { title: string; sub: string }) {
  return (
    <div>
      <h2 className="text-[1.05rem] font-semibold text-plum">{title}</h2>
      <p className="mt-1 text-[14px] text-plum-soft">{sub}</p>
    </div>
  );
}

/** Name, email (read-only) and password for the signed-in patient. */
export default function PatientProfile({
  name: initialName,
  email,
}: {
  name: string;
  email: string;
}) {
  const { lang, tr } = useLang();
  const router = useRouter();
  const { refresh } = useSession();

  const [name, setName] = useState(initialName);
  const [nameBusy, setNameBusy] = useState(false);
  const [nameMsg, setNameMsg] = useState<{ tone: "ok" | "error"; text: string }>({
    tone: "ok",
    text: "",
  });

  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [pwBusy, setPwBusy] = useState(false);
  const [pwMsg, setPwMsg] = useState<{ tone: "ok" | "error"; text: string }>({
    tone: "ok",
    text: "",
  });

  async function saveName(event: React.FormEvent) {
    event.preventDefault();
    setNameBusy(true);
    setNameMsg({ tone: "ok", text: "" });
    try {
      const response = await fetch("/api/my/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await response.json();
      if (!response.ok) {
        setNameMsg({ tone: "error", text: data.error ?? tr.serverDown });
        return;
      }
      setNameMsg({ tone: "ok", text: tr.nameSaved });
      await refresh();
      router.refresh();
    } catch {
      setNameMsg({ tone: "error", text: tr.serverDown });
    } finally {
      setNameBusy(false);
    }
  }

  async function changePassword(event: React.FormEvent) {
    event.preventDefault();
    setPwBusy(true);
    setPwMsg({ tone: "ok", text: "" });
    try {
      const response = await fetch("/api/my/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      });
      const data = await response.json();
      if (!response.ok) {
        setPwMsg({
          tone: "error",
          text: data.code === "wrong-password" ? tr.wrongPassword : (data.error ?? tr.serverDown),
        });
        return;
      }
      setCurrent("");
      setNext("");
      setPwMsg({ tone: "ok", text: tr.passwordChanged });
    } catch {
      setPwMsg({ tone: "error", text: tr.serverDown });
    } finally {
      setPwBusy(false);
    }
  }

  return (
    <div lang={lang}>
      <h1 className="font-display text-[clamp(1.9rem,4vw,2.5rem)] font-normal leading-tight text-plum">
        {tr.panelProfile}
      </h1>
      <p className="mt-1 text-plum-soft">{tr.profileSub}</p>

      <div className="mt-6 overflow-hidden rounded-[20px] border border-mist bg-white">
        <form onSubmit={saveName} className={SECTION}>
          <SectionTitle title={tr.personalTitle} sub={tr.personalSub} />
          <div>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className={LABEL}>{tr.fullName}</span>
                <input
                  required
                  minLength={2}
                  maxLength={80}
                  autoComplete="name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  className={FIELD}
                />
              </label>
              <label className="block">
                <span className={LABEL}>{tr.emailLabel}</span>
                <input value={email} readOnly className={`${FIELD} bg-ivory text-plum-soft`} />
                <span className="mt-1.5 block text-[13px] text-plum-soft">{tr.emailLocked}</span>
              </label>
            </div>
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <button
                type="submit"
                disabled={nameBusy || name.trim() === initialName}
                className={BUTTON}
              >
                {nameBusy ? tr.saving : tr.saveName}
              </button>
            </div>
            <Message {...nameMsg} />
          </div>
        </form>

        <form onSubmit={changePassword} className={`${SECTION} border-t border-mist`}>
          <SectionTitle title={tr.passwordTitle} sub={tr.passwordSub} />
          <div>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className={LABEL}>{tr.currentPassword}</span>
                <PasswordInput
                  required
                  autoComplete="current-password"
                  value={current}
                  onChange={(event) => setCurrent(event.target.value)}
                  showLabel={tr.showPassword}
                  hideLabel={tr.hidePassword}
                  className={FIELD}
                />
              </label>
              <label className="block">
                <span className={LABEL}>{tr.newPassword}</span>
                <PasswordInput
                  required
                  minLength={8}
                  autoComplete="new-password"
                  placeholder={tr.passwordHint}
                  value={next}
                  onChange={(event) => setNext(event.target.value)}
                  showLabel={tr.showPassword}
                  hideLabel={tr.hidePassword}
                  className={FIELD}
                />
              </label>
            </div>
            <button type="submit" disabled={pwBusy} className={`${BUTTON} mt-5`}>
              {pwBusy ? tr.saving : tr.changePassword}
            </button>
            <Message {...pwMsg} />
          </div>
        </form>
      </div>
    </div>
  );
}
