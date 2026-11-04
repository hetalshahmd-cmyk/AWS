"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { LanguageToggle, useLang } from "@/components/lang-context";
import Ico from "@/components/site/Ico";
import type { Intake } from "@/lib/models";

/**
 * What the form starts from: the saved check-in, minus the photo ids and the
 * health answers (no longer asked, so never sent to the browser).
 */
export type CheckInInitial = Omit<
  Intake,
  | "cardFrontId"
  | "cardBackId"
  | "photoIdId"
  | "submittedAt"
  | "allergies"
  | "medications"
  | "conditions"
  | "surgeries"
  | "lmp"
  | "pregnant"
  | "pregnancies"
> & {
  hasCardFront: boolean;
  hasCardBack: boolean;
  hasPhotoId: boolean;
  submitted: boolean;
};

const FIELD =
  "focus-ring w-full rounded-xl border border-mist bg-white px-4 py-3 text-[16px] transition-colors placeholder:text-plum-soft/60 hover:border-plum/30 focus-visible:border-wine";
const LABEL = "mb-1.5 block text-[14px] font-medium text-plum";

/**
 * Phone photos are often 4–12 MB. Shrink to 1600px JPEG in the browser so the
 * upload is quick on mobile data; formats the browser can't draw (some HEIC)
 * go up as they are, within the server's size limit.
 */
async function shrink(file: File): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.82),
    );
    return blob ?? file;
  } catch {
    return file;
  }
}

/**
 * One photo: take it with the camera or pick one already on the phone (or
 * computer), then see it before sending. On a computer "Take photo" opens
 * the file picker too.
 */
