import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArticleStatusBadge, formatWhen } from "@/components/admin/article-ui";
import { CARD } from "@/components/admin/ui";
import { listReviewedBy, listReviewQueue, type ArticleSummary } from "@/lib/articles-repo";
import { getCurrentAdmin } from "@/lib/auth";
import { isProviderId } from "@/lib/scheduling";

export const metadata: Metadata = { title: "Article reviews — Provider" };
export const dynamic = "force-dynamic";

export default async function ReviewsPage() {
  const staff = await getCurrentAdmin().catch(() => null);
  if (!staff || staff.role !== "provider" || !isProviderId(staff.providerId)) redirect("/login");
  const [queue, reviewed] = await Promise.all([listReviewQueue(staff.providerId), listReviewedBy(staff.providerId)]);

  return (
    <div>
      <h1 className="font-display text-[1.9rem] font-semibold">Article reviews</h1>
      <p className="mt-1 max-w-[70ch] text-plum-soft">
        Health articles waiting for your medical review. Nothing is published without your approval, and any later
        change to the text comes back to you.
      </p>

      <h2 className="mt-8 text-[1.15rem] font-semibold">Waiting for you ({queue.length})</h2>
      <ArticleRows articles={queue} empty="Nothing to review right now." />

      <h2 className="mt-10 text-[1.15rem] font-semibold">Approved by you</h2>
      <ArticleRows articles={reviewed} empty="You haven't approved any articles yet." />
    </div>
  );
}

function ArticleRows({ articles, empty }: { articles: ArticleSummary[]; empty: string }) {
  if (!articles.length) return <p className={`${CARD} mt-3 text-plum-soft`}>{empty}</p>;
  return (
    <ul className={`${CARD} mt-3 divide-y divide-mist p-0`}>
      {articles.map((article) => (
        <li key={article.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
          <div className="min-w-0">
            <Link href={`/admin/doctor/reviews/${article.id}`} className="font-semibold text-plum hover:text-wine">
              {article.title}
            </Link>
            <p className="text-[13px] text-plum-soft">
              {article.approval
                ? `You approved it ${formatWhen(article.approval.at)}`
                : `Updated ${formatWhen(article.updatedAt)}`}
              {article.live ? " · on the site" : ""}
            </p>
          </div>
          <ArticleStatusBadge status={article.status} />
        </li>
      ))}
    </ul>
  );
}
