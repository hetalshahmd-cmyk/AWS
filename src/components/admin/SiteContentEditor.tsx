"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { photos, type PhotoKey } from "@/lib/photos";
import { site } from "@/lib/site";
import type { HeroSlide, ImageRef, Office, SiteContent } from "@/lib/site-content";
import { resolveImage } from "@/lib/site-images";
import { BTN_DANGER, BTN_PRIMARY, BTN_QUIET, CARD, FIELD, LABEL, Notice } from "./ui";

const MAX_SLIDES = 6;
const LIBRARY = Object.keys(photos) as PhotoKey[];

/** "50% 40%" -> [50, 40] */
function parsePoint(point: string): [number, number] {
  const match = point.match(/^(\d{1,3})% (\d{1,3})%$/);
  return match ? [Number(match[1]), Number(match[2])] : [50, 50];
}

/** Google Maps search link for an address. */
function mapsFor(address: [string, string]): string {
  const query = `${address[0]} ${address[1]}`.replace(/[,#]/g, " ").trim().split(/\s+/).join("+");
  return `https://www.google.com/maps/search/?api=1&query=${query}`;
}

/**
 * Admin → Modify site: the home page hero (words and pictures) and the two
 * office cards (name, address, phone, directions link, picture).
 */
export default function SiteContentEditor({ initial }: { initial: SiteContent }) {
  const router = useRouter();
  const [content, setContent] = useState(initial);
  // What is live now — "Undo changes" goes back to it.
  const [saved, setSaved] = useState(initial);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");

  const change = (next: SiteContent) => {
    setContent(next);
    setDirty(true);
    setOk("");
  };
  const hero = content.hero;
  const setHero = (patch: Partial<SiteContent["hero"]>) => change({ ...content, hero: { ...hero, ...patch } });
  const setSlide = (index: number, patch: Partial<HeroSlide>) =>
    setHero({ slides: hero.slides.map((slide, i) => (i === index ? { ...slide, ...patch } : slide)) });
  const moveSlide = (index: number, by: number) => {
    const slides = [...hero.slides];
    const [item] = slides.splice(index, 1);
    slides.splice(index + by, 0, item);
    setHero({ slides });
  };
  const setOffice = (id: string, patch: Partial<Office>) =>
    change({ ...content, offices: content.offices.map((office) => (office.id === id ? { ...office, ...patch } : office)) });

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setOk("");
    try {
      const response = await fetch("/api/admin/site", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(content),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? "Could not save");
        return;
      }
      setContent(data.content);
      setSaved(data.content);
      setDirty(false);
      setOk("Saved — the website shows the changes within a minute.");
      router.refresh();
    } catch {
      setError("Could not reach the server");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} className="mt-6 space-y-6">
      {(error || ok) && (
        <div aria-live="polite" className="sticky top-2 z-20 -mb-3">
          <Notice tone="error">{error}</Notice>
          <Notice tone="ok">{ok}</Notice>
        </div>
      )}

      {/* ------------------------------------------------------ hero text -- */}
      <section className={CARD} aria-labelledby="hero-words">
        <h2 id="hero-words" className="text-[1.15rem] font-semibold">
          Home page — top section
        </h2>
        <p className="mt-1 text-[14px] text-plum-soft">The words over the pictures at the top of the home page.</p>

        <div className="mt-5 grid gap-5 min-[1100px]:grid-cols-[1fr_420px]">
          <div className="grid gap-4">
            <label>
              <span className={LABEL}>Small heading (above the headline)</span>
              <input value={hero.eyebrow} onChange={(e) => setHero({ eyebrow: e.target.value })} maxLength={120} className={FIELD} />
            </label>
            <div className="grid gap-4 min-[640px]:grid-cols-2">
              <label>
                <span className={LABEL}>Headline</span>
                <input value={hero.title} onChange={(e) => setHero({ title: e.target.value })} maxLength={120} required className={FIELD} />
              </label>
              <label>
                <span className={LABEL}>Highlighted end of the headline (italic)</span>
                <input value={hero.emphasis} onChange={(e) => setHero({ emphasis: e.target.value })} maxLength={80} className={FIELD} />
              </label>
            </div>
            <label>
              <span className={LABEL}>Text under the headline</span>
              <textarea rows={3} value={hero.body} onChange={(e) => setHero({ body: e.target.value })} maxLength={400} required className={FIELD} />
              <span className="mt-1 block text-right text-[12px] text-plum-soft">{hero.body.length}/400</span>
            </label>
            <p className="text-[13px] text-plum-soft">
              The buttons under it stay the same: <strong>Book Now</strong> and <strong>Call {site.phone}</strong>.
            </p>
          </div>

          {/* A small look at the result, with the first picture. */}
          <div aria-hidden="true" className="relative aspect-[16/10] overflow-hidden rounded-xl bg-plum">
            {hero.slides[0] && (
              <Picture image={hero.slides[0].image} position={hero.slides[0].image.position} sizes="420px" />
            )}
            <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(29,22,25,.85)_0%,rgba(29,22,25,.55)_45%,rgba(29,22,25,0)_80%)]" />
            <div className="absolute inset-y-0 left-0 flex w-[68%] flex-col justify-center gap-1.5 p-5 text-white">
              <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-white/80">{hero.eyebrow}</p>
              <p className="font-display text-[1.3rem] leading-[1.05]">
                {hero.title} <em className="text-[#f3d7dd]">{hero.emphasis}</em>
              </p>
              <p className="line-clamp-3 text-[10px] leading-snug text-white/80">{hero.body}</p>
            </div>
            <span className="absolute right-2 top-2 rounded-full bg-white/90 px-2 py-0.5 text-[11px] font-semibold text-plum">Preview</span>
          </div>
        </div>
      </section>

      {/* --------------------------------------------------- hero pictures -- */}
      <section className={CARD} aria-labelledby="hero-pictures">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="hero-pictures" className="text-[1.15rem] font-semibold">
              Top section — pictures ({hero.slides.length}/{MAX_SLIDES})
            </h2>
            <p className="mt-1 text-[14px] text-plum-soft">
              They change every 7 seconds. Each has a short caption shown in the corner.
            </p>
          </div>
          <button
            type="button"
            disabled={hero.slides.length >= MAX_SLIDES}
            onClick={() =>
              setHero({
                slides: [
                  ...hero.slides,
                  {
                    image: { photo: "clinicConsultWide", url: null, alt: "", position: "50% 50%" },
                    mobilePosition: "50% 50%",
                    title: "New picture",
                    body: "",
                  },
                ],
              })
            }
            className={BTN_QUIET}
          >
            + Add picture
          </button>
        </div>

        <ol className="mt-5 space-y-5">
          {hero.slides.map((slide, index) => (
            <li key={index} className="rounded-xl border border-mist p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold">Picture {index + 1}</p>
                <div className="flex gap-2">
                  <button type="button" disabled={index === 0} onClick={() => moveSlide(index, -1)} className={BTN_QUIET} aria-label={`Move picture ${index + 1} up`}>
                    ↑
                  </button>
                  <button
                    type="button"
                    disabled={index === hero.slides.length - 1}
                    onClick={() => moveSlide(index, 1)}
                    className={BTN_QUIET}
                    aria-label={`Move picture ${index + 1} down`}
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    disabled={hero.slides.length <= 1}
                    onClick={() => setHero({ slides: hero.slides.filter((_, i) => i !== index) })}
                    className={BTN_DANGER}
                  >
                    Remove
                  </button>
                </div>
              </div>
              <div className="mt-4 grid gap-5 min-[1100px]:grid-cols-[1fr_1fr]">
                <ImageField
                  image={slide.image}
                  onChange={(image) => setSlide(index, { image })}
                  onError={setError}
                  phone={{ position: slide.mobilePosition, onChange: (mobilePosition) => setSlide(index, { mobilePosition }) }}
                />
                <div className="grid content-start gap-4">
                  <label>
                    <span className={LABEL}>Caption</span>
                    <input value={slide.title} onChange={(e) => setSlide(index, { title: e.target.value })} maxLength={60} required className={FIELD} />
                  </label>
                  <label>
                    <span className={LABEL}>Caption text</span>
                    <textarea rows={3} value={slide.body} onChange={(e) => setSlide(index, { body: e.target.value })} maxLength={200} className={FIELD} />
                  </label>
                </div>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* --------------------------------------------------------- offices -- */}
      <section className={CARD} aria-labelledby="office-cards">
        <h2 id="office-cards" className="text-[1.15rem] font-semibold">
          Office cards
        </h2>
        <p className="mt-1 text-[14px] text-plum-soft">
          Shown on the home and contact pages. The name and address are also used in the booking
          form, emails, calendar invites, the footer and the admin panel. Hours come from the
          weekly schedule.
        </p>

        <div className="mt-5 grid gap-5 min-[1200px]:grid-cols-2">
          {content.offices.map((office, index) => (
            <fieldset key={office.id} className="rounded-xl border border-mist p-4">
              <legend className="px-1 font-semibold">
                Office {String(index + 1).padStart(2, "0")} — {office.name}
              </legend>
              <div className="grid gap-4">
                <div className="grid gap-4 min-[640px]:grid-cols-2">
                  <label>
                    <span className={LABEL}>Office name</span>
                    <input value={office.name} onChange={(e) => setOffice(office.id, { name: e.target.value })} maxLength={60} required className={FIELD} />
                  </label>
                  <label>
                    <span className={LABEL}>Short name (area)</span>
                    <input value={office.area} onChange={(e) => setOffice(office.id, { area: e.target.value })} maxLength={40} required className={FIELD} />
                  </label>
                </div>
                <label>
                  <span className={LABEL}>Street address</span>
                  <input
                    value={office.address[0]}
                    onChange={(e) => setOffice(office.id, { address: [e.target.value, office.address[1]] })}
                    maxLength={100}
                    required
                    className={FIELD}
                  />
                </label>
                <label>
                  <span className={LABEL}>City, state and ZIP</span>
                  <input
                    value={office.address[1]}
                    onChange={(e) => setOffice(office.id, { address: [office.address[0], e.target.value] })}
                    maxLength={100}
                    required
                    className={FIELD}
                  />
                </label>
                <label>
                  <span className={LABEL}>Phone (empty = main number {site.phone})</span>
                  <input
                    type="tel"
                    value={office.phone ?? ""}
                    onChange={(e) => setOffice(office.id, { phone: e.target.value || null })}
                    placeholder={site.phone}
                    maxLength={20}
                    className={FIELD}
                  />
                </label>
                <div>
                  <label>
                    <span className={LABEL}>Directions link (Google Maps)</span>
                    <input type="url" value={office.maps} onChange={(e) => setOffice(office.id, { maps: e.target.value })} required className={FIELD} />
                  </label>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button type="button" onClick={() => setOffice(office.id, { maps: mapsFor(office.address) })} className={BTN_QUIET}>
                      Make link from the address
                    </button>
                    <a href={office.maps} target="_blank" rel="noopener noreferrer" className={BTN_QUIET}>
                      Test link ↗
                    </a>
                  </div>
                </div>
                <div>
                  <p className={LABEL}>Card picture</p>
                  <ImageField image={office.image} onChange={(image) => setOffice(office.id, { image })} onError={setError} />
                </div>
              </div>
            </fieldset>
          ))}
        </div>
      </section>

      {/* A bar, not a floating button, so it never sits on top of a field. */}
      <div className="sticky bottom-0 z-10 flex flex-wrap items-center justify-end gap-3 rounded-t-xl border border-mist bg-white/95 px-4 py-3 shadow-[0_-8px_24px_-18px_rgba(44,32,38,.45)] backdrop-blur">
        <p className="mr-auto text-[14px] text-plum-soft" aria-live="polite">
          {dirty ? "You have unsaved changes." : "All changes saved."}
        </p>
        {dirty && (
          <button
            type="button"
            onClick={() => {
              setContent(saved);
              setDirty(false);
              setError("");
            }}
            className={BTN_QUIET}
          >
            Undo changes
          </button>
        )}
        <button type="submit" disabled={busy || !dirty} className={BTN_PRIMARY}>
          {busy ? "Saving…" : dirty ? "Save changes" : "Saved"}
        </button>
      </div>
    </form>
  );
}

