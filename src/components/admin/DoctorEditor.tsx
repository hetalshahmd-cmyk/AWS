"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PasswordInput } from "@/components/form-fields";
import ProviderAvatar from "@/components/site/ProviderAvatar";
import { AVATAR_COLORS, ctaFor, initialsOf, ZOCDOC_STALE_DAYS, zocdocAgeDays, type Provider } from "@/lib/providers";
import { reasonLabel } from "@/lib/i18n";
import { officeById, WEEKDAY_NAMES, type ScheduleRow } from "@/lib/scheduling";
import { BTN_DANGER, BTN_PRIMARY, BTN_QUIET, CARD, FIELD, LABEL, Notice } from "./ui";

/** The form's own shape: lists edited as text, one item per line. */
type Draft = {
  name: string;
  cred: string;
  languages: string;
  npi: string;
  cta: string;
  avatar: string;
  active: boolean;
  about: string;
  education: string;
  certifications: string;
  focus: string;
  zocdocUrl: string;
  zocdocRating: string;
  zocdocReviews: string;
  ecwUrl: string;
};

function toDraft(provider: Provider | null): Draft {
  return {
    name: provider?.name ?? "",
    cred: provider?.cred ?? "",
    languages: provider?.languages.join(", ") ?? "English, Spanish",
    npi: provider?.npi ?? "",
    cta: provider?.cta ?? "",
    avatar: provider?.avatar ?? AVATAR_COLORS[0],
    active: provider?.active ?? true,
    // Paragraphs are separated by a blank line.
    about: provider?.about.join("\n\n") ?? "",
    education: provider?.education.join("\n") ?? "",
    certifications: provider?.certifications.join("\n") ?? "",
    focus: provider?.focus.join("\n") ?? "",
    zocdocUrl: provider?.zocdocUrl ?? "",
    zocdocRating: provider?.zocdocRating?.toString() ?? "",
    zocdocReviews: provider?.zocdocReviews?.toString() ?? "",
    ecwUrl: provider?.ecwUrl ?? "",
  };
}

function toPayload(draft: Draft) {
  return {
    ...draft,
    about: draft.about.split(/\n\s*\n/).map((paragraph) => paragraph.replace(/\s*\n\s*/g, " ").trim()).filter(Boolean),
    education: draft.education.split("\n"),
    certifications: draft.certifications.split("\n"),
    focus: draft.focus.split("\n"),
    languages: draft.languages,
    cta: draft.cta.trim() || ctaFor(draft.name),
  };
}

/**
 * Admin → Doctors → one provider: profile (what patients see), photo,
 * whether they appear on the site, and their sign-in for their own panel.
 */
