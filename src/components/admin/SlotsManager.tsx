"use client";

import { getProviders } from "@/lib/providers";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Slot } from "@/lib/models";
import type { SlotBooking } from "@/lib/repo";
import { formatShort } from "@/lib/availability";
import { getOffices } from "@/lib/site-content";
import { officeById, shortProviderName, type OfficeId, type ProviderId } from "@/lib/scheduling";
import { BTN_PRIMARY, BTN_QUIET, CARD, FIELD, LABEL, Notice } from "./ui";
import { DateInput } from "@/components/form-fields";

const WEEKDAYS = [
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
  { value: 0, label: "Sun" },
];

type Status = "open" | "booked" | "off";
type StatusFilter = "all" | Status;

/** Off wins over booked: a switched-off time can still hold an earlier booking. */
function statusOf(slot: Slot): Status {
  if (!slot.active) return "off";
  return slot.booked >= slot.capacity ? "booked" : "open";
}

const STATUS_STYLE: Record<Status, { card: string; badge: string; label: string }> = {
  open: {
    card: "border-sage/40 bg-sage-soft/60",
    badge: "bg-sage-ink text-white",
    label: "Open",
  },
  booked: {
    card: "border-wine/30 bg-wine-soft/70",
    badge: "bg-wine text-white",
    label: "Booked",
  },
  off: {
    card: "border-line-strong bg-shell",
    badge: "bg-plum-soft/70 text-white",
    label: "Off",
  },
};

const PRESETS: Record<string, string[]> = {
  Mornings: ["8:00 am", "8:45 am", "9:30 am", "10:15 am", "11:00 am", "11:45 am"],
  Afternoons: ["1:00 pm", "1:45 pm", "2:30 pm", "3:15 pm", "4:00 pm", "4:45 pm"],
  "Full day": [
    "8:00 am",
    "8:45 am",
    "9:30 am",
    "10:15 am",
    "11:00 am",
    "11:45 am",
    "1:00 pm",
    "1:45 pm",
    "2:30 pm",
    "3:15 pm",
    "4:00 pm",
    "4:45 pm",
  ],
};

