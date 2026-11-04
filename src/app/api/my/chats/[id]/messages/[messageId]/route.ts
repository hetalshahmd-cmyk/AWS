import { NextResponse } from "next/server";
import { deleteMessage } from "@/lib/chat-repo";
import { chatRoute, notFound, patientCaller, writer } from "@/lib/chat-routes";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string; messageId: string }> };

/** DELETE — delete your own message for everyone (within an hour). */
export async function DELETE(request: Request, ctx: Ctx) {
  return chatRoute(request, async () => {
    const caller = writer(await patientCaller());
    const { id, messageId } = await ctx.params;
    const message = await deleteMessage(id, messageId, caller);
    return message ? NextResponse.json({ message }) : notFound();
  });
}
