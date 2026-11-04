import type { Metadata } from "next";
import ChatApp from "@/components/chat/ChatApp";
import { requireAdminPage } from "@/lib/auth";
import { listStaffConversations } from "@/lib/chat-repo";

export const metadata: Metadata = { title: "Patient chats — Admin" };
export const dynamic = "force-dynamic";

/** Every patient ↔ provider chat, read only — including messages deleted later. */
export default async function AdminMessagesPage({ searchParams }: { searchParams: Promise<{ chat?: string }> }) {
  await requireAdminPage();
  const { chat } = await searchParams;
  const conversations = await listStaffConversations("admin", null);
  const openId = typeof chat === "string" && conversations.some((item) => item.id === chat) ? chat : null;

  return (
    <div>
      <h1 className="font-display text-[1.9rem] font-semibold">Patient chats</h1>
      <p className="mb-5 mt-1 max-w-[75ch] text-plum-soft">
        Every chat between patients and providers, as it happens. Read only: admins can&apos;t write in a chat, and
        reading here doesn&apos;t mark messages as read. Messages a patient or provider deleted stay visible here, marked
        deleted.
      </p>
      <ChatApp viewer="admin" api="/api/doctor/chats" initial={conversations} initialId={openId} />
    </div>
  );
}
