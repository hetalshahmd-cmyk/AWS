"use client";

import { getProviders } from "@/lib/providers";
import { useEffect, useMemo, useRef, useState } from "react";
import { addDays, formatShort } from "@/lib/availability";
import type { MasterSaveResult, WeekSaveResult, WeekSchedule } from "@/lib/repo";
import { getOffices } from "@/lib/site-content";
import {
  arizonaTodayIso,
  mondayOf,
  normaliseTime,
  officeById,
  providerById,
  shortProviderName,
  WEEKDAY_NAMES,
  type OfficeId,
  type ProviderId,
  type ScheduleRow,
} from "@/lib/scheduling";
import { BTN_PRIMARY, BTN_QUIET, CARD, FIELD, Notice } from "./ui";

/** Rows in the editor keep the times as typed until they are saved. */
type Draft = {
  key: string;
  weekday: number;
  officeId: OfficeId;
  providerId: ProviderId;
  times: string;
};

const DAYS = [1, 2, 3, 4, 5, 6, 0];
/** How far ahead a week can be planned. */
const MAX_WEEKS_AHEAD = 12;

let counter = 0;
const nextKey = () => `row-${(counter += 1)}`;

function toDrafts(rows: ScheduleRow[]): Draft[] {
  return rows.map((row) => ({ ...row, key: nextKey(), times: row.times.join(", ") }));
}

function parseTimes(text: string): { times: string[]; bad: string[] } {
  const parts = text
    .split(/[,\n]/)
    .map((part) => part.trim())
    .filter(Boolean);
  const times: string[] = [];
  const bad: string[] = [];
  for (const part of parts) {
    const time = normaliseTime(part);
    if (time) times.push(time);
    else bad.push(part);
  }
  return { times, bad };
}

/** Weekday 0–6 to its date in the week starting `monday`. */
function dateOf(monday: string, weekday: number): string {
  return addDays(monday, (weekday + 6) % 7);
}

