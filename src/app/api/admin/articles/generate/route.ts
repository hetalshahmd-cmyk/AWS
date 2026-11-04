import { NextResponse } from "next/server";
import { TopicError, WriterError } from "@/lib/article-ai";
import { generateArticle, WriterLimitError, WriterUnavailableError } from "@/lib/article-writer";
import { ArticleError } from "@/lib/articles";
import { adminRoute, readJson } from "@/lib/api-helpers";
import { requireAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";
// Writing a draft takes the AI about a minute.
export const maxDuration = 300;

/**
 * POST `{topicId?, customTopic?, reviewerId?}` — write one AI draft: from a
 * chosen topic, a typed-in one, or the next in the queue. With `reviewerId`
 * the draft goes straight to that doctor's review queue.
 */
export const POST = adminRoute(async (request) => {
  const staff = await requireAdmin();
  const body = await readJson<Record<string, unknown>>(request);
  try {
    const result = await generateArticle({
      trigger: "manual",
      staff,
      topicId: typeof body.topicId === "string" && body.topicId ? body.topicId : null,
      customTopic: body.customTopic && typeof body.customTopic === "object" ? body.customTopic : undefined,
      reviewerId: typeof body.reviewerId === "string" && body.reviewerId ? body.reviewerId : null,
    });
    return NextResponse.json(
      { article: { id: result.article.id, title: result.article.title, status: result.article.status }, sentTo: result.sentTo, warning: result.warning, generation: result.generation },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof WriterUnavailableError) return NextResponse.json({ error: error.message }, { status: 503 });
    if (error instanceof WriterLimitError) return NextResponse.json({ error: error.message }, { status: 429 });
    if (error instanceof TopicError || error instanceof ArticleError) return NextResponse.json({ error: error.message }, { status: 400 });
    if (error instanceof WriterError) return NextResponse.json({ error: error.message }, { status: 502 });
    throw error;
  }
});
