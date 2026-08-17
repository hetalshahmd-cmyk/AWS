"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useSession } from "./session-context";
import { safeNext } from "./safe-next";

const FIELD =
  "focus-ring w-full rounded-lg border border-mist bg-white px-3.5 py-3 text-[16px] placeholder:text-plum-soft/70";
const LABEL = "mb-1.5 block text-[14px] font-semibold";
const BTN =
  "focus-ring w-full rounded-full bg-wine px-6 py-3 text-[16px] font-semibold text-white transition hover:bg-wine-deep disabled:opacity-60";

type Step = "details" | "code" | "password";

export default function RegisterForm() {
  const router = useRouter();
  const params = useSearchParams();
  const { setUser } = useSession();
  const next = safeNext(params.get("next"));

  const [step, setStep] = useState<Step>("details");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [cooldown, setCooldown] = useState(0);

  const codeRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  // Resend countdown.
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  useEffect(() => {
    if (step === "code") codeRef.current?.focus();
    if (step === "password") passwordRef.current?.focus();
  }, [step]);

  async function sendCode(resend = false) {
    setBusy(true);
    setError("");
    setNotice("");

    try {
      const response = await fetch("/api/auth/otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error ?? "Could not send the code");
        if (typeof data.retryInSeconds === "number") setCooldown(data.retryInSeconds);
        return;
      }

      setStep("code");
      setCooldown(45);
      setNotice(
        data.devCode
          ? `Email didn't go out — development code: ${data.devCode}`
          : resend
            ? `New code sent to ${email}.`
            : `We sent a 6-digit code to ${email}.`,
      );
    } catch {
      setError("Could not reach the server");
    } finally {
      setBusy(false);
    }
  }

  async function checkCode(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");

    try {
      const response = await fetch("/api/auth/otp", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code }),
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error ?? "That code isn't right");
        return;
      }
      setNotice("Email verified. Pick a password to finish.");
      setStep("password");
    } catch {
      setError("Could not reach the server");
    } finally {
      setBusy(false);
    }
  }

  async function createAccount(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error ?? "Could not create your account");
        if (data.needsOtp) setStep("code");
        return;
      }

      setUser(data.user);
      router.push(next);
      router.refresh();
    } catch {
      setError("Could not reach the server");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-6">
      <Steps step={step} />

      {step === "details" && (
        <form
          className="mt-5 space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            void sendCode();
          }}
        >
          <div>
            <label className={LABEL} htmlFor="name">
              Full name
            </label>
            <input
              id="name"
              required
              autoComplete="name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              className={FIELD}
              placeholder="Jane Doe"
            />
          </div>

          <div>
            <label className={LABEL} htmlFor="email">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value.trim())}
              className={FIELD}
              placeholder="jane@email.com"
            />
            <p className="mt-1.5 text-[13px] text-plum-soft">
              We&apos;ll email a 6-digit code to make sure it&apos;s yours.
            </p>
          </div>

          <Feedback error={error} notice={notice} />

          <button type="submit" disabled={busy} className={BTN}>
            {busy ? "Sending code…" : "Send verification code"}
          </button>
        </form>
      )}

      {step === "code" && (
        <form className="mt-5 space-y-4" onSubmit={checkCode}>
          <div>
            <label className={LABEL} htmlFor="code">
              6-digit code
            </label>
            <input
              id="code"
              ref={codeRef}
              required
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
              className={`${FIELD} text-center text-[26px] font-semibold tracking-[0.4em]`}
              placeholder="000000"
            />
          </div>

          <Feedback error={error} notice={notice} />

          <button type="submit" disabled={busy || code.length !== 6} className={BTN}>
            {busy ? "Checking…" : "Verify email"}
          </button>

          <div className="flex flex-wrap justify-between gap-3 text-[14px]">
            <button
              type="button"
              disabled={busy || cooldown > 0}
              onClick={() => void sendCode(true)}
              className="focus-ring font-semibold text-wine link-underline disabled:text-plum-soft disabled:no-underline"
            >
              {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend code"}
            </button>
            <button
              type="button"
              onClick={() => {
                setStep("details");
                setCode("");
                setError("");
                setNotice("");
              }}
              className="focus-ring font-semibold text-plum-soft link-underline"
            >
              Change email
            </button>
          </div>
        </form>
      )}

      {step === "password" && (
        <form className="mt-5 space-y-4" onSubmit={createAccount}>
          <div className="rounded-lg bg-sage-soft px-3 py-2.5 text-[15px] text-sage-ink">
            {email} is verified.
          </div>

          <div>
            <label className={LABEL} htmlFor="password">
              Password
            </label>
            <input
              id="password"
              ref={passwordRef}
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className={FIELD}
              placeholder="••••••••"
            />
            <p className="mt-1.5 text-[13px] text-plum-soft">At least 8 characters.</p>
          </div>

          <Feedback error={error} notice="" />

          <button type="submit" disabled={busy} className={BTN}>
            {busy ? "Creating account…" : "Create account"}
          </button>
        </form>
      )}

      <p className="mt-5 text-center text-[15px] text-plum-soft">
        Already have an account?{" "}
        <Link
          href={`/login${next === "/my-bookings" ? "" : `?next=${encodeURIComponent(next)}`}`}
          className="font-semibold text-wine link-underline"
        >
          Log in
        </Link>
      </p>
    </div>
  );
}

function Steps({ step }: { step: Step }) {
  const items: { key: Step; label: string }[] = [
    { key: "details", label: "Your details" },
    { key: "code", label: "Verify email" },
    { key: "password", label: "Password" },
  ];
  const index = items.findIndex((item) => item.key === step);

  return (
    <ol className="flex items-center gap-2 text-[13px]">
      {items.map((item, position) => {
        const done = position < index;
        const active = position === index;
        return (
          <li key={item.key} className="flex flex-1 items-center gap-2">
            <span
              className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-[12px] font-bold ${
                done
                  ? "bg-sage text-white"
                  : active
                    ? "bg-wine text-white"
                    : "bg-shell text-plum-soft"
              }`}
            >
              {done ? "✓" : position + 1}
            </span>
            <span className={active ? "font-semibold" : "text-plum-soft"}>{item.label}</span>
          </li>
        );
      })}
    </ol>
  );
}

function Feedback({ error, notice }: { error: string; notice: string }) {
  if (error) {
    return (
      <p role="alert" className="rounded-lg bg-wine-soft px-3 py-2 text-[15px] text-wine-deep">
        {error}
      </p>
    );
  }
  if (notice) {
    return <p className="rounded-lg bg-shell px-3 py-2 text-[15px] text-plum-soft">{notice}</p>;
  }
  return null;
}
