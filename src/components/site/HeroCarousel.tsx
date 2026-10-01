"use client";

import Image, { type StaticImageData } from "next/image";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import Ico from "./Ico";

export type HeroSlide = {
  image: StaticImageData;
  alt: string;
  /** Where to anchor the crop: desktop is landscape, phones are portrait. */
  focus: { desktop: string; mobile: string };
  caption: { title: string; body: string };
};

const INTERVAL_MS = 7000;

function subscribeMotion(onChange: () => void) {
  const query = window.matchMedia("(prefers-reduced-motion: reduce)");
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

/**
 * Full-bleed photographic hero.
 *
 * Accessibility: it is a labelled carousel region; each slide is a labelled
 * group; arrow keys move between slides; autoplay pauses on hover, on focus,
 * when the tab is hidden, and never starts for people who asked for reduced
 * motion. A visible pause control is always there (WCAG 2.2.2).
 */
export default function HeroCarousel({
  slides,
  children,
}: {
  slides: HeroSlide[];
  /**
   * The hero copy, rendered once (it holds the page's h1). It sits under the
   * photo on phones and over it on wide screens, so it must style itself for
   * both: dark text by default, white from 900px up.
   */
  children: React.ReactNode;
}) {
  const [index, setIndex] = useState(0);
  const [userPaused, setUserPaused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(false);
  const reducedMotion = useSyncExternalStore(
    subscribeMotion,
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => true,
  );
  const regionRef = useRef<HTMLElement>(null);

  const count = slides.length;
  const go = useCallback((next: number) => setIndex((next + count) % count), [count]);

  const autoplay = !userPaused && !reducedMotion;
  const running = autoplay && !hovered && !focused && !hidden && count > 1;

  useEffect(() => {
    const onVisibility = () => setHidden(document.visibilityState === "hidden");
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  useEffect(() => {
    if (!running) return;
    const timer = window.setTimeout(() => go(index + 1), INTERVAL_MS);
    return () => window.clearTimeout(timer);
  }, [running, index, go]);

  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key === "ArrowRight") {
      event.preventDefault();
      go(index + 1);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      go(index - 1);
    }
  }

  const current = slides[index];

  const controls = (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={() => go(index - 1)}
        aria-label="Previous slide"
        className="focus-ring grid h-11 w-11 place-items-center rounded-full border border-current/30 transition hover:bg-current/10"
      >
        <Ico name="back" className="h-[18px] w-[18px]" />
      </button>
      <button
        type="button"
        onClick={() => go(index + 1)}
        aria-label="Next slide"
        className="focus-ring grid h-11 w-11 place-items-center rounded-full border border-current/30 transition hover:bg-current/10"
      >
        <Ico name="arrow" className="h-[18px] w-[18px]" />
      </button>
      {!reducedMotion && (
        <button
          type="button"
          onClick={() => setUserPaused((prev) => !prev)}
          aria-label={userPaused ? "Play slideshow" : "Pause slideshow"}
          className="focus-ring grid h-11 w-11 place-items-center rounded-full border border-current/30 transition hover:bg-current/10"
        >
          <Ico name={userPaused ? "play" : "pause"} className="h-4 w-4" />
        </button>
      )}
    </div>
  );

  const dots = (
    <div className="flex items-center gap-2">
      {slides.map((slide, i) => (
        <button
          key={slide.caption.title}
          type="button"
          onClick={() => go(i)}
          aria-label={`Show slide ${i + 1}: ${slide.caption.title}`}
          aria-current={i === index ? "true" : undefined}
          className="focus-ring group relative flex h-11 items-center"
        >
          <span
            className={`relative block h-[3px] overflow-hidden rounded-full bg-current/25 transition-all duration-500 ${
              i === index ? "w-14" : "w-6 group-hover:w-9"
            }`}
          >
            {i === index && (
              <span
                key={`${index}-${running}`}
                data-running={running}
                style={{ ["--hero-interval" as string]: `${INTERVAL_MS}ms` }}
                className={`hero-progress absolute inset-0 origin-left rounded-full bg-current ${
                  running ? "" : "scale-x-100"
                }`}
              />
            )}
          </span>
        </button>
      ))}
    </div>
  );

  return (
    <section
      ref={regionRef}
      aria-roledescription="carousel"
      aria-label="Arizona Women Specialists — care at a glance"
      onKeyDown={onKeyDown}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={(event) => {
        if (!regionRef.current?.contains(event.relatedTarget as Node)) setFocused(false);
      }}
      className="relative bg-ivory min-[900px]:h-[min(calc(100svh-104px),880px)] min-[900px]:min-h-[620px]"
    >
      {/* ------------------------------------------------------- photos -- */}
      <div
        aria-live={running ? "off" : "polite"}
        className="relative h-[min(68svh,560px)] overflow-hidden min-[900px]:absolute min-[900px]:inset-0 min-[900px]:h-auto"
      >
        {slides.map((slide, i) => (
          <div
            key={slide.caption.title}
            role="group"
            aria-roledescription="slide"
            aria-label={`${i + 1} of ${count}: ${slide.caption.title}`}
            aria-hidden={i !== index}
            data-active={i === index}
            className={`hero-slide absolute inset-0 transition-opacity duration-[1400ms] ease-[cubic-bezier(.22,1,.36,1)] ${
              i === index ? "opacity-100" : "opacity-0"
            }`}
          >
            <div className="hero-zoom absolute inset-0">
              <Image
                src={slide.image}
                alt={slide.alt}
                fill
                sizes="100vw"
                placeholder="blur"
                preload={i === 0}
                className="object-cover [object-position:var(--focus-mobile)] min-[900px]:[object-position:var(--focus-desktop)]"
                style={
                  {
                    "--focus-mobile": slide.focus.mobile,
                    "--focus-desktop": slide.focus.desktop,
                  } as React.CSSProperties
                }
              />
            </div>
          </div>
        ))}

        {/* Wide screens: a soft wash on the left, where the copy sits. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 hidden bg-[linear-gradient(90deg,rgba(29,22,25,.82)_0%,rgba(29,22,25,.66)_32%,rgba(29,22,25,.18)_62%,rgba(29,22,25,0)_78%)] min-[900px]:block"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-[linear-gradient(0deg,rgba(29,22,25,.55),rgba(29,22,25,0))]"
        />

        {/* Phones: caption and controls ride on the photo. */}
        <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-4 px-5 pb-3 text-white min-[900px]:hidden">
          <p className="pb-3 text-[0.9rem] font-medium">
            <span className="text-white/70">
              {index + 1} / {count} ·{" "}
            </span>
            {current.caption.title}
          </p>
          {dots}
        </div>
      </div>

      {/* ---------------------------------------------------------- copy -- */}
      <div className="min-[900px]:pointer-events-none min-[900px]:absolute min-[900px]:inset-0">
        <div className="mx-auto flex h-full w-full max-w-[1240px] flex-col justify-center px-[clamp(20px,5vw,48px)] pb-12 pt-9 min-[900px]:pb-28 min-[900px]:pt-0">
          <div className="max-w-[600px] text-plum min-[900px]:pointer-events-auto min-[900px]:text-white">
            {children}
          </div>
          <div className="mt-8 text-plum min-[900px]:hidden">{controls}</div>
        </div>
      </div>

      {/* ------------------------------------- controls, wide screens -- */}
      <div className="pointer-events-none absolute inset-0 hidden min-[900px]:block">
        <div className="pointer-events-auto absolute inset-x-0 bottom-0">
          <div className="mx-auto flex w-full max-w-[1240px] items-end justify-between gap-8 px-[clamp(20px,5vw,48px)] pb-8 text-white">
            <div className="flex items-end gap-8">
              {dots}
              <div className="max-w-[340px] border-l border-white/30 pl-5">
                <p className="text-[0.72rem] font-semibold uppercase tracking-[0.2em] text-white/65">
                  {String(index + 1).padStart(2, "0")} / {String(count).padStart(2, "0")}
                </p>
                <p className="mt-1 font-display text-[1.15rem] leading-snug">
                  {current.caption.title}
                </p>
                <p className="mt-0.5 line-clamp-2 text-[0.88rem] text-white/75">
                  {current.caption.body}
                </p>
              </div>
            </div>
            {controls}
          </div>
        </div>
      </div>
    </section>
  );
}
