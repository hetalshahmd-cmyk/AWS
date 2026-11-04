import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { runDailyGeneration } from "@/lib/article-writer";
import { isPreviewDeploy } from "@/lib/deploy-env";

export const dynamic = "force-dynamic";
// Writing a draft takes the AI about a minute.
export const maxDuration = 300;

/**
 * The daily AI article draft. Meant for a scheduler (Vercel Cron) sending
 * `Authorization: Bearer $CRON_SECRET`. Writes nothing unless daily drafts are
 * switched on in Admin → Articles, and at most one draft per Arizona day
 * however often it is called. Drafts are never published by this.
 */
function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export async function GET(request: Request) {
  if (isPreviewDeploy()) {
    return NextResponse.json({ error: "Daily drafts run on the live site only" }, { status: 403 });
  }
  if (!authorized(request)) {
    return NextResponse.json({ error: "Not authorized" }, { status: 401 });
  }
  const result = await runDailyGeneration();
  console.info("daily article draft", result);
  return NextResponse.json(result);
}
