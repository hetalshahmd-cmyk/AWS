import type { Metadata } from "next";
import { redirect } from "next/navigation";
import ChatApp from "@/components/chat/ChatApp";
import { getCurrentUser } from "@/lib/auth";
import { ChatError } from "@/lib/chat";
import { listPatientConversations, openConversation } from "@/lib/chat-repo";
import { getLang } from "@/lib/lang-server";

export const metadata: Metadata = { title: "Messages — Arizona Women Specialists", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/**
 * The patient's chats with providers. `?provider=<id>` (the Chat button on a
 * profile) opens — or starts — the chat with that provider; `?chat=<id>`
 * reopens one (the link in a "new message" email).
 */
export default async function MessagesPage({ searchParams }: { searchParams: Promise<{ provider?: string; chat?: string }> }) {
  const user = await getCurrentUser().catch(() => null);
  if (!user) redirect("/login?next=%2Fmy-bookings%2Fmessages");
  const { provider, chat } = await searchParams;
  const lang = (await getLang()) === "es" ? "es" : "en";
  let openId: string | null = typeof chat === "string" ? chat : null;
  let problem = "";
  if (typeof provider === "string" && provider) {
    try {
      openId = (await openConversation(user, provider)).id;
    } catch (error) {
      problem = error instanceof ChatError ? error.message : "Could not open that chat.";
    }
  }
  const conversations = await listPatientConversations(user.id);
  if (openId && !conversations.some((item) => item.id === openId)) openId = null;

  return (
    <div>
      <h1 className="font-display text-[clamp(1.8rem,3.5vw,2.4rem)] font-normal text-plum">{lang === "es" ? "Mensajes" : "Messages"}</h1>
      <p className="mb-5 mt-1 text-plum-soft">
        {lang === "es"
          ? "Escriba a su proveedor. Solo usted, su proveedor y nuestra oficina pueden ver estos mensajes."
          : "Message your provider. Only you, your provider and our office can see these messages."}
      </p>
      {problem && <p className="mb-4 rounded-xl bg-wine-soft px-4 py-3 text-[15px] text-wine-deep">{problem}</p>}
      <ChatApp viewer="patient" api="/api/my/chats" initial={conversations} initialId={openId} lang={lang} />
    </div>
  );
}
