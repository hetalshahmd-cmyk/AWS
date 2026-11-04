import type { Metadata } from "next";
import { redirect } from "next/navigation";
import ChatApp from "@/components/chat/ChatApp";
import { getCurrentAdmin } from "@/lib/auth";
import { listStaffConversations } from "@/lib/chat-repo";

export const metadata: Metadata = { title: "Messages — Provider" };
export const dynamic = "force-dynamic";

/** A provider's chats with their patients. */
export default async function DoctorMessagesPage({ searchParams }: { searchParams: Promise<{ chat?: string }> }) {
  const staff = await getCurrentAdmin().catch(() => null);
  if (!staff || staff.role !== "provider" || !staff.providerId) redirect("/login");
  const { chat } = await searchParams;
  const conversations = await listStaffConversations("provider", staff.providerId);
  const openId = typeof chat === "string" && conversations.some((item) => item.id === chat) ? chat : null;

  return (
    <div>
      <h1 className="font-display text-[1.9rem] font-semibold">Messages</h1>
      <p className="mb-5 mt-1 max-w-[75ch] text-plum-soft">
        Chats from your patients. The office can read every chat. Patients are told chat is answered during office hours
        and to call 911 in an emergency.
      </p>
      <ChatApp viewer="provider" api="/api/doctor/chats" initial={conversations} initialId={openId} />
    </div>
  );
}