export default function DoctorEditor({
  initial,
  login,
  today,
  allReasons,
  reasons,
  scheduleRows,
}: {
  initial: Provider | null;
  login: string | null;
  today: string;
  allReasons: string[];
  /** The visit reasons this provider's booking form offers. */
  reasons: string[];
  /** This provider's rows in the fixed weekly schedule. */
  scheduleRows: ScheduleRow[];
}) {
  const [checkedNow, setCheckedNow] = useState(false);
  const router = useRouter();
  const [provider, setProvider] = useState(initial);
  const [draft, setDraft] = useState(() => toDraft(initial));
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");

  const set = (key: keyof Draft) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setDraft({ ...draft, [key]: event.target.value });
    setDirty(true);
    setOk("");
  };

  // What the avatar preview shows while editing.
  const preview: Provider = {
    ...(provider ?? {
      id: "new",
      photo: null,
      photoUrl: null,
      order: 0,
      languages: [],
      about: [],
      education: [],
      certifications: [],
      focus: [],
      zocdocRating: null,
      zocdocReviews: null,
      zocdocCheckedAt: null,
      zocdocUrl: null,
      ecwUrl: null,
      npi: "",
      cta: "",
      active: true,
    }),
    name: draft.name,
    cred: draft.cred,
    initials: initialsOf(draft.name),
    avatar: draft.avatar,
  } as Provider;

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setOk("");
    try {
      const response = await fetch(provider ? `/api/admin/doctors/${provider.id}` : "/api/admin/doctors", {
        method: provider ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...toPayload(draft), zocdocCheckedNow: checkedNow }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? "Could not save");
        return;
      }
      setDirty(false);
      if (!provider) {
        router.push(`/admin/doctors/${data.provider.id}`);
        router.refresh();
        return;
      }
      setProvider(data.provider);
      setDraft(toDraft(data.provider));
      setCheckedNow(false);
      setOk("Saved — the website shows the new details within a minute.");
      router.refresh();
    } catch {
      setError("Could not reach the server");
    } finally {
      setBusy(false);
    }
  }

  async function upload(file: File | null) {
    if (!file || !provider) return;
    setBusy(true);
    setError("");
    setOk("");
    try {
      const body = new FormData();
      body.set("photo", file);
      const response = await fetch(`/api/admin/doctors/${provider.id}/photo`, { method: "POST", body });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? "Could not upload the photo");
        return;
      }
      setProvider(data.provider);
      setOk("Photo updated.");
      router.refresh();
    } catch {
      setError("Could not reach the server");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-6 space-y-6">
      {(error || ok) && (
        <div aria-live="polite" className="sticky top-2 z-10 -mb-3">
          <Notice tone="error">{error}</Notice>
          <Notice tone="ok">{ok}</Notice>
        </div>
      )}

      <form onSubmit={save} className="space-y-6">
        {/* ----------------------------------------------------- profile -- */}
        <section className={CARD}>
          <div className="flex flex-wrap items-center gap-5">
            <ProviderAvatar provider={preview} size="md" />
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-semibold uppercase tracking-wide text-plum-soft">Photo</p>
              {provider ? (
                <label className={`${BTN_QUIET} mt-2 cursor-pointer`}>
                  {provider.photoUrl || provider.photo ? "Replace photo" : "Upload photo"}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="sr-only"
                    disabled={busy}
                    onChange={(event) => upload(event.target.files?.[0] ?? null)}
                  />
                </label>
              ) : (
                <p className="mt-1 text-[14px] text-plum-soft">Save the profile first, then add a photo.</p>
              )}
              <p className="mt-2 text-[13px] text-plum-soft">Square JPEG, PNG or WebP, up to 4 MB.</p>
            </div>
            <fieldset>
              <legend className="text-[13px] font-semibold uppercase tracking-wide text-plum-soft">
                Colour (no photo)
              </legend>
              <div className="mt-2 flex gap-2">
                {AVATAR_COLORS.map((color) => (
                  <label key={color} className="cursor-pointer">
                    <input
                      type="radio"
                      name="avatar"
                      value={color}
                      checked={draft.avatar === color}
                      onChange={() => {
                        setDraft({ ...draft, avatar: color });
                        setDirty(true);
                      }}
                      className="peer sr-only"
                    />
                    <span
                      aria-label={color}
                      className={`block h-8 w-8 rounded-full bg-linear-to-br ${color} ring-offset-2 peer-checked:ring-2 peer-checked:ring-plum peer-focus-visible:ring-2 peer-focus-visible:ring-wine`}
                    />
                  </label>
                ))}
              </div>
            </fieldset>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className={LABEL}>Full name, with credentials</span>
              <input required value={draft.name} onChange={set("name")} placeholder="Dr. Jane Doe, MD" className={FIELD} />
            </label>
            <label className="block">
              <span className={LABEL}>Title</span>
              <input required value={draft.cred} onChange={set("cred")} placeholder="Nurse Practitioner (OB-GYN)" className={FIELD} />
            </label>
            <label className="block">
              <span className={LABEL}>Languages (comma separated)</span>
              <input required value={draft.languages} onChange={set("languages")} className={FIELD} />
            </label>
            <label className="block">
              <span className={LABEL}>NPI (10 digits)</span>
              <input value={draft.npi} onChange={set("npi")} inputMode="numeric" maxLength={10} className={FIELD} />
            </label>
            <label className="block">
              <span className={LABEL}>Booking button text</span>
              <input value={draft.cta} onChange={set("cta")} placeholder={ctaFor(draft.name || "Jane Doe")} className={FIELD} />
            </label>
            <label className="flex items-center gap-3 self-end rounded-lg border border-line-strong px-3 py-2.5">
              <input
                type="checkbox"
                checked={draft.active}
                onChange={(event) => {
                  setDraft({ ...draft, active: event.target.checked });
                  setDirty(true);
                }}
                className="h-4 w-4 accent-wine"
              />
              <span className="text-[15px]">
                <span className="font-semibold">Show on the website</span>
                <span className="block text-[13px] text-plum-soft">Off hides the profile and booking; past bookings stay.</span>
              </span>
            </label>
          </div>
        </section>

        {/* ------------------------------------------------------- about -- */}
        <section className={CARD}>
          <h2 className="text-[1.1rem] font-semibold">About &amp; background</h2>
          <div className="mt-4 grid gap-4">
            <label className="block">
              <span className={LABEL}>About (leave a blank line between paragraphs)</span>
              <textarea rows={6} value={draft.about} onChange={set("about")} className={FIELD} />
            </label>
            <div className="grid gap-4 md:grid-cols-3">
              <label className="block">
                <span className={LABEL}>Education &amp; training (one per line)</span>
                <textarea rows={4} value={draft.education} onChange={set("education")} className={FIELD} />
              </label>
              <label className="block">
                <span className={LABEL}>Board certifications (one per line)</span>
                <textarea rows={4} value={draft.certifications} onChange={set("certifications")} className={FIELD} />
              </label>
              <label className="block">
                <span className={LABEL}>Patients often book for (one per line)</span>
                <textarea rows={4} value={draft.focus} onChange={set("focus")} className={FIELD} />
              </label>
            </div>
          </div>
        </section>

        {/* ----------------------------------------------- other listings -- */}
        <section className={CARD}>
          <h2 className="text-[1.1rem] font-semibold">Zocdoc &amp; eCW</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <label className="block md:col-span-2">
              <span className={LABEL}>Zocdoc profile link</span>
              <input type="url" value={draft.zocdocUrl} onChange={set("zocdocUrl")} placeholder="https://www.zocdoc.com/doctor/…" className={FIELD} />
            </label>
            <label className="block">
              <span className={LABEL}>Zocdoc rating (0–5)</span>
              <input value={draft.zocdocRating} onChange={set("zocdocRating")} inputMode="decimal" placeholder="4.93" className={FIELD} />
            </label>
            <label className="block">
              <span className={LABEL}>Zocdoc reviews</span>
              <input value={draft.zocdocReviews} onChange={set("zocdocReviews")} inputMode="numeric" placeholder="15" className={FIELD} />
            </label>
            {provider && (
              <div
                className={`rounded-lg px-3 py-2.5 text-[14px] md:col-span-2 ${
                  (zocdocAgeDays(provider, today) ?? Infinity) > ZOCDOC_STALE_DAYS
                    ? "bg-[#fff6e5] text-[#7a4b00]"
                    : "bg-shell text-plum-soft"
                }`}
              >
                <p>
                  {provider.zocdocCheckedAt
                    ? `Rating and reviews last checked against Zocdoc ${zocdocAgeDays(provider, today)} day(s) ago (${provider.zocdocCheckedAt}).`
                    : "Rating and reviews have never been checked against Zocdoc."}{" "}
                  Zocdoc can&apos;t be read automatically — open the profile, compare, and update.
                </p>
                <label className="mt-2 flex items-center gap-2 font-medium text-plum">
                  <input
                    type="checkbox"
                    checked={checkedNow}
                    onChange={(event) => {
                      setCheckedNow(event.target.checked);
                      setDirty(true);
                    }}
                    className="h-4 w-4 accent-wine"
                  />
                  I checked Zocdoc today — the numbers above are current
                </label>
              </div>
            )}
            <label className="block md:col-span-2">
              <span className={LABEL}>eCW / healow booking link</span>
              <input type="url" value={draft.ecwUrl} onChange={set("ecwUrl")} placeholder="https://healow.com/…" className={FIELD} />
              <span className="mt-1 block text-[13px] text-plum-soft">
                Empty: the eCW button shows the office phone instead.
              </span>
            </label>
          </div>
        </section>

        {/* A bar, not a floating button, so it never sits on top of a field. */}
        <div className="sticky bottom-0 z-10 flex flex-wrap items-center justify-end gap-3 rounded-t-xl border border-mist bg-white/95 px-4 py-3 shadow-[0_-8px_24px_-18px_rgba(44,32,38,.45)] backdrop-blur">
          <p className="mr-auto text-[14px] text-plum-soft" aria-live="polite">
            {dirty ? "You have unsaved changes." : provider ? "All changes saved." : "New doctor — not saved yet."}
          </p>
          <button type="submit" disabled={busy || (!dirty && Boolean(provider))} className={BTN_PRIMARY}>
            {busy ? "Saving…" : provider ? (dirty ? "Save profile" : "Saved") : "Add doctor"}
          </button>
        </div>
      </form>

      {provider && <Reasons providerId={provider.id} all={allReasons} initial={reasons} />}
      {provider && <Schedule rows={scheduleRows} />}
      {provider && <SignIn providerId={provider.id} initialEmail={login} />}
    </div>
  );
}

