import { NextResponse } from "next/server";
import { readConversation } from "@/lib/chat-repo";
import { chatRoute, notFound, patientCaller } from "@/lib/chat-routes";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** GET `?after=` — the chat and its messages (only what changed since `after`). */
export async function GET(request: Request, ctx: Ctx) {
  return chatRoute(request, async () => {
    const caller = await patientCaller();
    const after = new URL(request.url).searchParams.get("after");
    const result = await readConversation((await ctx.params).id, caller, after);
    return result ? NextResponse.json(result) : notFound();
  });
}
