"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import ArticleBody from "@/components/blog/ArticleBody";
import {
  applyLinkSuggestion,
  DESCRIPTION_IDEAL,
  LIMITS,
  linkProblems,
  readingMinutes,
  reviewProblems,
  SEO_TITLE_IDEAL,
  seoChecks,
  slugify,
  suggestLinks,
  wordCount,
  type Article,
  type ArticleContent,
  type LinkTarget,
  type Reviewer,
} from "@/lib/articles";
import { photos, type PhotoKey } from "@/lib/photos";
import { BTN_DANGER, BTN_PRIMARY, BTN_QUIET, CARD, FIELD, LABEL, Notice } from "./ui";
import { ArticleStatusBadge, formatWhen, HistoryList } from "./article-ui";

const EMPTY: ArticleContent = {
  title: "",
  slug: "",
  seoTitle: "",
  description: "",
  focusKeyword: "",
  body: "",
  cover: null,
};

const contentOf = (article: Article | null): ArticleContent =>
  article
    ? {
        title: article.title,
        slug: article.slug,
        seoTitle: article.seoTitle,
        description: article.description,
        focusKeyword: article.focusKeyword,
        body: article.body,
        cover: article.cover,
      }
    : EMPTY;

const same = (a: ArticleContent, b: ArticleContent) => JSON.stringify(a) === JSON.stringify(b);

