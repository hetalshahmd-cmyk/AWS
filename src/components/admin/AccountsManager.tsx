"use client";

import Link from "next/link";
import { useState } from "react";
import type { Admin } from "@/lib/models";
import { BTN_DANGER, BTN_PRIMARY, BTN_QUIET, CARD, FIELD, LABEL, Notice } from "./ui";

type Account = Admin & { providerName: string | null };

const ROLES: Record<Admin["role"], { label: string; tone: string; what: string }> = {
  admin: { label: "Admin", tone: "bg-wine-soft text-wine-deep", what: "Everything" },
  staff: { label: "Front desk", tone: "bg-[#e7f3ff] text-[#1f4f7a]", what: "Website, bookings, appointment slots, patient chats, email" },
  provider: { label: "Provider", tone: "bg-sage-soft text-sage-ink", what: "Their own appointments, messages and article reviews" },
};

const when = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("en-US", { timeZone: "America/Phoenix", month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }) : "Never";

/** Admin → User accounts: list, create, reset passwords, remove. */
export default function AccountsManager({ meId, initial }: { meId: string; initial: Account[] }) {
  const [accounts, setAccounts] = useState(initial);
  const [form, setForm] = useState({ name: "", email: "", role: "staff" as "admin" | "staff", password: "" });
  const [resetting, setResetting] = useState<string | null>(null);
  const [typed, setTyped] = useState("");
  const [shown, setShown] = useState<{ email: string; password: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [adding, setAdding] = useState(false);

  async function call(url: string, method: string, body?: unknown) {
    setBusy(true);
    setError("");
    setOk("");
    try {
      const response = await fetch(url, {
        method,
        headers: body === undefined ? undefined : { "content-type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.error ?? "Something went wrong — please try again.");
        return null;
      }
      return data;
    } catch {
      setError("Could not reach the server");
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function create(event: React.FormEvent, generate: boolean) {
    event.preventDefault();
    const data = await call("/api/admin/accounts", "POST", { ...form, generate, password: generate ? undefined : form.password });
    if (!data) return;
    setAccounts((list) => [...list, { ...data.account, providerName: null }]);
    if (data.password) setShown({ email: data.account.email, password: data.password });
    else setOk(`Account made for ${data.account.email}`);
    setForm({ name: "", email: "", role: "staff", password: "" });
    setAdding(false);
  }

  async function reset(account: Account, generate: boolean) {
    const data = await call(`/api/admin/admins/${account.id}`, "PATCH", generate ? { generate: true } : { password: typed });
    if (!data) return;
    setResetting(null);
    setTyped("");
    if (data.password) setShown({ email: account.email, password: data.password });
    else setOk(`New password set for ${account.email}. They're signed out everywhere.`);
  }

  async function remove(account: Account) {
    if (!window.confirm(`Remove the sign-in for ${account.email}? They won't be able to sign in any more.`)) return;
    const data = await call(`/api/admin/admins/${account.id}`, "DELETE");
    if (data) setAccounts((list) => list.filter((item) => item.id !== account.id));
  }

  return (
    <div className="mt-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[14px] text-plum-soft">{accounts.length} accounts</p>
        <button
          type="button"
          className={BTN_PRIMARY}
          onClick={() => {
            setError("");
            setOk("");
            setAdding(true);
          }}
        >
          + Add someone
        </button>
      </div>
      {!adding && (
        <>
          <Notice tone="error">{error}</Notice>
          <Notice tone="ok">{ok}</Notice>
        </>
      )}

      {shown && (
        <div role="status" className="rounded-2xl border-2 border-sage bg-sage-soft p-5">
          <p className="font-semibold text-sage-ink">New password for {shown.email}</p>
          <p className="mt-2 select-all rounded-lg bg-white px-4 py-3 font-mono text-[1.25rem] tracking-wide text-plum">{shown.password}</p>
          <p className="mt-2 text-[14px] text-sage-ink">
            Shown only now — copy it and give it to them in person or by phone, not by email. They sign in at /login.
          </p>
          <div className="mt-3 flex gap-2">
            <button type="button" className={BTN_QUIET} onClick={() => void navigator.clipboard?.writeText(shown.password)}>
              Copy
            </button>
            <button type="button" className={BTN_QUIET} onClick={() => setShown(null)}>
              Done
            </button>
          </div>
        </div>
      )}

      <section className={`${CARD} overflow-x-auto p-0`}>
        <table className="w-full min-w-[860px] text-left text-[14px]">
          <thead className="border-b border-mist text-[12px] uppercase tracking-wide text-plum-soft">
            <tr>
              <th scope="col" className="px-5 py-3 font-semibold">Who</th>
              <th scope="col" className="px-5 py-3 font-semibold">Sign-in email (user ID)</th>
              <th scope="col" className="px-5 py-3 font-semibold">Role</th>
              <th scope="col" className="px-5 py-3 font-semibold">Last sign-in</th>
              <th scope="col" className="px-5 py-3 font-semibold">Password</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-mist">
            {accounts.map((account) => (
              <tr key={account.id} className="align-top">
                <td className="px-5 py-3">
                  <p className="font-semibold text-plum">{account.providerName ?? account.name}</p>
                  {account.id === meId && <p className="text-[12px] text-plum-soft">That&apos;s you</p>}
                </td>
                <td className="px-5 py-3 font-mono text-[13px]">{account.email}</td>
                <td className="px-5 py-3">
                  <span className={`inline-flex rounded-full px-2.5 py-1 text-[12px] font-semibold ${ROLES[account.role].tone}`}>{ROLES[account.role].label}</span>
                  <p className="mt-1 max-w-[220px] text-[12px] text-plum-soft">{ROLES[account.role].what}</p>
                </td>
                <td className="px-5 py-3 text-plum-soft">{when(account.lastLoginAt)}</td>
                <td className="px-5 py-3">
                  {account.id === meId ? (
                    <Link href="/admin/settings" className="text-[13px] font-semibold text-wine underline">
                      Change yours in Settings
                    </Link>
                  ) : resetting === account.id ? (
                    <div className="max-w-[260px] space-y-2">
                      <input
                        type="text"
                        autoComplete="new-password"
                        value={typed}
                        onChange={(event) => setTyped(event.target.value)}
                        placeholder="New password (6+ characters)"
                        className={`${FIELD} py-2 text-[14px]`}
                        aria-label={`New password for ${account.email}`}
                      />
                      <div className="flex flex-wrap gap-2">
                        <button type="button" className={BTN_PRIMARY} disabled={busy || typed.length < 6} onClick={() => void reset(account, false)}>
                          Set
                        </button>
                        <button type="button" className={BTN_QUIET} disabled={busy} onClick={() => void reset(account, true)}>
                          Make one up
                        </button>
                        <button type="button" className={BTN_QUIET} onClick={() => setResetting(null)}>
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      <button type="button" className={BTN_QUIET} onClick={() => { setResetting(account.id); setTyped(""); }}>
                        Reset password
                      </button>
                      {account.role === "provider" ? (
                        <Link href={`/admin/doctors/${account.providerId}`} className={BTN_QUIET}>
                          Doctor page
                        </Link>
                      ) : (
                        <button type="button" className={BTN_DANGER} disabled={busy} onClick={() => void remove(account)}>
                          Remove
                        </button>
                      )}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {adding && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="new-account"
          className="fixed inset-0 z-[90] flex items-end justify-center bg-plum/50 p-0 sm:items-center sm:p-6"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setAdding(false);
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") setAdding(false);
          }}
        >
          <div className={`${CARD} max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-b-none sm:rounded-2xl`}>
            <form onSubmit={(event) => void create(event, false)} className="space-y-0" aria-labelledby="new-account">
              <div className="flex items-start justify-between gap-3">
                <h2 id="new-account" className="text-[1.2rem] font-semibold">Add someone</h2>
                <button type="button" className={BTN_QUIET} onClick={() => setAdding(false)}>
                  Close
                </button>
              </div>
              <p className="mt-1 text-[14px] text-plum-soft">
                Front desk for the team, admin for full access. Doctors get their sign-in on their own page under Doctors.
              </p>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <label className="block">
                  <span className={LABEL}>Name</span>
                  <input required autoFocus value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} className={FIELD} />
                </label>
                <label className="block">
                  <span className={LABEL}>Email (they sign in with it)</span>
                  <input required type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} className={FIELD} />
                </label>
                <label className="block">
                  <span className={LABEL}>Access</span>
                  <select value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value as "admin" | "staff" })} className={FIELD}>
                    <option value="staff">Front desk — website, bookings, slots, chats, email</option>
                    <option value="admin">Admin — everything</option>
                  </select>
                </label>
                <label className="block">
                  <span className={LABEL}>Password (6+ characters)</span>
                  <input type="text" autoComplete="new-password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} className={FIELD} />
                </label>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <button type="submit" className={BTN_PRIMARY} disabled={busy || form.password.length < 6}>
                  Add with this password
                </button>
                <button type="button" className={BTN_QUIET} disabled={busy || !form.email} onClick={(event) => void create(event as unknown as React.FormEvent, true)}>
                  Add and make up a password
                </button>
              </div>
              <Notice tone="error">{error}</Notice>
              <Notice tone="ok">{ok}</Notice>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
