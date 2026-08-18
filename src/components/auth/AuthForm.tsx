"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useSession } from "./session-context";

const FIELD =
  "focus-ring w-full rounded-lg border border-mist bg-white px-3.5 py-3 text-[16px] placeholder:text-plum-soft/70";
const LABEL = "mb-1.5 block text-[14px] font-semibold";

/**
 * Sign-in only — registration is the multi-step RegisterForm.
 *
 * `next` arrives as a prop, already sanitised on the server. Reading it with
 * useSearchParams instead would opt this whole route out of server rendering,
 * which is what used to leave the page blank until JavaScript arrived.
 */
export default function AuthForm({ next }: { next: string }) {
  const router = useRouter();
  const { setUser } = useSession();

  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");

    try {
      const response = await fetch("/api/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
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
      {next.startsWith("/book") && (
        <p className="rounded-lg bg-sage-soft px-3.5 py-2.5 text-[15px] text-sage-ink">
          Log in to book your appointment — we&apos;ll take you straight back.
        </p>
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
          autoComplete="current-password"
          value={form.password}
          onChange={(event) => setForm({ ...form, password: event.target.value })}
          className={FIELD}
          placeholder="••••••••"
        />
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
        {busy ? "Signing in…" : "Log in"}
      </button>

      <p className="text-center text-[15px] text-plum-soft">
        Don&apos;t have an account?{" "}
        <Link
          href={`/register${next === "/my-bookings" ? "" : `?next=${encodeURIComponent(next)}`}`}
          className="font-semibold text-wine link-underline"
        >
          Register
        </Link>
      </p>
    </form>
  );
}
