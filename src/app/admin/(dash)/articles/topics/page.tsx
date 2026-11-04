import type { Metadata } from "next";
import Link from "next/link";
import TopicManager from "@/components/admin/TopicManager";
import { listTopics } from "@/lib/article-writer";
import { requireAdminPage } from "@/lib/auth";

export const metadata: Metadata = { title: "Article topics — Admin" };
export const dynamic = "force-dynamic";

export default async function TopicsPage() {
  await requireAdminPage();
  const topics = await listTopics();

  return (
    <div>
      <Link href="/admin/articles" className="text-[14px] font-medium text-plum-soft hover:text-wine">
        ← Articles
      </Link>
      <h1 className="mt-2 font-display text-[1.9rem] font-semibold">Article topics</h1>
      <p className="mt-1 max-w-[70ch] text-plum-soft">
        What the AI writer works through, oldest first. A topic that repeats another topic or an existing article is
        refused, so the blog never covers the same question twice.
      </p>
      <TopicManager initial={topics} />
    </div>
  );
}
