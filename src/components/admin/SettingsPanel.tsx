"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { PasswordInput } from "@/components/form-fields";
import type { Admin } from "@/lib/models";
import { BTN_DANGER, BTN_PRIMARY, BTN_QUIET, CARD, FIELD, LABEL, Notice } from "./ui";

type Msg = { tone: "ok" | "error"; text: string };

async function send(url: string, method: string, body?: unknown): Promise<{ ok: boolean; data: Record<string, unknown> }> {
  try {
    const response = await fetch(url, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    return { ok: response.ok, data: await response.json().catch(() => ({})) };
  } catch {
    return { ok: false, data: { error: "Could not reach the server" } };
  }
}

/** Admin → Settings: your own account, and the other admins. */
export default function SettingsPanel({ me, initialAdmins }: { me: Admin; initialAdmins: Admin[] }) {
  return (
    <div className="mt-6 space-y-6">
      <MyAccount me={me} />
      <Admins me={me} initial={initialAdmins} />
    </div>
  );
}

function MyAccount({ me }: { me: Admin }) {
  const router = useRouter();
  const [name, setName] = useState(me.name);
  const [email, setEmail] = useState(me.email);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<Msg | null>(null);
  const needsCurrent = email.trim().toLowerCase() !== me.email || next.length > 0;

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMsg(null);
    const { ok, data } = await send("/api/admin/account", "PATCH", {
      name,
      email,
      currentPassword: current,
      newPassword: next,
    });
    setBusy(false);
    if (!ok) {
      setMsg({ tone: "error", text: String(data.error ?? "Could not save") });
      return;
    }
    setCurrent("");
    setNext("");
    setMsg({
      tone: "ok",
      text: next ? "Saved. Your password is changed and other browsers were signed out." : "Saved.",
    });
    router.refresh();
  }

  return (
    <form onSubmit={save} className={CARD}>
      <h2 className="text-[1.1rem] font-semibold">My account</h2>
      <p className="mt-1 text-[14px] text-plum-soft">
        Your name, the email you sign in with, and your password.
      </p>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <label className="block">
          <span className={LABEL}>Name</span>
          <input required value={name} onChange={(event) => setName(event.target.value)} className={FIELD} />
        </label>
        <label className="block">
          <span className={LABEL}>Sign-in email</span>
          <input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} className={FIELD} />
        </label>
        <label className="block">
          <span className={LABEL}>New password (leave empty to keep)</span>
          <PasswordInput
            minLength={12}
            autoComplete="new-password"
            value={next}
            onChange={(event) => setNext(event.target.value)}
            placeholder="At least 12 characters"
            className={FIELD}
          />
        </label>
        <label className="block">
          <span className={LABEL}>Current password {needsCurrent ? "(required)" : ""}</span>
          <PasswordInput
            required={needsCurrent}
            autoComplete="current-password"
            value={current}
            onChange={(event) => setCurrent(event.target.value)}
            placeholder={needsCurrent ? "To confirm it's you" : "Only to change email or password"}
            className={FIELD}
          />
        </label>
      </div>
      <button type="submit" disabled={busy} className={`${BTN_PRIMARY} mt-5`}>
        {busy ? "Saving…" : "Save my account"}
      </button>
      {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
    </form>
  );
}

function Admins({ me, initial }: { me: Admin; initial: Admin[] }) {
  const [admins, setAdmins] = useState(initial);
  const [resetting, setResetting] = useState<string | null>(null);
  const [resetPassword, setResetPassword] = useState("");
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<Msg | null>(null);

  async function add(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMsg(null);
    const { ok, data } = await send("/api/admin/admins", "POST", form);
    setBusy(false);
    if (!ok) {
      setMsg({ tone: "error", text: String(data.error ?? "Could not add the admin") });
      return;
    }
    setAdmins([...admins, data.admin as Admin]);
    setForm({ name: "", email: "", password: "" });
    setMsg({ tone: "ok", text: "Admin added. Share the email and password with them privately." });
  }

  async function reset(id: string) {
    setBusy(true);
    setMsg(null);
    const { ok, data } = await send(`/api/admin/admins/${id}`, "PATCH", { password: resetPassword });
    setBusy(false);
    if (!ok) {
      setMsg({ tone: "error", text: String(data.error ?? "Could not set the password") });
      return;
    }
    setResetting(null);
    setResetPassword("");
    setMsg({ tone: "ok", text: "Password set. That admin was signed out everywhere." });
  }

  async function remove(admin: Admin) {
    if (!window.confirm(`Remove ${admin.email}? They can no longer sign in.`)) return;
    setBusy(true);
    setMsg(null);
    const { ok, data } = await send(`/api/admin/admins/${admin.id}`, "DELETE");
    setBusy(false);
    if (!ok) {
      setMsg({ tone: "error", text: String(data.error ?? "Could not remove") });
      return;
    }
    setAdmins(admins.filter((item) => item.id !== admin.id));
    setMsg({ tone: "ok", text: `${admin.email} removed.` });
  }

  return (
    <section className={CARD}>
      <h2 className="text-[1.1rem] font-semibold">Admins</h2>
      <p className="mt-1 text-[14px] text-plum-soft">
        People with full access to this panel. Doctors&apos; sign-ins are under Doctors.
      </p>

      <ul className="mt-4 divide-y divide-mist rounded-xl border border-mist">
        {admins.map((admin) => (
          <li key={admin.id} className="px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold">
                  {admin.name} {admin.id === me.id && <span className="text-[13px] font-normal text-plum-soft">(you)</span>}
                </p>
                <p className="text-[14px] text-plum-soft">{admin.email}</p>
              </div>
              {admin.id !== me.id && (
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      setResetting(resetting === admin.id ? null : admin.id);
                      setResetPassword("");
                    }}
                    className={BTN_QUIET}
                  >
                    Set new password
                  </button>
                  <button type="button" disabled={busy} onClick={() => remove(admin)} className={BTN_DANGER}>
                    Remove
                  </button>
                </div>
              )}
            </div>
            {resetting === admin.id && (
              <div className="mt-3 flex flex-wrap items-end gap-2">
                <label className="block min-w-60 flex-1">
                  <span className={LABEL}>New password for {admin.email}</span>
                  <PasswordInput
                    minLength={12}
                    autoComplete="new-password"
                    value={resetPassword}
                    onChange={(event) => setResetPassword(event.target.value)}
                    placeholder="At least 12 characters"
                    className={FIELD}
                  />
                </label>
                <button type="button" disabled={busy || resetPassword.length < 12} onClick={() => reset(admin.id)} className={BTN_PRIMARY}>
                  Save password
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>

      <form onSubmit={add} className="mt-5 grid gap-3 md:grid-cols-[1fr_1fr_1fr_auto] md:items-end">
        <label className="block">
          <span className={LABEL}>Name</span>
          <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} className={FIELD} />
        </label>
        <label className="block">
          <span className={LABEL}>Email</span>
          <input type="email" required value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} className={FIELD} />
        </label>
        <label className="block">
          <span className={LABEL}>Password</span>
          <PasswordInput
            required
            minLength={12}
            autoComplete="new-password"
            value={form.password}
            onChange={(event) => setForm({ ...form, password: event.target.value })}
            placeholder="At least 12 characters"
            className={FIELD}
          />
        </label>
        <button type="submit" disabled={busy} className={BTN_PRIMARY}>
          Add admin
        </button>
      </form>
      {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
    </section>
  );
}
