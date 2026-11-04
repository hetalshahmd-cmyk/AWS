import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import ArticleEditor from "@/components/admin/ArticleEditor";
import { articleSlugs, getArticle, linkTargets, listReviewers } from "@/lib/articles-repo";
import { requireAdminPage } from "@/lib/auth";

export const metadata: Metadata = { title: "Edit article — Admin" };
export const dynamic = "force-dynamic";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://arizonawomenspecialists.com";

export default async function EditArticlePage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdminPage();
  const article = await getArticle((await params).id);
  if (!article) notFound();
  const [reviewers, targets, slugs] = await Promise.all([listReviewers(), linkTargets(), articleSlugs()]);

  return (
    <div>
      <Link href="/admin/articles" className="text-[14px] font-medium text-plum-soft hover:text-wine">
        ← Articles
      </Link>
      <h1 className="mt-2 font-display text-[1.9rem] font-semibold">{article.title}</h1>
      <ArticleEditor
        key={article.id}
        initial={article}
        reviewers={reviewers}
        targets={targets}
        slugs={slugs.filter((slug) => slug !== article.slug)}
        siteUrl={SITE_URL}
      />
    </div>
  );
}
