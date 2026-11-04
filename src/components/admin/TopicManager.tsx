"use client";

import Link from "next/link";
import { useState } from "react";
import { TOPIC_CATEGORIES, TOPIC_LOCATIONS, type Topic, type TopicCategory, type TopicStatus } from "@/lib/article-ai";
import { BTN_DANGER, BTN_PRIMARY, BTN_QUIET, CARD, FIELD, LABEL, Notice } from "./ui";

const STATUS: Record<TopicStatus, { label: string; tone: string }> = {
  queued: { label: "Waiting", tone: "bg-shell text-plum-soft" },
  generating: { label: "Being written", tone: "bg-[#fdf1d8] text-[#7a5212]" },
  used: { label: "Written", tone: "bg-sage-soft text-sage-ink" },
  skipped: { label: "Skipped", tone: "bg-wine-soft text-wine-deep" },
};

const BLANK = { title: "", focusKeyword: "", category: "prenatal-care" as TopicCategory, location: "", notes: "" };

export default function TopicManager({ initial }: { initial: Topic[] }) {
  const [topics, setTopics] = useState(initial);
  const [form, setForm] = useState(BLANK);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");

  async function call(url: string, method: string, body?: unknown) {
    setBusy(true);
    setError("");
    setOk("");
    try {
      const response = await fetch(url, {
        method,
        headers: body === undefined ? undefined : { "content-type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.error ?? "Something went wrong — please try again.");
        return null;
      }
      return data;
    } catch {
      setError("Could not reach the server");
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function add(event: React.FormEvent) {
    event.preventDefault();
    const data = await call("/api/admin/articles/topics", "POST", { ...form, location: form.location || null });
    if (!data) return;
    setTopics((current) => [...current, data.topic]);
    setForm(BLANK);
    setOk("Topic added to the queue");
  }

  async function setStatus(topic: Topic, status: "queued" | "skipped") {
    const data = await call(`/api/admin/articles/topics/${topic.id}`, "PATCH", { status });
    if (data) setTopics((current) => current.map((item) => (item.id === topic.id ? data.topic : item)));
  }

  async function remove(topic: Topic) {
    if (!window.confirm(`Remove "${topic.title}" from the list?`)) return;
    const data = await call(`/api/admin/articles/topics/${topic.id}`, "DELETE");
    if (data) setTopics((current) => current.filter((item) => item.id !== topic.id));
  }

  const waiting = topics.filter((topic) => topic.status === "queued").length;

  return (
    <div className="mt-6 space-y-6">
      <form onSubmit={add} className={CARD} aria-labelledby="add-topic">
        <h2 id="add-topic" className="text-[1.1rem] font-semibold">Add a topic</h2>
        <div className="mt-4 grid gap-4 min-[900px]:grid-cols-2">
          <div className="min-[900px]:col-span-2">
            <label htmlFor="topic-title" className={LABEL}>Topic — the question the article answers</label>
            <input
              id="topic-title"
              className={FIELD}
              required
              maxLength={140}
              value={form.title}
              placeholder="e.g. What to expect at a 20-week anatomy ultrasound"
              onChange={(event) => setForm({ ...form, title: event.target.value })}
            />
          </div>
          <div>
            <label htmlFor="topic-keyword" className={LABEL}>Focus keyword — what people type into Google</label>
            <input
              id="topic-keyword"
              className={FIELD}
              required
              maxLength={60}
              value={form.focusKeyword}
              placeholder="20 week ultrasound"
              onChange={(event) => setForm({ ...form, focusKeyword: event.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="topic-category" className={LABEL}>Category</label>
              <select
                id="topic-category"
                className={FIELD}
                value={form.category}
                onChange={(event) => setForm({ ...form, category: event.target.value as TopicCategory })}
              >
                {Object.entries(TOPIC_CATEGORIES).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="topic-location" className={LABEL}>Place</label>
              <select
                id="topic-location"
                className={FIELD}
                value={form.location}
                onChange={(event) => setForm({ ...form, location: event.target.value })}
              >
                <option value="">None</option>
                {TOPIC_LOCATIONS.map((place) => (
                  <option key={place} value={place}>
                    {place}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="min-[900px]:col-span-2">
            <label htmlFor="topic-notes" className={LABEL}>Notes for the writer (optional)</label>
            <input
              id="topic-notes"
              className={FIELD}
              maxLength={400}
              value={form.notes}
              placeholder="e.g. Mention that walk-in ultrasounds depend on the day's openings"
              onChange={(event) => setForm({ ...form, notes: event.target.value })}
            />
          </div>
        </div>
        <button type="submit" className={`${BTN_PRIMARY} mt-4`} disabled={busy}>
          Add to the queue
        </button>
        <Notice tone="error">{error}</Notice>
        <Notice tone="ok">{ok}</Notice>
      </form>

      <section className={`${CARD} p-0`} aria-labelledby="topic-list">
        <h2 id="topic-list" className="px-6 pt-5 text-[1.1rem] font-semibold">
          Topics <span className="font-normal text-plum-soft">({waiting} waiting)</span>
        </h2>
        <ul className="mt-3 divide-y divide-mist">
          {topics.map((topic) => (
            <li key={topic.id} className="flex flex-wrap items-start justify-between gap-3 px-6 py-3">
              <div className="min-w-0 flex-1">
                <p className="font-medium text-plum">{topic.title}</p>
                <p className="text-[13px] text-plum-soft">
                  “{topic.focusKeyword}” · {TOPIC_CATEGORIES[topic.category]}
                  {topic.location ? ` · ${topic.location}` : ""}
                  {topic.notes ? ` · ${topic.notes}` : ""}
                </p>
                {topic.lastError && <p className="text-[13px] text-wine-deep">{topic.lastError}</p>}
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-2">
                <span className={`rounded-full px-2.5 py-1 text-[12px] font-semibold ${STATUS[topic.status].tone}`}>
                  {STATUS[topic.status].label}
                </span>
                {topic.articleId && (
                  <Link href={`/admin/articles/${topic.articleId}`} className={BTN_QUIET}>
                    Open article
                  </Link>
                )}
                {topic.status === "queued" && (
                  <button type="button" className={BTN_QUIET} disabled={busy} onClick={() => setStatus(topic, "skipped")}>
                    Skip
                  </button>
                )}
                {topic.status === "skipped" && (
                  <button type="button" className={BTN_QUIET} disabled={busy} onClick={() => setStatus(topic, "queued")}>
                    Back to queue
                  </button>
                )}
                {topic.status !== "generating" && (
                  <button type="button" className={BTN_DANGER} disabled={busy} onClick={() => remove(topic)}>
                    Remove
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