export default function SlotsManager({
  initial,
  initialBookedBy,
  from,
  to,
  reloadKey = 0,
  onSlotsChanged,
}: {
  initial: Slot[];
  initialBookedBy: Record<string, SlotBooking[]>;
  from: string;
  to: string;
  /** Bumped when the week plan is saved, so the list shows the new times. */
  reloadKey?: number;
  /** Adding or deleting times also edits that week's plan — tell the page. */
  onSlotsChanged?: () => void;
}) {
  const [slots, setSlots] = useState(initial);
  const [bookedBy, setBookedBy] = useState(initialBookedBy);
  const [showStatus, setShowStatus] = useState<StatusFilter>("all");
  const [start, setStart] = useState(from);
  const [end, setEnd] = useState(from);
  const [weekdays, setWeekdays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [times, setTimes] = useState(PRESETS.Mornings.join(", "));
  const [capacity, setCapacity] = useState(1);
  const [officeId, setOfficeId] = useState<OfficeId>(() => getOffices()[0].id);
  const [providerId, setProviderId] = useState<ProviderId>(getProviders()[0].id);
  const [showOffice, setShowOffice] = useState<string>("all");
  const [showProvider, setShowProvider] = useState<string>("all");
  const [busy, setBusy] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");
  const [ok, setOk] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);

  // A new week resets the "Add slots" dates to that week.
  const [shownFrom, setShownFrom] = useState(from);
  if (shownFrom !== from) {
    setShownFrom(from);
    setStart(from);
    setEnd(from);
  }

  // The server already sent the first week; fetch again when it changes.
  const firstLoad = useRef(true);
  useEffect(() => {
    if (firstLoad.current) {
      firstLoad.current = false;
      return;
    }
    let cancelled = false;
    fetch(`/api/admin/slots?from=${from}&to=${to}`, { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (cancelled || !data) return;
        setSlots(data.slots);
        setBookedBy(data.bookedBy ?? {});
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [from, to, reloadKey]);

  function openForm() {
    setFormError("");
    setOk("");
    dialog.current?.showModal();
  }

  // Office/provider filters first, so the totals describe what is selected.
  const inScope = useMemo(
    () =>
      slots.filter(
        (slot) =>
          (showOffice === "all" || slot.officeId === showOffice) &&
          (showProvider === "all" || slot.providerId === showProvider),
      ),
    [slots, showOffice, showProvider],
  );

  const totals = useMemo(() => {
    const counts = { open: 0, booked: 0, off: 0 };
    for (const slot of inScope) counts[statusOf(slot)] += 1;
    return counts;
  }, [inScope]);

  const grouped = useMemo(() => {
    const visible = inScope.filter((slot) => showStatus === "all" || statusOf(slot) === showStatus);
    const map = new Map<string, Slot[]>();
    for (const slot of visible) map.set(slot.date, [...(map.get(slot.date) ?? []), slot]);
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [inScope, showStatus]);

  async function refresh() {
    const response = await fetch(`/api/admin/slots?from=${from}&to=${to}`);
    if (response.ok) {
      const data = await response.json();
      setSlots(data.slots);
      setBookedBy(data.bookedBy ?? {});
    }
  }

  async function addSlots(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setFormError("");
    setOk("");

    try {
      const response = await fetch("/api/admin/slots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          from: start,
          to: end < start ? start : end,
          weekdays,
          capacity,
          officeId,
          providerId,
          times: times
            .split(/[,\n]/)
            .map((time) => time.trim())
            .filter(Boolean),
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        setFormError(data.error ?? "Could not add slots");
        return;
      }
      setOk(
        `Added ${data.added} slot${data.added === 1 ? "" : "s"}` +
          (data.skipped ? ` — ${data.skipped} already existed.` : "."),
      );
      dialog.current?.close();
      await refresh();
      onSlotsChanged?.();
    } catch {
      setFormError("Could not reach the server");
    } finally {
      setBusy(false);
    }
  }

  async function toggle(slot: Slot) {
    setBusyId(slot.id);
    try {
      const response = await fetch(`/api/admin/slots/${slot.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !slot.active }),
      });
      const data = await response.json();
      if (response.ok) {
        setSlots((prev) => prev.map((item) => (item.id === slot.id ? data.slot : item)));
      } else {
        setError(data.error ?? "Could not update the slot");
      }
    } finally {
      setBusyId(null);
    }
  }

  async function remove(slot: Slot) {
    setBusyId(slot.id);
    setError("");
    try {
      const response = await fetch(`/api/admin/slots/${slot.id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const data = await response.json();
        setError(data.error ?? "Could not delete the slot");
        return;
      }
      setSlots((prev) => prev.filter((item) => item.id !== slot.id));
      onSlotsChanged?.();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="mt-6">
      <dialog
        ref={dialog}
        aria-labelledby="add-slots-title"
        className="m-auto w-[min(560px,calc(100vw-32px))] rounded-2xl border border-mist bg-white p-0 text-plum shadow-[0_24px_60px_-20px_rgba(44,32,38,.45)] backdrop:bg-plum/40"
      >
        <form onSubmit={addSlots} className="max-h-[calc(100dvh-48px)] overflow-y-auto p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 id="add-slots-title" className="font-display text-[1.35rem] font-semibold">
                Add slots
              </h2>
              <p className="mt-1 text-[13px] text-plum-soft">
                Extra times are added to that week&apos;s plan above, so saving the plan keeps them.
              </p>
            </div>
            <button
              type="button"
              onClick={() => dialog.current?.close()}
              aria-label="Close"
              className="focus-ring -mr-2 -mt-1 grid h-10 w-10 shrink-0 place-items-center rounded-full text-[22px] leading-none text-plum-soft transition hover:bg-shell hover:text-plum"
            >
              ×
            </button>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <div>
              <label className={LABEL} htmlFor="slot-office">
                Office
              </label>
              <select
                id="slot-office"
                value={officeId}
                onChange={(event) => setOfficeId(event.target.value as OfficeId)}
                className={FIELD}
              >
                {getOffices().map((office) => (
                  <option key={office.id} value={office.id}>
                    {office.area}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={LABEL} htmlFor="slot-provider">
                Provider
              </label>
              <select
                id="slot-provider"
                value={providerId}
                onChange={(event) => setProviderId(event.target.value as ProviderId)}
                className={FIELD}
              >
                {getProviders().map((provider) => (
                  <option key={provider.id} value={provider.id}>
                    {shortProviderName(provider.id)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <div>
              <label className={LABEL} htmlFor="start">
                From
              </label>
              <DateInput
                id="start"
                value={start}
                min={from}
                onChange={(event) => setStart(event.target.value)}
                className={FIELD}
                required
              />
            </div>
            <div>
              <label className={LABEL} htmlFor="end">
                To
              </label>
              <DateInput
                id="end"
                value={end}
                min={start}
                onChange={(event) => setEnd(event.target.value)}
                className={FIELD}
                required
              />
            </div>
          </div>

          <fieldset className="mt-4">
            <legend className={LABEL}>Days of the week</legend>
            <div className="flex flex-wrap gap-1.5">
              {WEEKDAYS.map((day) => {
                const on = weekdays.includes(day.value);
                return (
                  <button
                    key={day.value}
                    type="button"
                    aria-pressed={on}
                    onClick={() =>
                      setWeekdays((prev) =>
                        on ? prev.filter((value) => value !== day.value) : [...prev, day.value],
                      )
                    }
                    className={`focus-ring rounded-lg px-3 py-1.5 text-[14px] font-semibold transition ${
                      on
                        ? "bg-wine text-white"
                        : "border border-line-strong bg-white hover:bg-shell"
                    }`}
                  >
                    {day.label}
                  </button>
                );
              })}
            </div>
            <p className="mt-1.5 text-[12px] text-plum-soft">
              None selected means every day in the range.
            </p>
          </fieldset>

          <div className="mt-4">
            <label className={LABEL} htmlFor="times">
              Times
            </label>
            <textarea
              id="times"
              rows={3}
              value={times}
              onChange={(event) => setTimes(event.target.value)}
              className={`${FIELD} resize-none`}
              placeholder="8:00 am, 9:30 am, 2:45 pm"
            />
            <div className="mt-2 flex flex-wrap gap-1.5">
              {Object.entries(PRESETS).map(([label, preset]) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => setTimes(preset.join(", "))}
                  className="focus-ring rounded-full border border-line-strong bg-white px-3 py-1 text-[13px] transition hover:bg-shell"
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4">
            <label className={LABEL} htmlFor="capacity">
              Patients per time
            </label>
            <input
              id="capacity"
              type="number"
              min={1}
              max={20}
              value={capacity}
              onChange={(event) => setCapacity(Number(event.target.value))}
              className={FIELD}
            />
          </div>

          <Notice tone="error">{formError}</Notice>

          <div className="mt-5 flex gap-2">
            <button
              type="button"
              onClick={() => dialog.current?.close()}
              className={`${BTN_QUIET} flex-1 py-2.5`}
            >
              Cancel
            </button>
            <button type="submit" disabled={busy} className={`${BTN_PRIMARY} flex-1`}>
              {busy ? "Adding…" : "Add slots"}
            </button>
          </div>
        </form>
      </dialog>

      <div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-[1.2rem] font-semibold">
            {formatShort(from)} – {formatShort(to)}
          </h2>
          <button type="button" onClick={openForm} className={BTN_PRIMARY}>
            <span aria-hidden className="text-[18px] leading-none">
              +
            </span>
            Add slots
          </button>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <select
            aria-label="Show office"
            value={showOffice}
            onChange={(event) => setShowOffice(event.target.value)}
            className={`${FIELD} w-auto! py-2`}
          >
            <option value="all">Both offices</option>
            {getOffices().map((office) => (
              <option key={office.id} value={office.id}>
                {office.area}
              </option>
            ))}
          </select>
          <select
            aria-label="Show provider"
            value={showProvider}
            onChange={(event) => setShowProvider(event.target.value)}
            className={`${FIELD} w-auto! py-2`}
          >
            <option value="all">All providers</option>
            {getProviders().map((provider) => (
              <option key={provider.id} value={provider.id}>
                {shortProviderName(provider.id)}
              </option>
            ))}
          </select>
          <button type="button" onClick={refresh} className={BTN_QUIET}>
            Refresh
          </button>
        </div>

        <div aria-live="polite">
          <Notice tone="error">{error}</Notice>
          <Notice tone="ok">{ok}</Notice>
        </div>

        <div role="group" aria-label="Show slots" className="mt-3 flex flex-wrap gap-2">
          {(
            [
              ["all", `All (${totals.open + totals.booked + totals.off})`, "bg-plum"],
              ["open", `Open (${totals.open})`, "bg-sage-ink"],
              ["booked", `Booked (${totals.booked})`, "bg-wine"],
              ["off", `Off (${totals.off})`, "bg-plum-soft/70"],
            ] as const
          ).map(([value, label, dot]) => (
            <button
              key={value}
              type="button"
              aria-pressed={showStatus === value}
              onClick={() => setShowStatus(value)}
              className={`focus-ring inline-flex min-h-10 items-center gap-2 rounded-full px-4 text-[14px] font-semibold transition ${
                showStatus === value
                  ? "bg-plum text-white"
                  : "border border-line-strong bg-white text-plum hover:bg-shell"
              }`}
            >
              {value !== "all" && (
                <span aria-hidden className={`h-2.5 w-2.5 rounded-full ${dot}`} />
              )}
              {label}
            </button>
          ))}
        </div>

        {grouped.length === 0 ? (
          <p className={`${CARD} mt-3 text-plum-soft`}>
            {slots.length === 0
              ? "No times this week. Set the week plan above and save — patients can't book until you do."
              : "No slots match these filters."}
          </p>
        ) : (
          <div className="mt-3 space-y-3">
            {grouped.map(([date, daySlots]) => (
              <div key={date} className={CARD}>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="font-semibold">{formatShort(date)}</h3>
                  <p className="text-[13px] text-plum-soft">
                    <span className="font-semibold text-sage-ink">
                      {daySlots.filter((slot) => statusOf(slot) === "open").length} open
                    </span>{" "}
                    ·{" "}
                    <span className="font-semibold text-wine">
                      {daySlots.filter((slot) => statusOf(slot) === "booked").length} booked
                    </span>
                    {daySlots.some((slot) => !slot.active) &&
                      ` · ${daySlots.filter((slot) => !slot.active).length} off`}
                  </p>
                </div>

                <div className="mt-3 space-y-3">
                  {groupByPerson(daySlots).map((group) => (
                    <div key={group.key}>
                      <p className="text-[13px] font-semibold text-plum">
                        {officeById(group.officeId)?.area ?? "No office"} ·{" "}
                        <span className="font-normal text-plum-soft">
                          {group.providerId ? shortProviderName(group.providerId) : "No provider"}
                        </span>
                      </p>
                      <ul className="mt-1.5 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                        {group.items.map((slot) => {
                          const status = statusOf(slot);
                          const style = STATUS_STYLE[status];
                          const holders = bookedBy[slot.id] ?? [];
                          return (
                            <li
                              key={slot.id}
                              className={`rounded-xl border px-3 py-2.5 text-[14px] ${style.card}`}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span
                                  className={`font-semibold ${status === "off" ? "text-plum-soft line-through" : "text-plum"}`}
                                >
                                  {slot.time}
                                </span>
                                <span
                                  className={`rounded-full px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide ${style.badge}`}
                                >
                                  {style.label}
                                  {slot.capacity > 1 && ` ${slot.booked}/${slot.capacity}`}
                                </span>
                              </div>
                              {holders.length > 0 ? (
                                <ul className="mt-1.5 space-y-0.5">
                                  {holders.map((holder) => (
                                    <li
                                      key={holder.id}
                                      className="flex flex-wrap items-center gap-1.5"
                                    >
                                      <Link
                                        href={`/admin/bookings/${holder.id}`}
                                        className="focus-ring font-medium text-wine-deep underline underline-offset-2"
                                      >
                                        {holder.name}
                                      </Link>
                                      {holder.newPatient && (
                                        <span className="rounded bg-white/80 px-1.5 text-[11px] font-semibold text-plum">
                                          New
                                        </span>
                                      )}
                                      <span
                                        className={`text-[12px] ${holder.checkedIn ? "text-sage-ink" : "text-plum-soft"}`}
                                      >
                                        {holder.checkedIn ? "✓ checked in" : "not checked in"}
                                      </span>
                                    </li>
                                  ))}
                                </ul>
                              ) : (
                                <p className="mt-1.5 text-[13px] text-plum-soft">
                                  {status === "off"
                                    ? "Not bookable"
                                    : "Free — patients can book this"}
                                </p>
                              )}
                              <div className="mt-2 flex gap-3 text-[12px] font-semibold">
                                <button
                                  type="button"
                                  disabled={busyId === slot.id}
                                  onClick={() => toggle(slot)}
                                  className="focus-ring text-plum underline underline-offset-2"
                                >
                                  {slot.active ? "Switch off" : "Switch on"}
                                </button>
                                {slot.booked === 0 && (
                                  <button
                                    type="button"
                                    disabled={busyId === slot.id}
                                    onClick={() => remove(slot)}
                                    aria-label={`Delete ${slot.time}`}
                                    className="focus-ring text-wine underline underline-offset-2"
                                  >
                                    Delete
                                  </button>
                                )}
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

type PersonGroup = {
  key: string;
  officeId: string | null;
  providerId: string | null;
  items: Slot[];
};

/** Splits a day's slots into one row per office + provider, in a stable order. */
function groupByPerson(slots: Slot[]): PersonGroup[] {
  const map = new Map<string, PersonGroup>();
  for (const slot of slots) {
    const key = `${slot.officeId ?? "-"}:${slot.providerId ?? "-"}`;
    const group = map.get(key) ?? {
      key,
      officeId: slot.officeId,
      providerId: slot.providerId,
      items: [],
    };
    group.items.push(slot);
    map.set(key, group);
  }
  return [...map.values()].sort((a, b) => a.key.localeCompare(b.key));
}
