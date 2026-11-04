import { NextResponse } from "next/server";
import { TopicError } from "@/lib/article-ai";
import { addTopic, listTopics } from "@/lib/article-writer";
import { adminRoute, readJson } from "@/lib/api-helpers";

export const dynamic = "force-dynamic";

/** GET — every topic: waiting, being written, used and skipped. */
export const GET = adminRoute(async () => {
  return NextResponse.json({ topics: await listTopics() });
});

/** POST `{title, focusKeyword, category, location?, notes?}` — refused if it repeats a topic or an article. */
export const POST = adminRoute(async (request) => {
  const body = await readJson<unknown>(request);
  try {
    return NextResponse.json({ topic: await addTopic(body) }, { status: 201 });
  } catch (error) {
    if (error instanceof TopicError) return NextResponse.json({ error: error.message }, { status: 400 });
    throw error;
  }
});