/** A library photo or an upload, cropped at a focus point. */
function Picture({ image, position, sizes }: { image: ImageRef; position: string; sizes: string }) {
  const { src, alt } = resolveImage(image);
  return (
    <Image
      src={src}
      alt={alt}
      fill
      sizes={sizes}
      unoptimized={typeof src === "string"}
      className="object-cover"
      style={{ objectPosition: position }}
    />
  );
}

/** Click a preview to set where the crop centres; the dot shows it. */
function FocusPreview({
  image,
  position,
  onChange,
  label,
  className,
}: {
  image: ImageRef;
  position: string;
  onChange: (position: string) => void;
  label: string;
  className: string;
}) {
  const [x, y] = parsePoint(position);
  return (
    <figure>
      <button
        type="button"
        onClick={(event) => {
          const box = event.currentTarget.getBoundingClientRect();
          const px = Math.round(((event.clientX - box.left) / box.width) * 100);
          const py = Math.round(((event.clientY - box.top) / box.height) * 100);
          onChange(`${Math.min(100, Math.max(0, px))}% ${Math.min(100, Math.max(0, py))}%`);
        }}
        aria-label={`${label}: click where the picture should stay in view`}
        className={`focus-ring relative block w-full cursor-crosshair overflow-hidden rounded-lg bg-shell ${className}`}
      >
        <Picture image={image} position={position} sizes="360px" />
        <span
          aria-hidden="true"
          className="absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-wine shadow"
          style={{ left: `${x}%`, top: `${y}%` }}
        />
      </button>
      <figcaption className="mt-1 text-[12px] text-plum-soft">{label}</figcaption>
    </figure>
  );
}