export default function ArticleEditor({
  initial,
  reviewers,
  targets,
  slugs,
  siteUrl,
}: {
  initial: Article | null;
  reviewers: Reviewer[];
  /** Pages this article can link to. */
  targets: LinkTarget[];
  /** Addresses of the other articles. */
  slugs: string[];
  siteUrl: string;
}) {
  const router = useRouter();
  const [article, setArticle] = useState<Article | null>(initial);
  const [content, setContent] = useState<ArticleContent>(contentOf(initial));
  const [slugTouched, setSlugTouched] = useState(Boolean(initial));
  const [reviewerId, setReviewerId] = useState(initial?.reviewerId ?? reviewers[0]?.providerId ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [preview, setPreview] = useState(true);

  const dirty = !same(content, contentOf(article));
  const slug = content.slug || slugify(content.title);
  const selfHref = `/blog/${slug}`;
  const problems = useMemo(() => linkProblems(content.body, slugs, slug), [content.body, slugs, slug]);
  const suggestions = useMemo(() => suggestLinks(content.body, targets, selfHref), [content.body, targets, selfHref]);
  const checks = useMemo(() => seoChecks({ ...content, slug }), [content, slug]);
  const words = wordCount(content.body);
  const set = <K extends keyof ArticleContent>(key: K, value: ArticleContent[K]) =>
    setContent((current) => ({ ...current, [key]: value }));

  async function send(url: string, method: string, body: unknown) {
    setBusy(true);
    setError("");
    setOk("");
    try {
      const response = await fetch(url, {
        method,
        headers: { "content-type": "application/json" },
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

  async function save(event?: React.FormEvent) {
    event?.preventDefault();
    if (problems.length) {
      setError(`Fix the links first: ${problems[0]}`);
      return;
    }
    if (article?.approval && article.status === "approved") {
      const name = article.approval.name;
      if (!window.confirm(`Saving changes clears ${name}'s medical approval. The article will need a new review before these changes can go live. Save anyway?`)) return;
    }
    const payload = { ...content, slug };
    const data = article
      ? await send(`/api/admin/articles/${article.id}`, "PUT", { ...payload, version: article.version })
      : await send("/api/admin/articles", "POST", payload);
    if (!data) return;
    const saved = data.article as Article;
    setArticle(saved);
    setContent(contentOf(saved));
    setSlugTouched(true);
    setOk("Saved");
    if (!article) router.replace(`/admin/articles/${saved.id}`);
  }

  async function act(action: string, extra: Record<string, unknown> = {}, confirmText?: string) {
    if (!article) return;
    if (confirmText && !window.confirm(confirmText)) return;
    const data = await send(`/api/admin/articles/${article.id}/workflow`, "POST", { action, hash: article.hash, ...extra });
    if (!data) return;
    setArticle(data.article as Article);
    setOk(
      {
        submit: "Sent for medical review",
        withdraw: "Taken back from review",
        publish: "Published — it is on the site now",
        unpublish: "Taken off the site",
      }[action] ?? "Done",
    );
    router.refresh();
  }

  async function remove() {
    if (!article || !window.confirm("Delete this article and its history? This can't be undone.")) return;
    const data = await send(`/api/admin/articles/${article.id}`, "DELETE", undefined);
    if (data) router.push("/admin/articles");
  }

  const seoTitle = content.seoTitle || content.title;
  const [low, high] = DESCRIPTION_IDEAL;

  return (
    <form onSubmit={save} className="mt-6 space-y-6 pb-28">
      {article && (
        <Workflow
          article={article}
          dirty={dirty}
          busy={busy}
          reviewers={reviewers}
          reviewerId={reviewerId}
          setReviewerId={setReviewerId}
          act={act}
          siteUrl={siteUrl}
        />
      )}

      <section className={CARD} aria-labelledby="article-basics">
        <h2 id="article-basics" className="text-[1.1rem] font-semibold">The basics</h2>
        <div className="mt-4 grid gap-4 min-[900px]:grid-cols-2">
          <div className="min-[900px]:col-span-2">
            <label htmlFor="article-title" className={LABEL}>Title (the heading on the page)</label>
            <input
              id="article-title"
              className={FIELD}
              value={content.title}
              maxLength={LIMITS.title}
              required
              onChange={(event) => {
                const title = event.target.value;
                setContent((current) => ({ ...current, title, slug: slugTouched ? current.slug : slugify(title) }));
              }}
            />
          </div>
          <div>
            <label htmlFor="article-slug" className={LABEL}>Web address</label>
            <div className="flex items-center rounded-lg border border-line-strong bg-shell pl-3 text-[15px] text-plum-soft">
              /blog/
              <input
                id="article-slug"
                className="focus-ring w-full rounded-r-lg bg-white px-2 py-2.5 text-plum disabled:bg-shell"
                value={content.slug}
                maxLength={LIMITS.slug}
                disabled={article?.slugLocked}
                onChange={(event) => {
                  setSlugTouched(true);
                  set("slug", event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"));
                }}
              />
            </div>
            <p className="mt-1 text-[12px] text-plum-soft">
              {article?.slugLocked
                ? "Locked: this article has been public, and changing its address would break links to it."
                : "Lowercase words joined by dashes. Fixed once the article has been published."}
            </p>
          </div>
          <div>
            <label htmlFor="article-keyword" className={LABEL}>Focus keyword</label>
            <input
              id="article-keyword"
              className={FIELD}
              value={content.focusKeyword}
              maxLength={LIMITS.focusKeyword}
              placeholder="e.g. first trimester symptoms"
              onChange={(event) => set("focusKeyword", event.target.value)}
            />
            <p className="mt-1 text-[12px] text-plum-soft">The search phrase this article answers. Other articles link here on it.</p>
          </div>
          <div>
            <label htmlFor="article-seo-title" className={LABEL}>
              Search title <Counter value={seoTitle.length} max={SEO_TITLE_IDEAL} />
            </label>
            <input
              id="article-seo-title"
              className={FIELD}
              value={content.seoTitle}
              maxLength={LIMITS.seoTitle}
              placeholder={content.title || "Same as the title"}
              onChange={(event) => set("seoTitle", event.target.value)}
            />
            <p className="mt-1 text-[12px] text-plum-soft">What Google shows as the link. Leave empty to use the title.</p>
          </div>
          <div>
            <label htmlFor="article-description" className={LABEL}>
              Description <Counter value={content.description.length} max={high} min={low} />
            </label>
            <textarea
              id="article-description"
              className={`${FIELD} min-h-[88px]`}
              value={content.description}
              maxLength={LIMITS.description}
              onChange={(event) => set("description", event.target.value)}
            />
            <p className="mt-1 text-[12px] text-plum-soft">Shown under the title on the page and in search results.</p>
          </div>
        </div>

        <SearchPreview title={seoTitle} url={`${siteUrl.replace(/^https?:\/\//, "")}/blog/${slug}`} description={content.description} />
      </section>

      <CoverPicker value={content.cover} onChange={(cover) => set("cover", cover)} />

      <section className={CARD} aria-labelledby="article-text">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="article-text" className="text-[1.1rem] font-semibold">The article</h2>
          <div className="flex items-center gap-3 text-[13px] text-plum-soft">
            <span>{words} words · {readingMinutes(content.body)} min read</span>
            <button type="button" className={BTN_QUIET} onClick={() => setPreview(!preview)} aria-pressed={preview}>
              {preview ? "Hide preview" : "Show preview"}
            </button>
          </div>
        </div>
        <p className="mt-2 text-[13px] text-plum-soft">
          <code>## Heading</code> · <code>### Smaller heading</code> · <code>- bullet</code> · <code>1. step</code> ·{" "}
          <code>**bold**</code> · <code>*italic*</code> · <code>[words](/services)</code> or{" "}
          <code>[source](https://…)</code> · <code>&gt; note</code> · blank line between paragraphs.
        </p>
        <div className={`mt-4 grid gap-4 ${preview ? "min-[1100px]:grid-cols-2" : ""}`}>
          <textarea
            aria-label="Article text"
            className={`${FIELD} min-h-[520px] font-mono text-[14px] leading-relaxed`}
            value={content.body}
            maxLength={LIMITS.body}
            onChange={(event) => set("body", event.target.value)}
          />
          {preview && (
            <div className="max-h-[720px] overflow-y-auto rounded-lg border border-mist bg-ivory p-5" aria-label="Preview">
              {content.title && (
                <p className="mb-4 font-display text-[1.8rem] leading-tight text-plum">{content.title}</p>
              )}
              {content.body ? (
                <ArticleBody body={content.body} />
              ) : (
                <p className="text-plum-soft">The preview shows here as you type.</p>
              )}
            </div>
          )}
        </div>
        {problems.length > 0 && (
          <ul role="alert" className="mt-3 space-y-1 rounded-lg bg-wine-soft px-3 py-2 text-[14px] text-wine-deep">
            {problems.map((problem) => (
              <li key={problem}>{problem}</li>
            ))}
          </ul>
        )}
      </section>

      <div className="grid gap-6 min-[1100px]:grid-cols-2">
        <section className={CARD} aria-labelledby="article-links">
          <h2 id="article-links" className="text-[1.1rem] font-semibold">Suggested links</h2>
          <p className="mt-1 text-[13px] text-plum-soft">
            Places where this article mentions a service, a doctor, the offices, booking or another published article.
            Adding one changes the text, so a medical approval would be needed again.
          </p>
          {suggestions.length ? (
            <ul className="mt-4 divide-y divide-mist">
              {suggestions.map((suggestion) => (
                <li key={`${suggestion.href}-${suggestion.index}`} className="flex items-start justify-between gap-3 py-3">
                  <div className="min-w-0 text-[14px]">
                    <p>
                      <strong>“{suggestion.phrase}”</strong> → {suggestion.title}{" "}
                      <span className="text-plum-soft">({suggestion.href})</span>
                    </p>
                    <p className="mt-0.5 truncate text-[13px] text-plum-soft">{suggestion.context}</p>
                  </div>
                  <button
                    type="button"
                    className={BTN_QUIET}
                    onClick={() => set("body", applyLinkSuggestion(content.body, suggestion))}
                  >
                    Add link
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-[14px] text-plum-soft">No suggestions right now.</p>
          )}
        </section>

        <section className={CARD} aria-labelledby="article-seo">
          <h2 id="article-seo" className="text-[1.1rem] font-semibold">Search checklist</h2>
          <ul className="mt-4 space-y-2 text-[14px]">
            {checks.map((check) => (
              <li key={check.label} className="flex gap-2">
                <span aria-hidden="true" className={check.ok ? "text-sage-ink" : "text-plum-soft"}>
                  {check.ok ? "✓" : "○"}
                </span>
                <span className={check.ok ? "" : "text-plum-soft"}>
                  <span className="sr-only">{check.ok ? "Done: " : "To do: "}</span>
                  {check.label}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[12px] text-plum-soft">Advice only — nothing here blocks saving.</p>
        </section>
      </div>

      {article && (
        <section className={CARD} aria-labelledby="article-history">
          <h2 id="article-history" className="text-[1.1rem] font-semibold">History</h2>
          <HistoryList history={article.history} />
        </section>
      )}

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-mist bg-white/95 backdrop-blur lg:left-[256px]">
        <div className="mx-auto flex max-w-[1200px] flex-wrap items-center gap-3 px-5 py-3 lg:px-10">
          <button type="submit" className={BTN_PRIMARY} disabled={busy || (Boolean(article) && !dirty)}>
            {busy ? "Saving…" : article ? "Save changes" : "Create draft"}
          </button>
          {article && dirty && (
            <button type="button" className={BTN_QUIET} onClick={() => setContent(contentOf(article))} disabled={busy}>
              Undo changes
            </button>
          )}
          <span className="text-[13px] text-plum-soft">{dirty ? "Unsaved changes" : article ? "All changes saved" : ""}</span>
          {article && !article.live && (
            <button type="button" className={`${BTN_DANGER} ml-auto`} onClick={remove} disabled={busy}>
              Delete
            </button>
          )}
          <div className="w-full">
            <Notice tone="error">{error}</Notice>
            <Notice tone="ok">{ok}</Notice>
          </div>
        </div>
      </div>
    </form>
  );
}

function Counter({ value, max, min = 1 }: { value: number; max: number; min?: number }) {
  const good = value >= min && value <= max;
  return (
    <span className={`ml-1 font-normal ${good ? "text-sage-ink" : "text-plum-soft"}`}>
      {value}/{max}
    </span>
  );
}

function SearchPreview({ title, url, description }: { title: string; url: string; description: string }) {
  return (
    <div className="mt-5 rounded-lg border border-mist bg-shell/60 p-4" aria-label="How it may look in Google">
      <p className="text-[12px] font-semibold uppercase tracking-wide text-plum-soft">Search preview</p>
      <p className="mt-2 truncate text-[13px] text-plum-soft">{url}</p>
      <p className="truncate text-[18px] text-[#1a0dab]">{title || "Search title"}</p>
      <p className="line-clamp-2 text-[14px] text-plum-soft">{description || "The description shows here."}</p>
    </div>
  );
}

function CoverPicker({ value, onChange }: { value: PhotoKey | null; onChange: (key: PhotoKey | null) => void }) {
  const keys = Object.keys(photos) as PhotoKey[];
  return (
    <section className={CARD} aria-labelledby="article-cover">
      <h2 id="article-cover" className="text-[1.1rem] font-semibold">Cover picture</h2>
      <p className="mt-1 text-[13px] text-plum-soft">From the practice&apos;s photo library — each has its own description for screen readers.</p>
      <div className="mt-4 grid max-h-80 grid-cols-3 gap-2 overflow-y-auto min-[640px]:grid-cols-5">
        <button
          type="button"
          onClick={() => onChange(null)}
          aria-pressed={value === null}
          className={`focus-ring grid aspect-[4/3] place-items-center rounded-lg border-2 text-[13px] text-plum-soft ${
            value === null ? "border-wine" : "border-mist"
          }`}
        >
          No cover
        </button>
        {keys.map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => onChange(key)}
            aria-pressed={value === key}
            title={photos[key].alt}
            className={`focus-ring relative aspect-[4/3] overflow-hidden rounded-lg border-2 ${
              value === key ? "border-wine" : "border-transparent"
            }`}
          >
            <Image src={photos[key].src} alt={photos[key].alt} fill sizes="160px" className="object-cover" />
          </button>
        ))}
      </div>
    </section>
  );
}

function Workflow({
  article,
  dirty,
  busy,
  reviewers,
  reviewerId,
  setReviewerId,
  act,
  siteUrl,
}: {
  article: Article;
  dirty: boolean;
  busy: boolean;
  reviewers: Reviewer[];
  reviewerId: string;
  setReviewerId: (id: string) => void;
  act: (action: string, extra?: Record<string, unknown>, confirmText?: string) => void;
  siteUrl: string;
}) {
  const reviewer = reviewers.find((item) => item.providerId === article.reviewerId);
  const notReady = reviewProblems(article);
  const liveDiffers = article.live && article.live.hash !== article.hash;
  const saveFirst = dirty ? <p className="mt-2 text-[13px] text-plum-soft">Save your changes first.</p> : null;

  return (
    <section className={CARD} aria-labelledby="article-workflow">
      <div className="flex flex-wrap items-center gap-3">
        <h2 id="article-workflow" className="text-[1.1rem] font-semibold">Medical review &amp; publishing</h2>
        <ArticleStatusBadge status={article.status} />
        {article.live && (
          <span className="rounded-full bg-sage-soft px-2.5 py-1 text-[12px] font-semibold text-sage-ink">On the site</span>
        )}
      </div>

      {article.origin?.type === "ai" && (
        <p className="mt-3 text-[14px] text-plum-soft">
          First draft written by AI ({article.origin.model}). Read it through before sending it on: the doctor checks
          the medicine, you check that it sounds like us.
        </p>
      )}

      {article.live && (
        <p className="mt-3 text-[14px]">
          Public since {formatWhen(article.live.publishedAt)}, last updated {formatWhen(article.live.updatedAt)} ·{" "}
          <a href={`/blog/${article.live.slug}`} target="_blank" rel="noopener" className="font-semibold text-wine underline">
            View on the site ↗
          </a>
          {liveDiffers && (
            <span className="mt-1 block text-plum-soft">
              The site keeps showing the last approved version. Your newer text goes live only after it is approved and published.
            </span>
          )}
        </p>
      )}

      {(article.status === "draft" || article.status === "changes_requested") && (
        <div className="mt-4">
          {article.status === "changes_requested" && article.reviewNote && (
            <div className="mb-4 rounded-lg bg-wine-soft px-4 py-3 text-[14px] text-wine-deep">
              <p className="font-semibold">{reviewer?.name ?? "The reviewer"} asked for changes:</p>
              <p className="mt-1 whitespace-pre-line">{article.reviewNote}</p>
            </div>
          )}
          {reviewers.length === 0 ? (
            <p className="text-[14px] text-plum-soft">
              No doctor has a sign-in yet. Add one under Settings before sending articles for review.
            </p>
          ) : (
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label htmlFor="article-reviewer" className={LABEL}>Reviewing doctor</label>
                <select id="article-reviewer" className={FIELD} value={reviewerId} onChange={(event) => setReviewerId(event.target.value)}>
                  {reviewers.map((item) => (
                    <option key={item.providerId} value={item.providerId}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="button"
                className={BTN_PRIMARY}
                disabled={busy || dirty || notReady.length > 0 || !reviewerId}
                onClick={() => act("submit", { reviewerId })}
              >
                Send for medical review
              </button>
            </div>
          )}
          {notReady.length > 0 && <p className="mt-2 text-[13px] text-plum-soft">Before review: {notReady.join("; ")}.</p>}
          {saveFirst}
        </div>
      )}

      {article.status === "in_review" && (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <p className="text-[14px]">Waiting for {reviewer?.name ?? "the doctor"} to review it.</p>
          <button type="button" className={BTN_QUIET} disabled={busy} onClick={() => act("withdraw")}>
            Take back
          </button>
        </div>
      )}

      {article.status === "approved" && article.approval && (
        <div className="mt-4">
          <p className="text-[14px]">
            Approved by <strong>{article.approval.name}</strong> on {formatWhen(article.approval.at)}.
          </p>
          {!liveDiffers && article.live ? null : (
            <button
              type="button"
              className={`${BTN_PRIMARY} mt-3`}
              disabled={busy || dirty}
              onClick={() =>
                act(
                  "publish",
                  {},
                  `Publish "${article.title}" on ${siteUrl.replace(/^https?:\/\//, "")}/blog/${article.slug}? Anyone will be able to read it.`,
                )
              }
            >
              {article.live ? "Publish the update" : "Publish on the site"}
            </button>
          )}
          {saveFirst}
        </div>
      )}

      {article.live && (
        <button
          type="button"
          className={`${BTN_DANGER} mt-4`}
          disabled={busy}
          onClick={() => act("unpublish", {}, "Take this article off the site? Its page will stop working until it is published again.")}
        >
          Take off the site
        </button>
      )}
    </section>
  );
}

