"use client";

import { useRef, useState } from "react";
import type { Plan } from "@/lib/models";
import { type IcoName } from "@/components/site/Ico";
import PriceCard from "@/components/site/PriceCard";
import { BTN_PRIMARY, BTN_QUIET, FIELD, LABEL, Notice } from "./ui";

const ICONS: IcoName[] = [
  "star",
  "check",
  "waves",
  "shield",
  "heart",
  "droplet",
  "pulse",
  "tag",
  "users",
  "cal",
];

type Draft = Omit<Plan, "id">;

const BLANK: Draft = {
  order: 0,
  tag: "Visit",
  tagIcon: "star",
  amount: "$0",
  title: "",
  body: "",
};

const NEW_TITLE = "__new__";

/**
 * A title picked from the saved list, or "+ Add a new title…" to type one —
 * which is saved to the list so it can be picked next time.
 */
function TitleSelect({
  id,
  value,
  titles,
  onChange,
  onAdd,
}: {
  id: string;
  value: string;
  titles: string[];
  onChange: (title: string) => void;
  /** Saves a new title; resolves to the saved spelling, or null on failure. */
  onAdd: (title: string) => Promise<string | null>;
}) {
  const [typing, setTyping] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  // A card whose title isn't in the list still shows its own title.
  const options = value && !titles.includes(value) ? [value, ...titles] : titles;

  async function save() {
    if (text.trim().length < 2) {
      setError("Write a title");
      return;
    }
    setBusy(true);
    setError("");
    const saved = await onAdd(text);
    setBusy(false);
    if (!saved) {
      setError("Could not save the title");
      return;
    }
    onChange(saved);
    setTyping(false);
    setText("");
  }

  if (typing) {
    return (
      <div>
        <div className="flex gap-2">
          <input
            id={id}
            autoFocus
            value={text}
            maxLength={80}
            onChange={(event) => setText(event.target.value)}
            onKeyDown={(event) => {
              // Enter saves the title instead of submitting the whole card.
              if (event.key === "Enter") {
                event.preventDefault();
                void save();
              }
              if (event.key === "Escape") setTyping(false);
            }}
            placeholder="e.g. Nexplanon Insertion"
            className={FIELD}
          />
          <button type="button" disabled={busy} onClick={save} className={BTN_PRIMARY}>
            {busy ? "Saving…" : "Save"}
          </button>
          <button type="button" onClick={() => setTyping(false)} className={BTN_QUIET}>
            Cancel
          </button>
        </div>
        {error ? (
          <p className="mt-1 text-[13px] text-wine-deep">{error}</p>
        ) : (
          <p className="mt-1 text-[12px] text-plum-soft">Saved to the list for next time.</p>
        )}
      </div>
    );
  }

  return (
    <select
      id={id}
      required
      value={value}
      onChange={(event) => {
        if (event.target.value === NEW_TITLE) {
          setTyping(true);
          setText("");
          setError("");
        } else {
          onChange(event.target.value);
        }
      }}
      className={FIELD}
    >
      <option value="" disabled>
        Choose a title…
      </option>
      {options.map((title) => (
        <option key={title} value={title}>
          {title}
        </option>
      ))}
      <option value={NEW_TITLE}>+ Add a new title…</option>
    </select>
  );
}

/** Card buttons that read on both the dark featured card and the white ones. */
function cardButton(featured: boolean, danger = false) {
  const base =
    "focus-ring inline-flex min-h-10 items-center rounded-full px-4 text-[14px] font-semibold transition disabled:opacity-60";
  if (featured) {
    return `${base} ${danger ? "text-white/70 hover:text-white" : "bg-white text-plum hover:bg-white/90"}`;
  }
  return `${base} ${danger ? "text-wine hover:bg-wine-soft" : "border border-plum/20 text-plum hover:border-plum"}`;
}

