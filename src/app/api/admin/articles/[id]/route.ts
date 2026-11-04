import { NextResponse } from "next/server";
import { adminRoute, readJson } from "@/lib/api-helpers";
import { ArticleError } from "@/lib/articles";
import { ArticleConflictError, ArticleLiveError, deleteArticle, getArticle, saveArticle } from "@/lib/articles-repo";
import { requireAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

const notFound = () => NextResponse.json({ error: "Article not found" }, { status: 404 });

/** GET — one article with its history. */
export const GET = adminRoute(async (_request, ctx: Ctx) => {
  const article = await getArticle((await ctx.params).id);
  return article ? NextResponse.json({ article }) : notFound();
});

/**
 * PUT `{version, title, …}` — save the text. Refused (409) if the article
 * changed since `version`. Changed text clears a medical approval.
 */
export const PUT = adminRoute(async (request, ctx: Ctx) => {
  const staff = await requireAdmin();
  const body = await readJson<Record<string, unknown>>(request);
  try {
    const article = await saveArticle((await ctx.params).id, body, body.version, staff);
    return article ? NextResponse.json({ article }) : notFound();
  } catch (error) {
    if (error instanceof ArticleError) return NextResponse.json({ error: error.message }, { status: 400 });
    if (error instanceof ArticleConflictError) return NextResponse.json({ error: error.message }, { status: 409 });
    throw error;
  }
});

/** DELETE — only an article that isn't on the site. */
export const DELETE = adminRoute(async (_request, ctx: Ctx) => {
  try {
    return (await deleteArticle((await ctx.params).id)) ? NextResponse.json({ ok: true }) : notFound();
  } catch (error) {
    if (error instanceof ArticleLiveError) return NextResponse.json({ error: error.message }, { status: 409 });
    throw error;
  }
});
