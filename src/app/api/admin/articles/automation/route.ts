import { NextResponse } from "next/server";
import { TopicError } from "@/lib/article-ai";
import { articleModel, getAutomation, saveAutomation, writerConfigured } from "@/lib/article-writer";
import { adminRoute, readJson } from "@/lib/api-helpers";
import { requireAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** GET — the daily-draft switch, its reviewer, and whether the AI is set up. */
export const GET = adminRoute(async () => {
  return NextResponse.json({ automation: await getAutomation(), configured: writerConfigured(), model: articleModel() });
});

/** PUT `{enabled, reviewerId}` — switch daily drafts on or off. */
export const PUT = adminRoute(async (request) => {
  const staff = await requireAdmin();
  const body = await readJson<{ enabled?: unknown; reviewerId?: unknown }>(request);
  try {
    return NextResponse.json({ automation: await saveAutomation(body, staff) });
  } catch (error) {
    if (error instanceof TopicError) return NextResponse.json({ error: error.message }, { status: 400 });
    throw error;
  }
});