function ImageField({
  image,
  onChange,
  onError,
  phone,
}: {
  image: ImageRef;
  onChange: (image: ImageRef) => void;
  onError: (message: string) => void;
  /** Hero pictures also crop to a tall shape on phones. */
  phone?: { position: string; onChange: (position: string) => void };
}) {
  const [library, setLibrary] = useState(false);
  const [uploading, setUploading] = useState(false);
  const libraryAlt = image.photo ? photos[image.photo].alt : "";

  async function upload(file: File | null) {
    if (!file) return;
    setUploading(true);
    onError("");
    try {
      const body = new FormData();
      body.set("image", file);
      const response = await fetch("/api/admin/site/images", { method: "POST", body });
      const data = await response.json();
      if (!response.ok) {
        onError(data.error ?? "Could not upload the picture");
        return;
      }
      onChange({ ...image, photo: null, url: data.url, alt: "", position: "50% 50%" });
      if (phone) phone.onChange("50% 50%");
    } catch {
      onError("Could not reach the server");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div>
      <div className={phone ? "grid grid-cols-[1fr_90px] items-start gap-3" : ""}>
        <FocusPreview
          image={image}
          position={image.position}
          onChange={(position) => onChange({ ...image, position })}
          label={phone ? "Computer — click to set the focus point" : "Click to set the focus point"}
          className="aspect-[16/9]"
        />
        {phone && (
          <FocusPreview image={image} position={phone.position} onChange={phone.onChange} label="Phone" className="aspect-[9/14]" />
        )}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" onClick={() => setLibrary(!library)} aria-expanded={library} className={BTN_QUIET}>
          {library ? "Close library" : "Choose from library"}
        </button>
        <label className={`${BTN_QUIET} cursor-pointer`}>
          {uploading ? "Uploading…" : "Upload new picture"}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            disabled={uploading}
            onChange={(event) => {
              upload(event.target.files?.[0] ?? null);
              event.target.value = "";
            }}
          />
        </label>
      </div>
      <p className="mt-1 text-[12px] text-plum-soft">JPEG, PNG or WebP up to 8 MB — wide pictures (at least 1600 px) look best.</p>

      {library && (
        <div className="mt-3 grid max-h-72 grid-cols-3 gap-2 overflow-y-auto rounded-lg border border-mist p-2 min-[640px]:grid-cols-4">
          {LIBRARY.map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => {
                onChange({ ...image, photo: key, url: null, alt: "" });
                setLibrary(false);
              }}
              aria-pressed={image.photo === key && !image.url}
              title={photos[key].alt}
              className={`focus-ring relative aspect-[4/3] overflow-hidden rounded-md ring-offset-2 ${
                image.photo === key && !image.url ? "ring-2 ring-wine" : ""
              }`}
            >
              <Image src={photos[key].src} alt={photos[key].alt} fill sizes="160px" className="object-cover" />
            </button>
          ))}
        </div>
      )}

      <label className="mt-3 block">
        <span className={LABEL}>Picture description (read aloud to blind visitors){image.url ? "" : " — optional"}</span>
        <input
          value={image.alt}
          onChange={(e) => onChange({ ...image, alt: e.target.value })}
          placeholder={libraryAlt}
          required={Boolean(image.url)}
          maxLength={200}
          className={FIELD}
        />
      </label>
    </div>
  );
}
