"use client";

import { useState } from "react";
import type { Plan } from "@/lib/models";
import Ico, { type IcoName } from "@/components/site/Ico";
import { BTN_DANGER, BTN_PRIMARY, BTN_QUIET, CARD, FIELD, LABEL, Notice } from "./ui";

const ICONS: IcoName[] = ["star", "check", "waves", "shield", "heart", "droplet", "pulse", "tag", "users", "cal"];

type Draft = Omit<Plan, "id">;

const BLANK: Draft = {
  order: 0,
  tag: "Visit",
  tagIcon: "star",
  amount: "$0",
  title: "",
  body: "",
};

export default function PlansEditor({ initial }: { initial: Plan[] }) {
  const [plans, setPlans] = useState(initial);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [draft, setDraft] = useState<Draft>(BLANK);
  const [adding, setAdding] = useState(false);

  function edit(id: string, patch: Partial<Plan>) {
    setPlans((prev) => prev.map((plan) => (plan.id === id ? { ...plan, ...patch } : plan)));
  }

  async function save(plan: Plan) {
    setBusyId(plan.id);
    setError("");
    setOk("");
    try {
      const response = await fetch(`/api/admin/plans/${plan.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tag: plan.tag,
          tagIcon: plan.tagIcon,
          amount: plan.amount,
          title: plan.title,
          body: plan.body,
          order: plan.order,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? "Could not save");
        return;
      }
      edit(plan.id, data.plan);
      setOk(`Saved “${data.plan.title}”.`);
    } finally {
      setBusyId(null);
    }
  }

  async function remove(plan: Plan) {
    setBusyId(plan.id);
    setError("");
    try {
      const response = await fetch(`/api/admin/plans/${plan.id}`, { method: "DELETE" });
      if (!response.ok) {
        const data = await response.json();
        setError(data.error ?? "Could not delete");
        return;
      }
      setPlans((prev) => prev.filter((item) => item.id !== plan.id));
      setOk(`Removed “${plan.title}”.`);
    } finally {
      setBusyId(null);
    }
  }

  async function add(event: React.FormEvent) {
    event.preventDefault();
    setAdding(true);
    setError("");
    setOk("");
    try {
      const response = await fetch("/api/admin/plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...draft, order: plans.length }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? "Could not add the plan");
        return;
      }
      setPlans((prev) => [...prev, data.plan]);
      setDraft(BLANK);
      setOk(`Added “${data.plan.title}”.`);
    } finally {
      setAdding(false);
    }
  }

  return (
    <div className="mt-6">
      <Notice tone="error">{error}</Notice>
      <Notice tone="ok">{ok}</Notice>

      <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {plans.map((plan) => (
          <div key={plan.id} className={CARD}>
            <div className="flex items-center gap-2 text-sage">
              <Ico name={plan.tagIcon} className="h-4 w-4" />
              <span className="text-[12px] font-bold uppercase tracking-wide">{plan.tag}</span>
              <span className="ml-auto font-display text-[1.8rem] leading-none text-wine">
                {plan.amount}
              </span>
            </div>

            <div className="mt-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={LABEL}>Tag</label>
                  <input
                    value={plan.tag}
                    onChange={(event) => edit(plan.id, { tag: event.target.value })}
                    className={FIELD}
                  />
                </div>
                <div>
                  <label className={LABEL}>Price</label>
                  <input
                    value={plan.amount}
                    onChange={(event) => edit(plan.id, { amount: event.target.value })}
                    className={FIELD}
                  />
                </div>
              </div>

              <div>
                <label className={LABEL}>Title</label>
                <input
                  value={plan.title}
                  onChange={(event) => edit(plan.id, { title: event.target.value })}
                  className={FIELD}
                />
              </div>

              <div>
                <label className={LABEL}>Description</label>
                <textarea
                  rows={2}
                  value={plan.body}
                  onChange={(event) => edit(plan.id, { body: event.target.value })}
                  className={`${FIELD} resize-none`}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={LABEL}>Icon</label>
                  <select
                    value={plan.tagIcon}
                    onChange={(event) => edit(plan.id, { tagIcon: event.target.value as IcoName })}
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
                  <label className={LABEL}>Order</label>
                  <input
                    type="number"
                    value={plan.order}
                    onChange={(event) => edit(plan.id, { order: Number(event.target.value) })}
                    className={FIELD}
                  />
                </div>
              </div>
            </div>

            <div className="mt-4 flex gap-2">
              <button
                type="button"
                disabled={busyId === plan.id}
                onClick={() => save(plan)}
                className={BTN_PRIMARY}
              >
                Save
              </button>
              <button
                type="button"
                disabled={busyId === plan.id}
                onClick={() => remove(plan)}
                className={BTN_DANGER}
              >
                Delete
              </button>
            </div>
          </div>
        ))}

        <form onSubmit={add} className={`${CARD} border-dashed`}>
          <h2 className="font-display text-[1.2rem] font-semibold">Add a service</h2>

          <div className="mt-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={LABEL}>Tag</label>
                <input
                  value={draft.tag}
                  onChange={(event) => setDraft({ ...draft, tag: event.target.value })}
                  className={FIELD}
                />
              </div>
              <div>
                <label className={LABEL}>Price</label>
                <input
                  value={draft.amount}
                  onChange={(event) => setDraft({ ...draft, amount: event.target.value })}
                  className={FIELD}
                  placeholder="$120"
                />
              </div>
            </div>
            <div>
              <label className={LABEL}>Title</label>
              <input
                required
                value={draft.title}
                onChange={(event) => setDraft({ ...draft, title: event.target.value })}
                className={FIELD}
                placeholder="Nexplanon Insertion"
              />
            </div>
            <div>
              <label className={LABEL}>Description</label>
              <textarea
                rows={2}
                value={draft.body}
                onChange={(event) => setDraft({ ...draft, body: event.target.value })}
                className={`${FIELD} resize-none`}
              />
            </div>
            <div>
              <label className={LABEL}>Icon</label>
              <select
                value={draft.tagIcon}
                onChange={(event) => setDraft({ ...draft, tagIcon: event.target.value as IcoName })}
                className={FIELD}
              >
                {ICONS.map((icon) => (
                  <option key={icon} value={icon}>
                    {icon}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-4 flex gap-2">
            <button type="submit" disabled={adding} className={BTN_PRIMARY}>
              {adding ? "Adding…" : "Add service"}
            </button>
            <button type="button" onClick={() => setDraft(BLANK)} className={BTN_QUIET}>
              Clear
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
