import type { Metadata } from "next";
import ChatApp from "@/components/chat/ChatApp";
import { requireTeamPage } from "@/lib/auth";
import { listStaffConversations } from "@/lib/chat-repo";

export const metadata: Metadata = { title: "Patient chats — Front desk" };
export const dynamic = "force-dynamic";

export default async function TeamMessagesPage({ searchParams }: { searchParams: Promise<{ chat?: string }> }) {
  await requireTeamPage();
  const { chat } = await searchParams;
  const conversations = await listStaffConversations("admin", null);
  const openId = typeof chat === "string" && conversations.some((item) => item.id === chat) ? chat : null;
  return (
    <div>
      <h1 className="font-display text-[1.9rem] font-semibold">Patient chats</h1>
      <p className="mb-5 mt-1 max-w-[75ch] text-plum-soft">
        Chats between patients and providers, read only. Reading here doesn&apos;t mark anything read.
      </p>
      <ChatApp viewer="admin" api="/api/doctor/chats" initial={conversations} initialId={openId} />
    </div>
  );
}
