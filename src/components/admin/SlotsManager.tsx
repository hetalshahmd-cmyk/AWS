"use client";

import { useMemo, useState } from "react";
import type { Slot } from "@/lib/models";
import { formatShort } from "@/lib/availability";
import { BTN_PRIMARY, BTN_QUIET, CARD, FIELD, LABEL, Notice } from "./ui";

const WEEKDAYS = [
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
  { value: 0, label: "Sun" },
];

const PRESETS: Record<string, string[]> = {
  Mornings: ["8:00 am", "8:45 am", "9:30 am", "10:15 am", "11:00 am", "11:45 am"],
  Afternoons: ["1:00 pm", "1:45 pm", "2:30 pm", "3:15 pm", "4:00 pm", "4:45 pm"],
  "Full day": [
    "8:00 am", "8:45 am", "9:30 am", "10:15 am", "11:00 am", "11:45 am",
    "1:00 pm", "1:45 pm", "2:30 pm", "3:15 pm", "4:00 pm", "4:45 pm",
  ],
};

export default function SlotsManager({
  initial,
  from,
  to,
}: {
  initial: Slot[];
  from: string;
  to: string;
}) {
  const [slots, setSlots] = useState(initial);
  const [start, setStart] = useState(from);
  const [end, setEnd] = useState(from);
  const [weekdays, setWeekdays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [times, setTimes] = useState(PRESETS.Mornings.join(", "));
  const [capacity, setCapacity] = useState(1);
  const [busy, setBusy] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");

  const grouped = useMemo(() => {
    const map = new Map<string, Slot[]>();
    for (const slot of slots) map.set(slot.date, [...(map.get(slot.date) ?? []), slot]);
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [slots]);

  async function refresh() {
    const response = await fetch(`/api/admin/slots?from=${from}&to=${to}`);
    if (response.ok) {
      const data = await response.json();
      setSlots(data.slots);
    }
  }

  async function addSlots(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
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
          times: times
            .split(/[,\n]/)
            .map((time) => time.trim())
            .filter(Boolean),
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error ?? "Could not add slots");
        return;
      }
      setOk(
        `Added ${data.added} slot${data.added === 1 ? "" : "s"}` +
          (data.skipped ? ` — ${data.skipped} already existed.` : "."),
      );
      await refresh();
    } catch {
      setError("Could not reach the server");
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
      const response = await fetch(`/api/admin/slots/${slot.id}`, { method: "DELETE" });
      if (!response.ok) {
        const data = await response.json();
        setError(data.error ?? "Could not delete the slot");
        return;
      }
      setSlots((prev) => prev.filter((item) => item.id !== slot.id));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
      <form onSubmit={addSlots} className={`${CARD} h-fit`}>
        <h2 className="font-display text-[1.2rem] font-semibold">Add slots</h2>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div>
            <label className={LABEL} htmlFor="start">
              From
            </label>
            <input
              id="start"
              type="date"
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
            <input
              id="end"
              type="date"
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
                    on ? "bg-wine text-white" : "border border-line-strong bg-white hover:bg-shell"
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

        <button type="submit" disabled={busy} className={`${BTN_PRIMARY} mt-5 w-full`}>
          {busy ? "Adding…" : "Add slots"}
        </button>

        <Notice tone="error">{error}</Notice>
        <Notice tone="ok">{ok}</Notice>
      </form>

      <div>
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-[1.2rem] font-semibold">
            {formatShort(from)} – {formatShort(to)}
          </h2>
          <button type="button" onClick={refresh} className={BTN_QUIET}>
            Refresh
          </button>
        </div>

        {grouped.length === 0 ? (
          <p className={`${CARD} mt-3 text-plum-soft`}>
            No slots in the next four weeks. Add a batch on the left — patients can&apos;t book
            until you do.
          </p>
        ) : (
          <div className="mt-3 space-y-3">
            {grouped.map(([date, daySlots]) => (
              <div key={date} className={CARD}>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="font-semibold">{formatShort(date)}</h3>
                  <p className="text-[13px] text-plum-soft">
                    {daySlots.filter((slot) => slot.active && slot.booked < slot.capacity).length}{" "}
                    open · {daySlots.reduce((sum, slot) => sum + slot.booked, 0)} booked
                  </p>
                </div>

                <ul className="mt-3 flex flex-wrap gap-2">
                  {daySlots.map((slot) => {
                    const full = slot.booked >= slot.capacity;
                    return (
                      <li
                        key={slot.id}
                        className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-[14px] ${
                          !slot.active
                            ? "border-line-strong bg-shell text-plum-soft line-through"
                            : full
                              ? "border-wine/30 bg-wine-soft text-wine-deep"
                              : "border-sage/30 bg-sage-soft text-sage-ink"
                        }`}
                      >
                        <span className="font-semibold">{slot.time}</span>
                        <span className="text-[12px]">
                          {slot.booked}/{slot.capacity}
                        </span>
                        <button
                          type="button"
                          disabled={busyId === slot.id}
                          onClick={() => toggle(slot)}
                          className="focus-ring text-[12px] font-semibold underline underline-offset-2"
                        >
                          {slot.active ? "Off" : "On"}
                        </button>
                        {slot.booked === 0 && (
                          <button
                            type="button"
                            disabled={busyId === slot.id}
                            onClick={() => remove(slot)}
                            aria-label={`Delete ${slot.time}`}
                            className="focus-ring text-[14px] font-bold"
                          >
                            ×
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
