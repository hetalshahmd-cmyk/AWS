import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import ArticleReview from "@/components/admin/ArticleReview";
import { ArticleStatusBadge, formatWhen, HistoryList } from "@/components/admin/article-ui";
import { CARD } from "@/components/admin/ui";
import ArticleBody from "@/components/blog/ArticleBody";
import { articleLinks, classifyHref, readingMinutes, wordCount } from "@/lib/articles";
import { getArticle } from "@/lib/articles-repo";
import { getCurrentAdmin } from "@/lib/auth";
import { photos } from "@/lib/photos";

export const metadata: Metadata = { title: "Review article — Provider" };
export const dynamic = "force-dynamic";

export default async function ReviewArticlePage({ params }: { params: Promise<{ id: string }> }) {
  const staff = await getCurrentAdmin().catch(() => null);
  if (!staff || staff.role !== "provider" || !staff.providerId) redirect("/login");
  const article = await getArticle((await params).id);
  // A doctor sees only the articles sent to them, or that they approved.
  if (!article || (article.reviewerId !== staff.providerId && article.approval?.providerId !== staff.providerId)) {
    notFound();
  }
  const sources = articleLinks(article.body).filter((link) => classifyHref(link.href) === "external");
  const waiting = article.status === "in_review" && article.reviewerId === staff.providerId;
  const approvedByMe = article.status === "approved" && article.approval?.providerId === staff.providerId;

  return (
    <div>
      <Link href="/admin/doctor/reviews" className="text-[14px] font-medium text-plum-soft hover:text-wine">
        ← Article reviews
      </Link>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <h1 className="font-display text-[1.9rem] font-semibold leading-tight">Review: {article.title}</h1>
        <ArticleStatusBadge status={article.status} />
      </div>
      <p className="mt-1 text-plum-soft">
        {wordCount(article.body)} words · {readingMinutes(article.body)} min read · last changed{" "}
        {formatWhen(article.updatedAt)}
      </p>

      {article.origin?.type === "ai" && (
        <p role="note" className="mt-4 max-w-[90ch] rounded-lg bg-[#fdf1d8] px-4 py-3 text-[14px] text-[#5c3d0c]">
          <strong>Written with AI.</strong> AI can state things confidently that are wrong or out of date. Please check
          every medical statement against the sources listed, and ask for changes if anything is unclear.
        </p>
      )}

      <div className="mt-6 grid gap-6 min-[1100px]:grid-cols-[minmax(0,1fr)_340px]">
        <article className={`${CARD} min-w-0`} aria-label="The article as readers will see it">
          {article.cover && (
            <div className="relative mb-6 aspect-[16/9] overflow-hidden rounded-xl">
              <Image
                src={photos[article.cover].src}
                alt={photos[article.cover].alt}
                fill
                sizes="720px"
                className="object-cover"
              />
            </div>
          )}
          <p className="font-display text-[2rem] leading-tight text-plum">{article.title}</p>
          <p className="mt-3 text-[1.1rem] text-plum-soft">{article.description}</p>
          <div className="mt-8">
            <ArticleBody body={article.body} />
          </div>
        </article>

        <aside className="space-y-6">
          {waiting ? (
            <ArticleReview id={article.id} hash={article.hash} />
          ) : (
            <div className={CARD}>
              <p className="text-[14px]">
                {approvedByMe && article.approval
                  ? `You approved this version on ${formatWhen(article.approval.at)}.`
                  : "This article isn't waiting for your review. If it is sent to you again, it will show under Article reviews."}
              </p>
            </div>
          )}
          <div className={CARD}>
            <h2 className="text-[1rem] font-semibold">Sources cited ({sources.length})</h2>
            {sources.length ? (
              <ul className="mt-3 space-y-2 text-[14px]">
                {sources.map((source, index) => (
                  <li key={`${source.href}-${index}`} className="break-words">
                    <a href={source.href} target="_blank" rel="noopener noreferrer" className="text-wine underline">
                      {source.text}
                    </a>
                    <span className="block text-[12px] text-plum-soft">{source.href}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-[14px] text-plum-soft">No outside sources are linked.</p>
            )}
          </div>
          <div className={CARD}>
            <h2 className="text-[1rem] font-semibold">Search details</h2>
            <dl className="mt-3 space-y-2 text-[14px]">
              <div>
                <dt className="text-plum-soft">Address</dt>
                <dd>/blog/{article.slug}</dd>
              </div>
              <div>
                <dt className="text-plum-soft">Search title</dt>
                <dd>{article.seoTitle || article.title}</dd>
              </div>
              <div>
                <dt className="text-plum-soft">Description</dt>
                <dd>{article.description || "—"}</dd>
              </div>
              <div>
                <dt className="text-plum-soft">Focus keyword</dt>
                <dd>{article.focusKeyword || "—"}</dd>
              </div>
            </dl>
          </div>
          <div className={CARD}>
            <h2 className="text-[1rem] font-semibold">History</h2>
            <HistoryList history={article.history} />
          </div>
        </aside>
      </div>
    </div>
  );
}
