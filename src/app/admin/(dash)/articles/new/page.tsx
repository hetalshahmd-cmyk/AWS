import type { Metadata } from "next";
import Link from "next/link";
import ArticleEditor from "@/components/admin/ArticleEditor";
import { articleSlugs, linkTargets, listReviewers } from "@/lib/articles-repo";
import { requireAdminPage } from "@/lib/auth";

export const metadata: Metadata = { title: "New article — Admin" };
export const dynamic = "force-dynamic";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://arizonawomenspecialists.com";

export default async function NewArticlePage() {
  await requireAdminPage();
  const [reviewers, targets, slugs] = await Promise.all([listReviewers(), linkTargets(), articleSlugs()]);

  return (
    <div>
      <Link href="/admin/articles" className="text-[14px] font-medium text-plum-soft hover:text-wine">
        ← Articles
      </Link>
      <h1 className="mt-2 font-display text-[1.9rem] font-semibold">New article</h1>
      <p className="mt-1 max-w-[70ch] text-plum-soft">Starts as a draft. Nothing is public until a doctor approves it and you publish it.</p>
      <ArticleEditor initial={null} reviewers={reviewers} targets={targets} slugs={slugs} siteUrl={SITE_URL} />
    </div>
  );
}