export default function ScheduleEditor({
  initial,
  onWeekChange,
  onSaved,
  reloadKey = 0,
}: {
  initial: WeekSchedule;
  /** Tells the page which week is shown, so the slot list below follows it. */
  onWeekChange?: (week: string) => void;
  /** Called after a save changed the week's times. */
  onSaved?: () => void;
  /** Bumped when slots changed elsewhere on the page — reload this week's plan. */
  reloadKey?: number;
}) {
  const today = arizonaTodayIso();
  const thisMonday = mondayOf(today);
  const lastMonday = addDays(thisMonday, MAX_WEEKS_AHEAD * 7);

  const [schedule, setSchedule] = useState(initial);
  const [drafts, setDrafts] = useState<Draft[]>(() => toDrafts(initial.rows));
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [kept, setKept] = useState<WeekSaveResult["keptBooked"]>([]);

  const week = schedule.week;
  const weekLabel = `${formatShort(week)} – ${formatShort(addDays(week, 6))}`;
  const relative =
    week === thisMonday ? "This week" : week === addDays(thisMonday, 7) ? "Next week" : null;

  const problems = useMemo(
    () =>
      drafts.flatMap((draft) => {
        const { times, bad } = parseTimes(draft.times);
        const who = providerById(draft.providerId)?.name;
        const where = `${WEEKDAY_NAMES[draft.weekday]}`;
        if (bad.length) return [`${where}, ${who}: can't read "${bad.join('", "')}" — use 8:30 am`];
        if (times.length === 0) return [`${where}, ${who}: add at least one time`];
        return [];
      }),
    [drafts],
  );

  // The same provider in two offices on one day is almost always a typo.
  const clashes = useMemo(() => {
    const seen = new Map<string, Set<string>>();
    for (const draft of drafts) {
      const key = `${draft.weekday}:${draft.providerId}`;
      seen.set(key, (seen.get(key) ?? new Set()).add(draft.officeId));
    }
    return [...seen.entries()]
      .filter(([, offices]) => offices.size > 1)
      .map(([key]) => {
        const [weekday, providerId] = key.split(":");
        const who = providerById(providerId)?.name;
        return `${who} is in both offices on ${WEEKDAY_NAMES[Number(weekday)]} — check the times don't overlap.`;
      });
  }, [drafts]);

  function edit(next: Draft[]) {
    setDrafts(next);
    setDirty(true);
    setOk("");
    setKept([]);
  }

  function update(key: string, patch: Partial<Draft>) {
    edit(drafts.map((draft) => (draft.key === key ? { ...draft, ...patch } : draft)));
  }

  async function goTo(target: string) {
    if (dirty && !window.confirm("You have unsaved changes for this week. Leave without saving?")) {
      return;
    }
    setBusy(true);
    setError("");
    setOk("");
    setKept([]);
    try {
      const response = await fetch(`/api/admin/schedule?week=${target}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? "Could not load that week");
        return;
      }
      setSchedule(data);
      setDrafts(toDrafts(data.rows));
      setDirty(false);
      onWeekChange?.(data.week);
    } catch {
      setError("Could not reach the server");
    } finally {
      setBusy(false);
    }
  }

  // Slots added or deleted below changed this week's plan on the server:
  // show the new plan, unless the admin is in the middle of editing it.
  const latest = useRef({ week, dirty });
  useEffect(() => {
    latest.current = { week, dirty };
  });
  useEffect(() => {
    if (reloadKey === 0) return;
    let cancelled = false;
    fetch(`/api/admin/schedule?week=${latest.current.week}`, { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((data: WeekSchedule | null) => {
        if (cancelled || !data || latest.current.dirty) return;
        setSchedule(data);
        setDrafts(toDrafts(data.rows));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  /**
   * "week": this week only — it keeps its own schedule from now on.
   * "master": the fixed schedule, for every week that follows it.
   * "reset": this week goes back to following the fixed schedule.
   */
  async function save(mode: "week" | "master" | "reset") {
    if (
      mode !== "reset" &&
      drafts.length === 0 &&
      !window.confirm(
        mode === "master"
          ? "Save an empty fixed schedule? Every week that follows it will close."
          : `Close the whole week of ${weekLabel}? Open times will be removed.`,
      )
    ) {
      return;
    }
    if (
      mode === "master" &&
      !window.confirm(
        "Make this the fixed schedule for every week? Upcoming weeks that follow it update now; weeks changed on their own keep their changes.",
      )
    ) {
      return;
    }
    setBusy(true);
    setError("");
    setOk("");
    setKept([]);
    try {
      const rows = drafts.map((draft) => ({
        weekday: draft.weekday,
        officeId: draft.officeId,
        providerId: draft.providerId,
        times: parseTimes(draft.times).times,
      }));
      const payload =
        mode === "master" ? { master: true, rows } : mode === "reset" ? { week, reset: true } : { week, rows };
      const response = await fetch("/api/admin/schedule", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? "Could not save the schedule");
        return;
      }
      onSaved?.();
      if (mode === "master") {
        const result = data as MasterSaveResult;
        // Read this week back: it may follow the fixed schedule or keep its own.
        const fresh = await fetch(`/api/admin/schedule?week=${week}`, { cache: "no-store" });
        const next = fresh.ok ? ((await fresh.json()) as WeekSchedule) : null;
        if (next) {
          setSchedule(next);
          setDrafts(toDrafts(next.rows));
        }
        setDirty(false);
        setKept(result.keptBooked);
        setOk(
          `Fixed weekly schedule saved — ${result.weeks.length} upcoming week${result.weeks.length === 1 ? "" : "s"} updated. Every new week will follow it.`,
        );
        return;
      }
      const result = data as WeekSaveResult;
      setSchedule({
        ...schedule,
        rows: result.rows,
        source: "saved",
        custom: mode === "week",
      });
      setDrafts(toDrafts(result.rows));
      setDirty(false);
      setKept(result.keptBooked);
      const changes = [
        result.added && `${result.added} time${result.added === 1 ? "" : "s"} opened`,
        result.removed && `${result.removed} removed`,
      ].filter(Boolean);
      setOk(
        mode === "reset"
          ? `Week of ${weekLabel} follows the fixed schedule again — ${changes.length ? changes.join(", ") : "no changes to open times"}.`
          : `Week of ${weekLabel} saved for this week only — ${changes.length ? changes.join(", ") : "no changes to open times"}. Patients now see this schedule.`,
      );
    } catch {
      setError("Could not reach the server");
    } finally {
      setBusy(false);
    }
  }

  const status =
    schedule.source === "saved" && !dirty && schedule.rows.length === 0
      ? {
          tone: "bg-wine-soft text-wine-deep",
          text: "Closed — saved with no times, so patients can't book this week.",
        }
      : schedule.source === "saved" && !dirty && !schedule.custom
        ? {
            tone: "bg-sage-soft text-sage-ink",
            text: "Follows the fixed weekly schedule — patients can book these times. Change it here for this week only, or save it as the new fixed schedule.",
          }
        : schedule.source === "saved" && !dirty
          ? {
              tone: "bg-[#eef3fb] text-[#1f3f73]",
              text: "Changed for this week only — the fixed weekly schedule isn't used this week.",
            }
          : schedule.source === "saved"
          ? {
              tone: "bg-[#fff6e5] text-[#7a4b00]",
              text: "Unsaved changes — patients still see the last saved version.",
            }
          : schedule.source === "slots"
            ? {
                tone: "bg-[#fff6e5] text-[#7a4b00]",
                text: "Not saved for this week yet — showing the times already open. Save to confirm or change them.",
              }
            : {
                tone: "bg-wine-soft text-wine-deep",
                text: "Nothing set for this week — patients can't book it yet. Copy a week below or add getProviders().",
              };

  const blocked = busy || problems.length > 0;

  return (
    <div className="mt-6 space-y-6">
      {(error || ok) && (
        <div aria-live="polite" className="sticky top-2 z-10 -mb-3">
          <Notice tone="error">{error}</Notice>
          <Notice tone="ok">{ok}</Notice>
        </div>
      )}

      <div className={CARD}>
        {/* ------------------------------------------------ week picker -- */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => goTo(addDays(week, -7))}
              disabled={busy || week <= thisMonday}
              aria-label="Previous week"
              className={`${BTN_QUIET} h-10 w-10 px-0`}
            >
              ←
            </button>
            <div className="min-w-50 text-center">
              <p className="font-display text-[1.25rem] font-semibold leading-tight">{weekLabel}</p>
              <p className="text-[13px] text-plum-soft">{relative ?? "Week"}</p>
            </div>
            <button
              type="button"
              onClick={() => goTo(addDays(week, 7))}
              disabled={busy || week >= lastMonday}
              aria-label="Next week"
              className={`${BTN_QUIET} h-10 w-10 px-0`}
            >
              →
            </button>
            {week !== thisMonday && (
              <button
                type="button"
                onClick={() => goTo(thisMonday)}
                disabled={busy}
                className="focus-ring ml-1 text-[13px] font-semibold text-wine underline underline-offset-2"
              >
                Back to this week
              </button>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => save("master")}
              disabled={blocked || (!dirty && !schedule.custom)}
              className={BTN_QUIET}
              title="Every week follows this schedule unless changed on its own"
            >
              Save as fixed schedule (every week)
            </button>
            <button
              type="button"
              onClick={() => save("week")}
              disabled={blocked || (!dirty && schedule.source === "saved")}
              className={BTN_PRIMARY}
            >
              {busy
                ? "Saving…"
                : !dirty && schedule.source === "saved"
                  ? "Saved"
                  : "Save for this week only"}
            </button>
          </div>
        </div>

        <p className={`mt-4 rounded-lg px-3 py-2 text-[14px] ${status.tone}`}>{status.text}</p>

        {/* ------------------------------------------------ quick fills -- */}
        <div className="mt-3 flex flex-wrap items-center gap-2 text-[14px]">
          {schedule.previous && (
            <button
              type="button"
              onClick={() => edit(toDrafts(schedule.previous!.rows))}
              disabled={busy}
              className={BTN_QUIET}
            >
              Copy week of {formatShort(schedule.previous.week)}
            </button>
          )}
          <button
            type="button"
            onClick={() => edit(toDrafts(schedule.template))}
            disabled={busy}
            className={BTN_QUIET}
          >
            Fill in the fixed schedule
          </button>
          {schedule.custom && schedule.source === "saved" && !dirty && (
            <button
              type="button"
              onClick={() => save("reset")}
              disabled={busy}
              className={BTN_QUIET}
            >
              Use the fixed schedule again
            </button>
          )}
          {drafts.length > 0 && (
            <button type="button" onClick={() => edit([])} disabled={busy} className={BTN_QUIET}>
              Clear week
            </button>
          )}
          {week === thisMonday && (
            <span className="text-[13px] text-plum-soft">
              Days already past this week are not changed.
            </span>
          )}
        </div>

        {/* ---------------------------------------------------- the table -- */}
        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-left">
            <thead>
              <tr className="text-[12px] uppercase tracking-wide text-plum-soft">
                <th className="w-35 border-b border-mist py-2 pr-3 font-semibold">Day</th>
                {getOffices().map((office) => (
                  <th key={office.id} className="border-b border-mist px-3 py-2 font-semibold">
                    {office.area} <span className="font-normal normal-case">· {office.name}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {DAYS.map((weekday) => {
                const date = dateOf(week, weekday);
                const past = date < today;
                return (
                  <tr key={weekday} className={`align-top ${past ? "opacity-55" : ""}`}>
                    <th
                      scope="row"
                      className="border-b border-mist py-3 pr-3 text-[15px] font-semibold"
                    >
                      {WEEKDAY_NAMES[weekday]}
                      <span className="block text-[13px] font-normal text-plum-soft">
                        {formatShort(date).split(", ")[1]}
                        {past && " · past"}
                      </span>
                    </th>
                    {getOffices().map((office) => {
                      const cell = drafts.filter(
                        (draft) => draft.weekday === weekday && draft.officeId === office.id,
                      );
                      return (
                        <td key={office.id} className="border-b border-mist px-3 py-3">
                          <div className="space-y-2">
                            {cell.map((draft) => (
                              <div
                                key={draft.key}
                                className="rounded-xl border border-mist bg-shell/60 p-2.5"
                              >
                                <div className="flex gap-2">
                                  <select
                                    aria-label={`Provider, ${WEEKDAY_NAMES[weekday]} at ${office.area}`}
                                    value={draft.providerId}
                                    onChange={(event) =>
                                      update(draft.key, {
                                        providerId: event.target.value as ProviderId,
                                      })
                                    }
                                    className={`${FIELD} py-2`}
                                  >
                                    {getProviders().map((provider) => (
                                      <option key={provider.id} value={provider.id}>
                                        {provider.name}
                                      </option>
                                    ))}
                                  </select>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      edit(drafts.filter((item) => item.key !== draft.key))
                                    }
                                    aria-label="Remove this provider from the day"
                                    className={`${BTN_QUIET} px-2.5`}
                                  >
                                    ×
                                  </button>
                                </div>
                                <input
                                  aria-label={`Times, ${WEEKDAY_NAMES[weekday]} at ${office.area}`}
                                  value={draft.times}
                                  onChange={(event) =>
                                    update(draft.key, { times: event.target.value })
                                  }
                                  placeholder="8:00 am, 10:00 am, 1:00 pm"
                                  className={`${FIELD} mt-2 py-2`}
                                />
                              </div>
                            ))}
                            {!past && (
                              <button
                                type="button"
                                onClick={() =>
                                  edit([
                                    ...drafts,
                                    {
                                      key: nextKey(),
                                      weekday,
                                      officeId: office.id,
                                      providerId: getProviders()[0].id,
                                      times: "",
                                    },
                                  ])
                                }
                                className="focus-ring text-[13px] font-semibold text-wine underline underline-offset-2"
                              >
                                + Add provider
                              </button>
                            )}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {problems.map((problem) => (
          <Notice key={problem} tone="error">
            {problem}
          </Notice>
        ))}
        {clashes.map((clash) => (
          <p
            key={clash}
            className="mt-3 rounded-lg bg-[#fff6e5] px-3 py-2 text-[14px] text-[#7a4b00]"
          >
            {clash}
          </p>
        ))}

        {kept.length > 0 && (
          <div className="mt-4 rounded-lg bg-[#fff6e5] px-4 py-3 text-[14px] text-[#7a4b00]">
            <p className="font-semibold">
              {kept.length} booked appointment{kept.length === 1 ? " is" : "s are"} outside the new
              schedule and {kept.length === 1 ? "was" : "were"} kept. Call the patient to move or
              cancel:
            </p>
            <ul className="mt-1.5 list-disc space-y-0.5 pl-5">
              {kept.map((item) => (
                <li key={`${item.date}${item.time}${item.providerId}`}>
                  {formatShort(item.date)} · {item.time} ·{" "}
                  {item.providerId ? shortProviderName(item.providerId) : "—"} ·{" "}
                  {officeById(item.officeId)?.area ?? "—"}
                  {item.patients.length > 0 && ` — ${item.patients.join(", ")}`}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