export default function PlansEditor({
  initial,
  initialTitles,
}: {
  initial: Plan[];
  initialTitles: string[];
}) {
  const [plans, setPlans] = useState(() => [...initial].sort((a, b) => a.order - b.order));
  const [titles, setTitles] = useState(initialTitles);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  // The popup: adding when `editingId` is null, editing that card otherwise.
  const dialog = useRef<HTMLDialogElement>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(BLANK);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  async function addTitle(title: string): Promise<string | null> {
    try {
      const response = await fetch("/api/admin/price-titles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });
      if (!response.ok) return null;
      const data = (await response.json()) as { titles: string[] };
      setTitles(data.titles);
      const clean = title.trim().replace(/\s+/g, " ").toLowerCase();
      // An existing title with other capitals is reused, not duplicated.
      return data.titles.find((item) => item.toLowerCase() === clean) ?? null;
    } catch {
      return null;
    }
  }

  function openAdd() {
    setEditingId(null);
    setDraft({ ...BLANK, order: plans.length });
    setFormError("");
    setOk("");
    dialog.current?.showModal();
  }

  function openEdit(plan: Plan) {
    const { id, ...rest } = plan;
    setEditingId(id);
    setDraft(rest);
    setFormError("");
    setOk("");
    dialog.current?.showModal();
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!draft.title) {
      setFormError("Choose a title");
      return;
    }
    setSaving(true);
    setFormError("");
    try {
      const response = await fetch(
        editingId ? `/api/admin/plans/${editingId}` : "/api/admin/plans",
        {
          method: editingId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(draft),
        },
      );
      const data = await response.json();
      if (!response.ok) {
        setFormError(data.error ?? "Could not save");
        return;
      }
      const saved = data.plan as Plan;
      setPlans((prev) =>
        (editingId
          ? prev.map((plan) => (plan.id === editingId ? saved : plan))
          : [...prev, saved]
        ).sort((a, b) => a.order - b.order),
      );
      dialog.current?.close();
      setOk(editingId ? `Saved “${saved.title}”.` : `Added “${saved.title}”.`);
    } catch {
      setFormError("Could not reach the server");
    } finally {
      setSaving(false);
    }
  }

  async function remove(plan: Plan) {
    if (!window.confirm(`Delete “${plan.title}”? Patients will no longer see this price.`)) return;
    setBusyId(plan.id);
    setError("");
    setOk("");
    try {
      const response = await fetch(`/api/admin/plans/${plan.id}`, { method: "DELETE" });
      if (!response.ok) {
        const data = await response.json();
        setError(data.error ?? "Could not delete");
        return;
      }
      setPlans((prev) => prev.filter((item) => item.id !== plan.id));
      setOk(`Removed “${plan.title}”.`);
    } catch {
      setError("Could not reach the server");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="mt-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[15px] text-plum-soft">
          {plans.length} service{plans.length === 1 ? "" : "s"} — shown below exactly as patients
          see them.
        </p>
        <button type="button" onClick={openAdd} className={BTN_PRIMARY}>
          <span aria-hidden className="text-[18px] leading-none">
            +
          </span>
          Add service
        </button>
      </div>

      <div aria-live="polite">
        <Notice tone="error">{error}</Notice>
        <Notice tone="ok">{ok}</Notice>
      </div>

      {plans.length === 0 ? (
        <p className="mt-6 rounded-[24px] border border-dashed border-mist bg-white p-8 text-center text-plum-soft">
          No prices yet. Use Add service — patients see a &ldquo;call us&rdquo; note until you do.
        </p>
      ) : (
        <ul className="mt-6 grid gap-5 min-[640px]:grid-cols-2 min-[1060px]:grid-cols-3">
          {plans.map((plan, index) => (
            <PriceCard
              key={plan.id}
              price={plan}
              index={index}
              footer={(featured) => (
                <div className="flex shrink-0 gap-1">
                  <button
                    type="button"
                    onClick={() => openEdit(plan)}
                    disabled={busyId === plan.id}
                    className={cardButton(featured)}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(plan)}
                    disabled={busyId === plan.id}
                    aria-label={`Delete ${plan.title}`}
                    className={cardButton(featured, true)}
                  >
                    Delete
                  </button>
                </div>
              )}
            />
          ))}
        </ul>
      )}

      <dialog
        ref={dialog}
        aria-labelledby="plan-form-title"
        className="m-auto w-[min(560px,calc(100vw-32px))] rounded-2xl border border-mist bg-white p-0 text-plum shadow-[0_24px_60px_-20px_rgba(44,32,38,.45)] backdrop:bg-plum/40"
      >
        <form onSubmit={submit} className="max-h-[calc(100dvh-48px)] overflow-y-auto p-6">
          <div className="flex items-start justify-between gap-4">
            <h2 id="plan-form-title" className="font-display text-[1.35rem] font-semibold">
              {editingId ? "Edit service" : "Add a service"}
            </h2>
            <button
              type="button"
              onClick={() => dialog.current?.close()}
              aria-label="Close"
              className="focus-ring -mr-2 -mt-1 grid h-10 w-10 shrink-0 place-items-center rounded-full text-[22px] leading-none text-plum-soft transition hover:bg-shell hover:text-plum"
            >
              ×
            </button>
          </div>

          <div className="mt-4 space-y-3">
            <div>
              <label className={LABEL} htmlFor="plan-title">
                Title
              </label>
              <TitleSelect
                id="plan-title"
                value={draft.title}
                titles={titles}
                onChange={(title) => setDraft({ ...draft, title })}
                onAdd={addTitle}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={LABEL} htmlFor="plan-amount">
                  Price
                </label>
                <input
                  id="plan-amount"
                  required
                  value={draft.amount}
                  onChange={(event) => setDraft({ ...draft, amount: event.target.value })}
                  className={FIELD}
                  placeholder="$120"
                />
              </div>
              <div>
                <label className={LABEL} htmlFor="plan-tag">
                  Tag
                </label>
                <input
                  id="plan-tag"
                  value={draft.tag}
                  onChange={(event) => setDraft({ ...draft, tag: event.target.value })}
                  className={FIELD}
                  placeholder="Birth Control"
                />
              </div>
            </div>
            <div>
              <label className={LABEL} htmlFor="plan-body">
                Description
              </label>
              <textarea
                id="plan-body"
                rows={2}
                value={draft.body}
                onChange={(event) => setDraft({ ...draft, body: event.target.value })}
                className={`${FIELD} resize-none`}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={LABEL} htmlFor="plan-icon">
                  Icon
                </label>
                <select
                  id="plan-icon"
                  value={draft.tagIcon}
                  onChange={(event) =>
                    setDraft({ ...draft, tagIcon: event.target.value as IcoName })
                  }
                  className={FIELD}
                >
                  {ICONS.map((icon) => (
                    <option key={icon} value={icon}>
                      {icon}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={LABEL} htmlFor="plan-order">
                  Position
                </label>
                <input
                  id="plan-order"
                  type="number"
                  min={0}
                  value={draft.order}
                  onChange={(event) => setDraft({ ...draft, order: Number(event.target.value) })}
                  className={FIELD}
                />
              </div>
            </div>
            <p className="text-[12px] text-plum-soft">
              Lowest position shows first. The first card gets the dark highlight.
            </p>
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
            <button type="submit" disabled={saving} className={`${BTN_PRIMARY} flex-1`}>
              {saving ? "Saving…" : editingId ? "Save changes" : "Add service"}
            </button>
          </div>
        </form>
      </dialog>
    </div>
  );
}