/** The doctor's own sign-in: email (their ID) and password. */
function SignIn({ providerId, initialEmail }: { providerId: string; initialEmail: string | null }) {
  const router = useRouter();
  const [email, setEmail] = useState(initialEmail ?? "");
  const [current, setCurrent] = useState(initialEmail);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setOk("");
    try {
      const response = await fetch(`/api/admin/doctors/${providerId}/login`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? "Could not save the sign-in");
        return;
      }
      setOk(
        current
          ? password
            ? "Sign-in updated. The doctor is signed out everywhere and uses the new password."
            : "Sign-in email updated."
          : "Sign-in created. Share the email and password with the doctor privately.",
      );
      setCurrent(data.email);
      setPassword("");
      router.refresh();
    } catch {
      setError("Could not reach the server");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!window.confirm("Remove this doctor's sign-in? Their profile and bookings stay.")) return;
    setBusy(true);
    setError("");
    setOk("");
    try {
      const response = await fetch(`/api/admin/doctors/${providerId}/login`, { method: "DELETE" });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? "Could not remove the sign-in");
        return;
      }
      setCurrent(null);
      setEmail("");
      setOk("Sign-in removed.");
      router.refresh();
    } catch {
      setError("Could not reach the server");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={CARD}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-[1.1rem] font-semibold">Sign-in for the doctor&apos;s panel</h2>
          <p className="mt-1 text-[14px] text-plum-soft">
            {current
              ? `Signs in at /admin/login as ${current} and sees only their own appointments.`
              : "No sign-in yet. Create one so the doctor can see their own appointments."}
          </p>
        </div>
        {current && (
          <button type="button" onClick={remove} disabled={busy} className={BTN_DANGER}>
            Remove sign-in
          </button>
        )}
      </div>
      <form onSubmit={save} className="mt-4 grid gap-4 md:grid-cols-[1fr_1fr_auto] md:items-end">
        <label className="block">
          <span className={LABEL}>Email (sign-in ID)</span>
          <input
            type="email"
            required
            autoComplete="off"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className={FIELD}
          />
        </label>
        <label className="block">
          <span className={LABEL}>{current ? "New password (leave empty to keep)" : "Password"}</span>
          <PasswordInput
            required={!current}
            minLength={12}
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="At least 12 characters"
            className={FIELD}
          />
        </label>
        <button type="submit" disabled={busy} className={BTN_PRIMARY}>
          {busy ? "Saving…" : current ? "Update sign-in" : "Create sign-in"}
        </button>
      </form>
      <Notice tone="error">{error}</Notice>
      <Notice tone="ok">{ok}</Notice>
    </section>
  );
}

