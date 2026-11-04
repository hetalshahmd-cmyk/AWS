import { NextResponse } from "next/server";
import { markRead } from "@/lib/chat-repo";
import { chatRoute, notFound, staffCaller, writer } from "@/lib/chat-routes";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** POST — everything in the chat has been read (blue ✓✓ for the other side). */
export async function POST(request: Request, ctx: Ctx) {
  return chatRoute(request, async () => {
    const caller = writer(await staffCaller());
    return (await markRead((await ctx.params).id, caller)) ? NextResponse.json({ ok: true }) : notFound();
  });
}
