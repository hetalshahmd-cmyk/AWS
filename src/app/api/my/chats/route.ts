import { NextResponse } from "next/server";
import { ChatError } from "@/lib/chat";
import { listPatientConversations, openConversation } from "@/lib/chat-repo";
import { chatRoute, patientCaller } from "@/lib/chat-routes";
import { getCurrentUser } from "@/lib/auth";
import { limited } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/** GET — the patient's chats with providers. */
export async function GET(request: Request) {
  return chatRoute(request, async () => {
    const caller = await patientCaller();
    return NextResponse.json({ conversations: await listPatientConversations(caller.userId as string) });
  });
}

/** POST `{providerId}` — open (or start) the chat with that provider. */
export async function POST(request: Request) {
  return chatRoute(request, async () => {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Sign in first" }, { status: 401 });
    const blocked = await limited([{ key: `chat-open:${user.id}`, limit: 20, windowSeconds: 3600 }]);
    if (blocked) return blocked;
    const body = (await request.json().catch(() => ({}))) as { providerId?: unknown };
    if (typeof body.providerId !== "string") throw new ChatError("Choose a provider");
    return NextResponse.json({ conversation: await openConversation(user, body.providerId) });
  });
}