/** Which visit reasons this provider's booking form offers. */
function Reasons({ providerId, all, initial }: { providerId: string; all: string[]; initial: string[] }) {
  const [ticked, setTicked] = useState(() => new Set(initial));
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");

  function toggle(reason: string) {
    const next = new Set(ticked);
    if (next.has(reason)) next.delete(reason);
    else next.add(reason);
    setTicked(next);
    setDirty(true);
    setOk("");
  }

  async function save() {
    setBusy(true);
    setError("");
    setOk("");
    try {
      const response = await fetch(`/api/admin/doctors/${providerId}/reasons`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reasons: all.filter((reason) => ticked.has(reason)) }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? "Could not save the visit reasons");
        return;
      }
      setDirty(false);
      setOk(`Saved — ${data.reasons.length} visit reasons on this provider's booking form.`);
    } catch {
      setError("Could not reach the server");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={CARD}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-[1.1rem] font-semibold">Visit reasons</h2>
          <p className="mt-1 text-[14px] text-plum-soft">
            What patients can choose in this provider&apos;s booking form. {ticked.size} of {all.length} ticked.
          </p>
        </div>
        <div className="flex gap-2">
          <button type="button" className={BTN_QUIET} onClick={() => { setTicked(new Set(all)); setDirty(true); }}>
            All
          </button>
          <button type="button" className={BTN_QUIET} onClick={() => { setTicked(new Set()); setDirty(true); }}>
            None
          </button>
        </div>
      </div>
      <div className="mt-4 grid gap-x-6 gap-y-1.5 sm:grid-cols-2 lg:grid-cols-3">
        {all.map((reason) => (
          <label key={reason} className="flex items-start gap-2 py-1 text-[14px]">
            <input
              type="checkbox"
              checked={ticked.has(reason)}
              onChange={() => toggle(reason)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-wine"
            />
            {reasonLabel(reason, "en")}
          </label>
        ))}
      </div>
      <button type="button" onClick={save} disabled={busy || !dirty || ticked.size === 0} className={`${BTN_PRIMARY} mt-4`}>
        {busy ? "Saving…" : dirty ? "Save visit reasons" : "Saved"}
      </button>
      {ticked.size === 0 && <Notice tone="error">Pick at least one visit reason.</Notice>}
      <Notice tone="error">{error}</Notice>
      <Notice tone="ok">{ok}</Notice>
    </section>
  );
}

