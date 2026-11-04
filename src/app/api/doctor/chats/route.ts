import { NextResponse } from "next/server";
import { listStaffConversations } from "@/lib/chat-repo";
import { chatRoute, staffCaller } from "@/lib/chat-routes";

export const dynamic = "force-dynamic";

/** GET — a provider's chats, or every chat for an admin (read only). */
export async function GET(request: Request) {
  return chatRoute(request, async () => {
    const caller = await staffCaller();
    const viewer = caller.viewer === "admin" ? "admin" : "provider";
    return NextResponse.json({ conversations: await listStaffConversations(viewer, caller.providerId ?? null) });
  });
}