function PhotoField({
  name,
  label,
  onFile,
  hasExisting,
  chosen,
}: {
  name: string;
  label: string;
  onFile: (file: File | null) => void;
  hasExisting: boolean;
  chosen: File | null;
}) {
  const { tr } = useLang();
  // A local link to the chosen picture, released when it changes.
  const preview = useMemo(() => (chosen ? URL.createObjectURL(chosen) : null), [chosen]);
  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);
  // Some formats (HEIC on most computers) can't be shown; then the name is.
  const [failed, setFailed] = useState<string | null>(null);
  const previewFailed = failed !== null && failed === preview;

  const BUTTON =
    "focus-within:outline-2 focus-within:outline-wine inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border border-plum/20 bg-white px-4 text-[14px] font-medium text-plum transition hover:border-plum";
  const pick = (event: React.ChangeEvent<HTMLInputElement>) => {
    onFile(event.target.files?.[0] ?? null);
    // Picking the same picture again after removing it still counts.
    event.target.value = "";
  };

  return (
    <div className="rounded-2xl border border-mist bg-white p-4">
      <p className="text-[14px] font-medium text-plum">{label}</p>

      {chosen && preview && !previewFailed ? (
        // eslint-disable-next-line @next/next/no-img-element -- a local preview of the patient's own photo
        <img
          src={preview}
          alt={`${label} — ${tr.photoPreview}`}
          onError={() => setFailed(preview)}
          className="mt-3 max-h-48 w-full rounded-xl border border-mist bg-shell object-contain"
        />
      ) : chosen ? (
        <p className="mt-3 truncate text-[14px] text-sage-ink">✓ {chosen.name}</p>
      ) : hasExisting ? (
        <p className="mt-3 text-[14px] text-sage-ink">✓ {tr.photoOnFile}</p>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <label className={BUTTON}>
          {chosen || hasExisting ? tr.retakePhoto : tr.takePhoto}
          <input type="file" name={`${name}-camera`} accept="image/*" capture="environment" className="sr-only" onChange={pick} />
        </label>
        <label className={BUTTON}>
          {tr.chooseFromPhone}
          <input type="file" name={name} accept="image/*" className="sr-only" onChange={pick} />
        </label>
        {chosen && (
          <button type="button" onClick={() => onFile(null)} className="focus-ring text-[14px] font-medium text-plum-soft link-underline">
            {tr.removePhoto}
          </button>
        )}
      </div>
    </div>
  );
}

export default function CheckInForm({
  token,
  initial,
  hasInsurance,
}: {
  token: string;
  initial: CheckInInitial;
  hasInsurance: boolean;
}) {
  const { lang, tr } = useLang();
  const [form, setForm] = useState(initial);
  const [files, setFiles] = useState<Record<string, File | null>>({
    cardFront: null,
    cardBack: null,
    photoId: null,
  });
  const [attest, setAttest] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  const set = (key: keyof CheckInInitial) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm({ ...form, [key]: event.target.value });

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const body = new FormData();
      for (const key of [
        "phone",
        "street",
        "city",
        "state",
        "zip",
        "emergencyName",
        "emergencyPhone",
        "memberId",
        "groupNumber",
      ] as const) {
        body.set(key, String(form[key] ?? ""));
      }
      body.set("attest", attest ? "yes" : "no");
      for (const [key, file] of Object.entries(files)) {
        if (!file) continue;
        const small = await shrink(file);
        if (small.size > 6 * 1024 * 1024) {
          setError(tr.photoTooBig);
          return;
        }
        body.set(key, small, small === file ? file.name : `${key}.jpg`);
      }
      const response = await fetch(`/api/appointments/${token}/intake`, { method: "POST", body });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? tr.serverDown);
        return;
      }
      setSaved(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      setError(tr.serverDown);
    } finally {
      setBusy(false);
    }
  }

  if (saved) {
    return (
      <div lang={lang} className="rounded-[24px] border border-mist bg-white p-8 text-center">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-sage-soft text-sage-ink">
          <Ico name="check" className="h-6 w-6" />
        </span>
        <p className="mt-4 font-display text-[1.5rem] text-plum">{tr.checkInSaved}</p>
        <Link
          href={`/appointment/${token}`}
          className="focus-ring mt-6 inline-flex min-h-11 items-center rounded-full bg-wine px-6 font-medium text-white transition hover:bg-wine-deep"
        >
          {tr.backToAppointment}
        </Link>
      </div>
    );
  }

  return (
    <form lang={lang} onSubmit={submit}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href={`/appointment/${token}`}
          className="focus-ring text-[15px] font-medium text-plum-soft link-underline"
        >
          ← {tr.backToAppointment}
        </Link>
        <LanguageToggle />
      </div>
      <h1 className="mt-5 font-display text-[clamp(2rem,4.5vw,2.8rem)] font-normal leading-tight text-plum">
        {tr.checkInTitle}
      </h1>
      <p className="mt-2 max-w-[56ch] text-plum-soft">{tr.checkInIntro}</p>

      <fieldset className="mt-8">
        <legend className="font-display text-[1.35rem] text-plum">{tr.contactDetails}</legend>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className={LABEL}>{tr.phone}</span>
            <input type="tel" autoComplete="tel" value={form.phone} onChange={set("phone")} className={FIELD} />
          </label>
          <label className="block sm:col-span-2">
            <span className={LABEL}>{tr.street}</span>
            <input autoComplete="street-address" value={form.street} onChange={set("street")} className={FIELD} />
          </label>
          <label className="block">
            <span className={LABEL}>{tr.city}</span>
            <input autoComplete="address-level2" value={form.city} onChange={set("city")} className={FIELD} />
          </label>
          <div className="grid grid-cols-2 gap-4">
            <label className="block">
              <span className={LABEL}>{tr.state}</span>
              <input autoComplete="address-level1" value={form.state} onChange={set("state")} className={FIELD} />
            </label>
            <label className="block">
              <span className={LABEL}>{tr.zip}</span>
              <input inputMode="numeric" autoComplete="postal-code" value={form.zip} onChange={set("zip")} className={FIELD} />
            </label>
          </div>
          <label className="block">
            <span className={LABEL}>{tr.emergencyName}</span>
            <input value={form.emergencyName} onChange={set("emergencyName")} className={FIELD} />
          </label>
          <label className="block">
            <span className={LABEL}>{tr.emergencyPhone}</span>
            <input type="tel" value={form.emergencyPhone} onChange={set("emergencyPhone")} className={FIELD} />
          </label>
        </div>
      </fieldset>

      <fieldset className="mt-10">
        <legend className="font-display text-[1.35rem] text-plum">
          {hasInsurance ? tr.insuranceSection : tr.idSection}
        </legend>
        {hasInsurance && (
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className={LABEL}>{tr.memberId}</span>
              <input value={form.memberId} onChange={set("memberId")} className={FIELD} />
            </label>
            <label className="block">
              <span className={LABEL}>{tr.groupNumber}</span>
              <input value={form.groupNumber} onChange={set("groupNumber")} className={FIELD} />
            </label>
          </div>
        )}
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {hasInsurance && (
            <>
              <PhotoField
                name="cardFront"
                label={tr.cardFront}
                hasExisting={initial.hasCardFront}
                chosen={files.cardFront}
                onFile={(file) => setFiles({ ...files, cardFront: file })}
              />
              <PhotoField
                name="cardBack"
                label={tr.cardBack}
                hasExisting={initial.hasCardBack}
                chosen={files.cardBack}
                onFile={(file) => setFiles({ ...files, cardBack: file })}
              />
            </>
          )}
          <PhotoField
            name="photoId"
            label={tr.photoId}
            hasExisting={initial.hasPhotoId}
            chosen={files.photoId}
            onFile={(file) => setFiles({ ...files, photoId: file })}
          />
        </div>
      </fieldset>

      <label className="mt-10 flex items-start gap-3 rounded-2xl border border-mist bg-white p-4 text-[15px] text-plum">
        <input
          type="checkbox"
          required
          checked={attest}
          onChange={(event) => setAttest(event.target.checked)}
          className="mt-1 h-4 w-4 accent-wine"
        />
        {tr.attest}
      </label>

      {error && (
        <p role="alert" className="mt-4 rounded-xl bg-wine-soft px-4 py-3 text-[15px] text-wine-deep">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={busy}
        className="focus-ring mt-6 min-h-12 w-full rounded-full bg-wine px-6 py-3 text-[16px] font-medium text-white shadow-[0_12px_28px_-14px_rgba(124,44,62,.9)] transition hover:bg-wine-deep disabled:opacity-60"
      >
        {busy ? tr.saving : tr.submitCheckIn}
      </button>
    </form>
  );
}
