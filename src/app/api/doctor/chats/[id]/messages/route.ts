import { NextResponse } from "next/server";
import { sendMessage } from "@/lib/chat-repo";
import { chatRoute, notFound, staffCaller, writer } from "@/lib/chat-routes";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** POST (multipart `text`, optional `image`) — send a message. */
export async function POST(request: Request, ctx: Ctx) {
  return chatRoute(request, async () => {
    const caller = writer(await staffCaller());
    if (Number(request.headers.get("content-length") ?? 0) > 8 * 1024 * 1024) {
      return NextResponse.json({ error: "That picture is too large (6 MB max)" }, { status: 413 });
    }
    const form = await request.formData().catch(() => null);
    if (!form) return NextResponse.json({ error: "Invalid message" }, { status: 400 });
    const image = form.get("image");
    const message = await sendMessage((await ctx.params).id, caller, {
      text: form.get("text"),
      image: image instanceof File && image.size > 0 ? image : null,
    });
    return message ? NextResponse.json({ message }, { status: 201 }) : notFound();
  });
}
