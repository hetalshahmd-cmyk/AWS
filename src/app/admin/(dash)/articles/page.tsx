import type { Metadata } from "next";
import Link from "next/link";
import ArticleAiPanel from "@/components/admin/ArticleAiPanel";
import { ArticleStatusBadge, formatWhen } from "@/components/admin/article-ui";
import { BTN_PRIMARY, BTN_QUIET, CARD } from "@/components/admin/ui";
import {
  articleModel,
  getAutomation,
  listGenerations,
  listTopics,
  monthUsage,
  writerConfigured,
} from "@/lib/article-writer";
import { listArticles, listReviewers } from "@/lib/articles-repo";
import { requireAdminPage } from "@/lib/auth";
import { providerById } from "@/lib/scheduling";

export const metadata: Metadata = { title: "Articles — Admin" };
export const dynamic = "force-dynamic";

export default async function ArticlesPage() {
  await requireAdminPage();
  const [articles, reviewers, automation, topics, usage, generations] = await Promise.all([
    listArticles(),
    listReviewers(),
    getAutomation(),
    listTopics(),
    monthUsage(),
    listGenerations(10),
  ]);
  const queued = topics.filter((topic) => topic.status === "queued").map((topic) => ({ id: topic.id, title: topic.title }));

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-[1.9rem] font-semibold">Articles</h1>
          <p className="mt-1 max-w-[70ch] text-plum-soft">
            Health articles for the blog. Every article is checked by one of our doctors before it can be published,
            and any change to the text needs their approval again.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/admin/articles/topics" className={BTN_QUIET}>
            Topics
          </Link>
          <Link href="/admin/articles/new" className={BTN_PRIMARY}>
            New article
          </Link>
        </div>
      </div>

      <ArticleAiPanel
        configured={writerConfigured()}
        model={articleModel()}
        automation={automation}
        reviewers={reviewers}
        queued={queued}
        usage={usage}
        generations={generations}
      />

      <div className={`${CARD} mt-6 overflow-x-auto p-0`}>
        {articles.length === 0 ? (
          <p className="p-6 text-plum-soft">No articles yet.</p>
        ) : (
          <table className="w-full min-w-[980px] text-left text-[14px]">
            <thead className="border-b border-mist text-[12px] uppercase tracking-wide text-plum-soft">
              <tr>
                <th scope="col" className="px-5 py-3 font-semibold">Title</th>
                <th scope="col" className="px-5 py-3 font-semibold">Status</th>
                <th scope="col" className="px-5 py-3 font-semibold">Reviewer</th>
                <th scope="col" className="px-5 py-3 font-semibold">Search</th>
                <th scope="col" className="px-5 py-3 font-semibold">Published</th>
                <th scope="col" className="px-5 py-3 font-semibold">Last change</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-mist">
              {articles.map((article) => (
                <tr key={article.id} className="align-top">
                  <td className="px-5 py-3">
                    <Link href={`/admin/articles/${article.id}`} className="font-semibold text-plum hover:text-wine">
                      {article.title}
                    </Link>
                    <span className="block text-[12px] text-plum-soft">
                      /blog/{article.slug}
                      {article.source === "ai" && (
                        <span className="ml-2 rounded bg-shell px-1.5 py-0.5 font-semibold text-plum-soft">AI draft</span>
                      )}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <ArticleStatusBadge status={article.status} />
                  </td>
                  <td className="px-5 py-3">{providerById(article.reviewerId)?.name ?? "—"}</td>
                  <td className="px-5 py-3">
                    <span className={article.seo.passed >= article.seo.total - 2 ? "text-sage-ink" : "text-plum-soft"}>
                      {article.seo.passed}/{article.seo.total} checks
                    </span>
                    <span className="block max-w-[220px] truncate text-[12px] text-plum-soft" title={article.seoTitle || article.title}>
                      {article.focusKeyword || "No focus keyword"}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    {article.live ? (
                      <>
                        {formatWhen(article.live.publishedAt)}
                        {article.live.hash !== article.hash && (
                          <span className="block text-[12px] text-plum-soft">Newer text not yet published</span>
                        )}
                      </>
                    ) : (
                      <span className="text-plum-soft">Not published</span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-plum-soft">{formatWhen(article.updatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