/** Where and when this provider works in the fixed weekly schedule. */
function Schedule({ rows }: { rows: ScheduleRow[] }) {
  const order = [1, 2, 3, 4, 5, 6, 0];
  const sorted = [...rows].sort((a, b) => order.indexOf(a.weekday) - order.indexOf(b.weekday));
  return (
    <section className={CARD}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-[1.1rem] font-semibold">Weekly schedule</h2>
          <p className="mt-1 text-[14px] text-plum-soft">
            This provider&apos;s days in the fixed weekly schedule — every week follows it unless changed.
          </p>
        </div>
        <Link href="/admin/slots" className={BTN_QUIET}>
          Edit in Appointment slots →
        </Link>
      </div>
      {sorted.length === 0 ? (
        <p className="mt-4 rounded-lg bg-[#fff6e5] px-3 py-2.5 text-[14px] text-[#7a4b00]">
          Not on the weekly schedule yet, so patients can&apos;t book them. Open Appointment slots, add
          this provider to their days, and choose &ldquo;Save as fixed schedule (every week)&rdquo;.
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-mist rounded-xl border border-mist">
          {sorted.map((row) => (
            <li key={`${row.weekday}-${row.officeId}`} className="flex flex-wrap gap-x-4 gap-y-1 px-4 py-2.5 text-[14px]">
              <span className="w-24 font-semibold">{WEEKDAY_NAMES[row.weekday]}</span>
              <span className="w-36 text-plum-soft">{officeById(row.officeId)?.name ?? row.officeId}</span>
              <span>{row.times.join(", ")}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
