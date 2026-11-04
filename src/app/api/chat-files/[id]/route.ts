import { NextResponse } from "next/server";
import { getCurrentAdmin, getCurrentUser } from "@/lib/auth";
import { readChatImage, type ChatAccess } from "@/lib/chat-repo";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

const EXTENSIONS: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

/**
 * GET `?as=patient|staff[&download=1]` — a picture from a chat. Private and
 * never cached; anyone not in the chat (or an admin) gets "not found".
 */
export async function GET(request: Request, ctx: Ctx) {
  const url = new URL(request.url);
  let access: ChatAccess | null = null;
  if (url.searchParams.get("as") === "patient") {
    const user = await getCurrentUser().catch(() => null);
    if (user) access = { viewer: "patient", userId: user.id };
  } else {
    const staff = await getCurrentAdmin().catch(() => null);
    if (staff) access = staff.role === "admin" ? { viewer: "admin" } : { viewer: "provider", providerId: staff.providerId };
  }
  if (!access) return NextResponse.json({ error: "Sign in first" }, { status: 401 });
  const image = await readChatImage((await ctx.params).id, access);
  if (!image) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return new NextResponse(new Uint8Array(image.data), {
    headers: {
      "Content-Type": image.contentType,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      ...(url.searchParams.has("download")
        ? { "Content-Disposition": `attachment; filename="chat-photo.${EXTENSIONS[image.contentType] ?? "jpg"}"` }
        : {}),
    },
  });
}
