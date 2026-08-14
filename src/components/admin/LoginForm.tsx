"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { BTN_PRIMARY, FIELD, LABEL, Notice } from "./ui";

export default function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");

    try {
      const response = await fetch("/api/admin/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error ?? "Could not sign in");
        return;
      }
      router.replace("/admin");
      router.refresh();
    } catch {
      setError("Could not reach the server");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-5 space-y-4">
      <div>
        <label className={LABEL} htmlFor="email">
          Email
        </label>
        <input
          id="email"
          type="email"
          autoComplete="username"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className={FIELD}
          placeholder="you@arizonawomen.com"
        />
      </div>

      <div>
        <label className={LABEL} htmlFor="password">
          Password
        </label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className={FIELD}
          placeholder="••••••••"
        />
      </div>

      <button type="submit" disabled={busy} className={`${BTN_PRIMARY} w-full`}>
        {busy ? "Signing in…" : "Sign in"}
      </button>

      <Notice tone="error">{error}</Notice>
    </form>
  );
}
