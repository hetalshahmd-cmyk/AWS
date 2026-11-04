import type { MetadataRoute } from "next";
import { listLiveArticles } from "@/lib/articles-repo";

// Read at request time: articles are published from the admin panel.
export const dynamic = "force-dynamic";

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://arizonawomenspecialists.com").replace(/\/+$/, "");

/** The public pages only — never sign-in, patient, staff or API addresses. */
const PAGES: { path: string; priority: number }[] = [
  { path: "/", priority: 1 },
  { path: "/services", priority: 0.9 },
  { path: "/about", priority: 0.8 },
  { path: "/insurance", priority: 0.8 },
  { path: "/self-pay", priority: 0.8 },
  { path: "/contact", priority: 0.8 },
  { path: "/privacy", priority: 0.3 },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = PAGES.map(({ path, priority }) => ({
    url: `${SITE_URL}${path === "/" ? "" : path}`,
    changeFrequency: "monthly",
    priority,
  }));
  // If the database can't be reached the fixed pages are still listed.
  const articles = await listLiveArticles(1000).catch((error: unknown) => {
    console.error("sitemap: could not load articles", error);
    return [];
  });
  if (articles.length) {
    entries.push({ url: `${SITE_URL}/blog`, lastModified: new Date(articles[0].updatedAt), changeFrequency: "weekly", priority: 0.7 });
    for (const article of articles) {
      entries.push({
        url: `${SITE_URL}/blog/${article.slug}`,
        lastModified: new Date(article.updatedAt),
        changeFrequency: "monthly",
        priority: 0.6,
      });
    }
  }
  return entries;
}
