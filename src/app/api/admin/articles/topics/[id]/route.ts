import { NextResponse } from "next/server";
import { deleteTopic, setTopicStatus } from "@/lib/article-writer";
import { adminRoute, readJson } from "@/lib/api-helpers";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** PATCH `{status: "queued" | "skipped"}` — skip a topic or put it back in the queue. */
export const PATCH = adminRoute(async (request, ctx: Ctx) => {
  const body = await readJson<{ status?: unknown }>(request);
  if (body.status !== "queued" && body.status !== "skipped") {
    return NextResponse.json({ error: "Status must be queued or skipped" }, { status: 400 });
  }
  const topic = await setTopicStatus((await ctx.params).id, body.status);
  return topic
    ? NextResponse.json({ topic })
    : NextResponse.json({ error: "Only a waiting or skipped topic can change" }, { status: 409 });
});

/** DELETE — remove a topic (not while it is being written). */
export const DELETE = adminRoute(async (_request, ctx: Ctx) => {
  return (await deleteTopic((await ctx.params).id))
    ? NextResponse.json({ ok: true })
    : NextResponse.json({ error: "Topic not found or being written" }, { status: 404 });
});
