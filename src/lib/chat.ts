/**
 * Patient ↔ provider chat: the shapes both sides use and the small rules the
 * browser and the server share (what a message may be, when "online",
 * "typing…", ✓ / ✓✓ apply). The database side is lib/chat-repo.ts.
 */

export type ChatRole = "patient" | "provider";

/** Who is looking: a patient, the provider in the chat, or an admin monitoring. */
export type ChatViewer = ChatRole | "admin";

export type ChatImage = { id: string; contentType: string };

export type ChatMessage = {
  id: string;
  conversationId: string;
  from: ChatRole;
  /** Empty for a deleted message, except for an admin, who sees the original. */
  text: string;
  image: ChatImage | null;
  createdAt: string;
  deletedAt: string | null;
};

export type ChatConversation = {
  id: string;
  providerId: string;
  providerName: string;
  patientName: string;
  /** Staff only. */
  patientEmail?: string;
  createdAt: string;
  lastMessageAt: string | null;
  last: { text: string; from: ChatRole; at: string; image: boolean; deleted: boolean } | null;
  /** Messages the viewer hasn't read (always 0 for an admin). */
  unread: number;
  /** When each side last opened the chat (read everything up to then). */
  readAt: { patient: string | null; provider: string | null };
  /** When each side's app last checked in — "online" and ✓✓ delivered. */
  seenAt: { patient: string | null; provider: string | null };
  typingAt: { patient: string | null; provider: string | null };
};

export const MAX_MESSAGE = 2000;
/** A sender can delete their message for everyone within this time. */
export const DELETE_WINDOW_MS = 60 * 60_000;
export const ONLINE_MS = 45_000;
export const TYPING_MS = 6_000;
/** How often an open chat asks for news. */
export const POLL_MS = 3_000;

export class ChatError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ChatError";
  }
}

/** Trims a message and caps it; control characters (but not new lines) go. */
export function cleanMessageText(value: unknown): string {
  if (typeof value !== "string") return "";
  return value
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, "")
    .replace(/\n{4,}/g, "\n\n\n")
    .trim()
    .slice(0, MAX_MESSAGE);
}

const since = (iso: string | null, now: number) => (iso ? now - new Date(iso).getTime() : Infinity);

export const isOnline = (seenAt: string | null, now = Date.now()) => since(seenAt, now) < ONLINE_MS;
export const isTyping = (typingAt: string | null, now = Date.now()) => since(typingAt, now) < TYPING_MS;

/**
 * WhatsApp-style ticks for a message the viewer sent: ✓ sent, ✓✓ delivered
 * (the other side's app has checked in since), ✓✓ blue once read.
 */
export function tickState(message: Pick<ChatMessage, "from" | "createdAt">, conversation: Pick<ChatConversation, "readAt" | "seenAt">): "sent" | "delivered" | "read" {
  const other: ChatRole = message.from === "patient" ? "provider" : "patient";
  const sent = new Date(message.createdAt).getTime();
  const read = conversation.readAt[other];
  if (read && new Date(read).getTime() >= sent) return "read";
  const seen = conversation.seenAt[other];
  if (seen && new Date(seen).getTime() >= sent) return "delivered";
  return "sent";
}

const TZ = "America/Phoenix";
const dayKey = (date: Date) => date.toLocaleDateString("en-CA", { timeZone: TZ });

/** "Today", "Yesterday", "Monday" (this week) or "Nov 3, 2026" — for date chips. */
export function dayLabel(iso: string, lang = "en", now = new Date()): string {
  const date = new Date(iso);
  const today = dayKey(now);
  const yesterday = dayKey(new Date(now.getTime() - 86_400_000));
  const key = dayKey(date);
  if (key === today) return lang === "es" ? "Hoy" : "Today";
  if (key === yesterday) return lang === "es" ? "Ayer" : "Yesterday";
  if (now.getTime() - date.getTime() < 6 * 86_400_000) {
    return date.toLocaleDateString(lang === "es" ? "es-US" : "en-US", { timeZone: TZ, weekday: "long" });
  }
  return date.toLocaleDateString(lang === "es" ? "es-US" : "en-US", { timeZone: TZ, month: "short", day: "numeric", year: "numeric" });
}

export const sameDay = (a: string, b: string) => dayKey(new Date(a)) === dayKey(new Date(b));

export function clockTime(iso: string, lang = "en"): string {
  return new Date(iso).toLocaleTimeString(lang === "es" ? "es-US" : "en-US", { timeZone: TZ, hour: "numeric", minute: "2-digit" });
}

/** For the chat list: the time today, "Yesterday", or a short date. */
export function listTime(iso: string, lang = "en", now = new Date()): string {
  if (sameDay(iso, now.toISOString())) return clockTime(iso, lang);
  const label = dayLabel(iso, lang, now);
  return label;
}
