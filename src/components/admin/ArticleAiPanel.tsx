"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { TOPIC_CATEGORIES, TOPIC_LOCATIONS, type TopicCategory } from "@/lib/article-ai";
import type { Automation, Generation } from "@/lib/article-writer";
import type { Reviewer } from "@/lib/articles";
import { formatWhen } from "./article-ui";
import { BTN_PRIMARY, CARD, FIELD, LABEL, Notice } from "./ui";

const NEXT = "__next__";
const CUSTOM = "__custom__";
const NOBODY = "";

const dollars = (value: number | null) =>
  value === null ? "—" : value < 0.01 && value > 0 ? "< $0.01" : `$${value.toFixed(2)}`;

/**
 * Admin → Articles: write a draft with AI now, and switch the daily draft on
 * or off. Drafts go to the chosen doctor's review queue; nothing is published.
 */
export default function ArticleAiPanel({
  configured,
  model,
  automation: initialAutomation,
  reviewers,
  queued,
  usage,
  generations,
}: {
  configured: boolean;
  model: string;
  automation: Automation;
  reviewers: Reviewer[];
  queued: { id: string; title: string }[];
  usage: { drafts: number; failed: number; costUsd: number };
  generations: Generation[];
}) {
  const router = useRouter();
  const firstReviewer = initialAutomation.reviewerId ?? reviewers[0]?.providerId ?? NOBODY;
  const [topicId, setTopicId] = useState(NEXT);
  const [custom, setCustom] = useState({ title: "", focusKeyword: "", category: "prenatal-care" as TopicCategory, location: "" });
  const [reviewerId, setReviewerId] = useState(firstReviewer);
  const [automation, setAutomation] = useState(initialAutomation);
  const [busy, setBusy] = useState<"" | "write" | "save">("");
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");

  async function post(url: string, method: string, body: unknown) {
    const response = await fetch(url, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error ?? "Something went wrong — please try again.");
    return data;
  }

  async function generate() {
    setBusy("write");
    setError("");
    setOk("");
    try {
      const data = await post("/api/admin/articles/generate", "POST", {
        topicId: topicId === NEXT || topicId === CUSTOM ? null : topicId,
        customTopic: topicId === CUSTOM ? { ...custom, location: custom.location || null } : undefined,
        reviewerId: reviewerId || null,
      });
      setOk(
        data.warning ??
          (data.sentTo ? `Draft written and sent to ${data.sentTo} for medical review.` : "Draft written — it is waiting in Articles."),
      );
      router.push(`/admin/articles/${data.article.id}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not reach the server");
      router.refresh();
    } finally {
      setBusy("");
    }
  }

  async function saveAutomation(next: Automation) {
    setBusy("save");
    setError("");
    setOk("");
    try {
      const data = await post("/api/admin/articles/automation", "PUT", { enabled: next.enabled, reviewerId: next.reviewerId });
      setAutomation(data.automation);
      setOk(data.automation.enabled ? "Daily drafts are on." : "Daily drafts are off.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not reach the server");
    } finally {
      setBusy("");
    }
  }

  const customReady = custom.title.trim() && custom.focusKeyword.trim();

  return (
    <section className={`${CARD} mt-6`} aria-labelledby="ai-writer">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 id="ai-writer" className="text-[1.15rem] font-semibold">AI article writer</h2>
        <p className="text-[13px] text-plum-soft">
          {model} · this month: {usage.drafts} draft{usage.drafts === 1 ? "" : "s"}
          {usage.failed ? `, ${usage.failed} failed` : ""} · {dollars(usage.costUsd)}
        </p>
      </div>
      <p className="mt-1 max-w-[80ch] text-[14px] text-plum-soft">
        Writes a first draft with headings, FAQs and references from a checked list of medical sources, and links it to
        our services. Every draft goes to a doctor for medical review; nothing is published without their approval and
        yours.
      </p>
      {!configured && (
        <p className="mt-3 rounded-lg bg-wine-soft px-3 py-2 text-[14px] text-wine-deep">
          The AI writer isn&apos;t set up yet: add <code>ANTHROPIC_API_KEY</code> to the server&apos;s environment.
        </p>
      )}

      <div className="mt-5 grid gap-6 min-[1000px]:grid-cols-[1.4fr_1fr]">
        <div>
          <h3 className="text-[15px] font-semibold">Write a draft now</h3>
          <div className="mt-3 grid gap-3 min-[640px]:grid-cols-2">
            <div className="min-[640px]:col-span-2">
              <label htmlFor="ai-topic" className={LABEL}>Topic</label>
              <select id="ai-topic" className={FIELD} value={topicId} onChange={(event) => setTopicId(event.target.value)}>
                <option value={NEXT}>Next in the queue{queued[0] ? ` — ${queued[0].title}` : ""}</option>
                {queued.map((topic) => (
                  <option key={topic.id} value={topic.id}>
                    {topic.title}
                  </option>
                ))}
                <option value={CUSTOM}>Type a new topic…</option>
              </select>
            </div>
            {topicId === CUSTOM && (
              <>
                <div className="min-[640px]:col-span-2">
                  <label htmlFor="ai-custom-title" className={LABEL}>Topic</label>
                  <input
                    id="ai-custom-title"
                    className={FIELD}
                    value={custom.title}
                    maxLength={140}
                    placeholder="e.g. What to expect at a 20-week ultrasound"
                    onChange={(event) => setCustom({ ...custom, title: event.target.value })}
                  />
                </div>
                <div>
                  <label htmlFor="ai-custom-keyword" className={LABEL}>Focus keyword</label>
                  <input
                    id="ai-custom-keyword"
                    className={FIELD}
                    value={custom.focusKeyword}
                    maxLength={60}
                    placeholder="20 week ultrasound"
                    onChange={(event) => setCustom({ ...custom, focusKeyword: event.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="ai-custom-category" className={LABEL}>Category</label>
                    <select
                      id="ai-custom-category"
                      className={FIELD}
                      value={custom.category}
                      onChange={(event) => setCustom({ ...custom, category: event.target.value as TopicCategory })}
                    >
                      {Object.entries(TOPIC_CATEGORIES).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="ai-custom-location" className={LABEL}>Place</label>
                    <select
                      id="ai-custom-location"
                      className={FIELD}
                      value={custom.location}
                      onChange={(event) => setCustom({ ...custom, location: event.target.value })}
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
              </>
            )}
            <div>
              <label htmlFor="ai-reviewer" className={LABEL}>Send to</label>
              <select id="ai-reviewer" className={FIELD} value={reviewerId} onChange={(event) => setReviewerId(event.target.value)}>
                {reviewers.map((reviewer) => (
                  <option key={reviewer.providerId} value={reviewer.providerId}>
                    {reviewer.name} for medical review
                  </option>
                ))}
                <option value={NOBODY}>Nobody yet — keep it as a draft</option>
              </select>
            </div>
            <div className="flex items-end">
              <button
                type="button"
                className={`${BTN_PRIMARY} w-full`}
                disabled={!configured || Boolean(busy) || (topicId === NEXT && !queued.length) || (topicId === CUSTOM && !customReady)}
                onClick={generate}
              >
                {busy === "write" ? "Writing… about a minute" : "Generate article with AI"}
              </button>
            </div>
          </div>
          <p className="mt-2 text-[13px] text-plum-soft">
            <Link href="/admin/articles/topics" className="font-semibold text-wine underline">
              Manage topics
            </Link>{" "}
            — {queued.length} waiting. Topics already covered by an article are refused.
          </p>
        </div>

        <div className="rounded-xl border border-mist bg-shell/50 p-4">
          <h3 className="text-[15px] font-semibold">One draft every day</h3>
          <label className="mt-3 flex items-start gap-2 text-[14px]">
            <input
              type="checkbox"
              className="mt-1"
              checked={automation.enabled}
              disabled={Boolean(busy)}
              onChange={(event) => saveAutomation({ ...automation, enabled: event.target.checked })}
            />
            Write the next topic in the queue each morning
          </label>
          <label htmlFor="ai-daily-reviewer" className={`${LABEL} mt-3`}>Send daily drafts to</label>
          <select
            id="ai-daily-reviewer"
            className={FIELD}
            value={automation.reviewerId ?? NOBODY}
            disabled={Boolean(busy)}
            onChange={(event) => saveAutomation({ ...automation, reviewerId: event.target.value || null })}
          >
            {reviewers.map((reviewer) => (
              <option key={reviewer.providerId} value={reviewer.providerId}>
                {reviewer.name}
              </option>
            ))}
            <option value={NOBODY}>Nobody — keep them as drafts</option>
          </select>
          <p className="mt-2 text-[12px] text-plum-soft">
            Needs the daily schedule set up on the server (see README → Articles).
            {automation.updatedBy && ` Last changed by ${automation.updatedBy}.`}
          </p>
        </div>
      </div>

      <Notice tone="error">{error}</Notice>
      <Notice tone="ok">{ok}</Notice>

      {generations.length > 0 && (
        <details className="mt-5">
          <summary className="cursor-pointer text-[14px] font-semibold">Recent AI runs</summary>
          <ul className="mt-3 divide-y divide-mist text-[14px]">
            {generations.map((run) => (
              <li key={run.id} className="flex flex-wrap items-baseline justify-between gap-2 py-2">
                <span className="min-w-0">
                  {run.articleId ? (
                    <Link href={`/admin/articles/${run.articleId}`} className="font-medium text-plum hover:text-wine">
                      {run.topic}
                    </Link>
                  ) : (
                    run.topic
                  )}
                  <span className="block text-[12px] text-plum-soft">
                    {formatWhen(run.at)} · {run.trigger === "daily" ? "daily" : run.by}
                    {run.sentTo ? ` · sent to ${run.sentTo}` : ""}
                  </span>
                </span>
                <span className={run.status === "ok" ? "text-sage-ink" : "text-wine-deep"}>
                  {run.status === "ok" ? "Written" : `Failed: ${run.error}`} · {dollars(run.costUsd)}
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
