"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useSession } from "./session-context";

/**
 * Where to land after signing in or registering. Never bounce back to an auth
 * page (that's what sent freshly registered users to /login), and never off-site.
 */
function safeNext(raw: string | null): string {
  if (!raw) return "/my-bookings";
  if (!raw.startsWith("/") || raw.startsWith("//")) return "/my-bookings";
  if (/^\/(login|register|admin)(\/|\?|$)/.test(raw)) return "/my-bookings";
  return raw;
}

const FIELD =
  "focus-ring w-full rounded-lg border border-mist bg-white px-3.5 py-3 text-[16px] placeholder:text-plum-soft/70";
const LABEL = "mb-1.5 block text-[14px] font-semibold";

export default function AuthForm({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const params = useSearchParams();
  const { setUser } = useSession();

  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const register = mode === "register";
  const next = safeNext(params.get("next"));

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");

    try {
      const response = await fetch(register ? "/api/auth/register" : "/api/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          register ? form : { email: form.email, password: form.password },
        ),
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error ?? "Something went wrong");
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
    <form onSubmit={onSubmit} className="mt-6 space-y-4">
      {register && (
        <div>
          <label className={LABEL} htmlFor="name">
            Full name
          </label>
          <input
            id="name"
            required
            autoComplete="name"
            value={form.name}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
            className={FIELD}
            placeholder="Jane Doe"
          />
        </div>
      )}

      <div>
        <label className={LABEL} htmlFor="email">
          Email
        </label>
        <input
          id="email"
          type="email"
          required
          autoComplete="email"
          value={form.email}
          onChange={(event) => setForm({ ...form, email: event.target.value })}
          className={FIELD}
          placeholder="jane@email.com"
        />
      </div>

      <div>
        <label className={LABEL} htmlFor="password">
          Password
        </label>
        <input
          id="password"
          type="password"
          required
          minLength={register ? 8 : undefined}
          autoComplete={register ? "new-password" : "current-password"}
          value={form.password}
          onChange={(event) => setForm({ ...form, password: event.target.value })}
          className={FIELD}
          placeholder="••••••••"
        />
        {register && <p className="mt-1.5 text-[13px] text-plum-soft">At least 8 characters.</p>}
      </div>

      {error && (
        <p role="alert" className="rounded-lg bg-wine-soft px-3 py-2 text-[15px] text-wine-deep">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={busy}
        className="focus-ring w-full rounded-full bg-wine px-6 py-3 text-[16px] font-semibold text-white transition hover:bg-wine-deep disabled:opacity-60"
      >
        {busy ? (register ? "Creating account…" : "Signing in…") : register ? "Create account" : "Log in"}
      </button>

      <p className="text-center text-[15px] text-plum-soft">
        {register ? "Already have an account? " : "Don't have an account? "}
        <Link
          href={`${register ? "/login" : "/register"}${
            next === "/my-bookings" ? "" : `?next=${encodeURIComponent(next)}`
          }`}
          className="font-semibold text-wine link-underline"
        >
          {register ? "Log in" : "Register"}
        </Link>
      </p>
    </form>
  );
}
