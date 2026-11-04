import { NextResponse } from "next/server";
import { adminRoute, readJson } from "@/lib/api-helpers";
import { ArticleError } from "@/lib/articles";
import { createArticle, listArticles } from "@/lib/articles-repo";
import { requireAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** GET — every article, newest change first (without the text). */
export const GET = adminRoute(async () => {
  return NextResponse.json({ articles: await listArticles() });
});

/** POST `{title, slug?, seoTitle, description, focusKeyword, body, cover}` — a new draft. */
export const POST = adminRoute(async (request) => {
  const staff = await requireAdmin();
  const body = await readJson<unknown>(request);
  try {
    return NextResponse.json({ article: await createArticle(body, staff) }, { status: 201 });
  } catch (error) {
    if (error instanceof ArticleError) return NextResponse.json({ error: error.message }, { status: 400 });
    throw error;
  }
});
