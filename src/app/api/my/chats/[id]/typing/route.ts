import { NextResponse } from "next/server";
import { setTyping } from "@/lib/chat-repo";
import { chatRoute, notFound, patientCaller, writer } from "@/lib/chat-routes";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** POST — "typing…" for a few seconds on the other side. */
export async function POST(request: Request, ctx: Ctx) {
  return chatRoute(request, async () => {
    const caller = writer(await patientCaller());
    return (await setTyping((await ctx.params).id, caller)) ? NextResponse.json({ ok: true }) : notFound();
  });
}
