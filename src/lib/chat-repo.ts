/**
 * Patient ↔ provider chat in MongoDB.
 *
 *   chat_conversations  one per patient and provider
 *   chat_messages       every message, never removed — a "deleted" message is
 *                       hidden from the patient and provider but kept for the
 *                       practice's record (admins see it, marked deleted)
 *   chat_files          (GridFS) pictures sent in a chat
 *
 * Emails only say "you have a new message" and link to the site: no message
 * text ever goes into an email.
 */
import { GridFSBucket, MongoServerError, ObjectId } from "mongodb";
import { siteUrl } from "./booking-links";
import {
  ChatError,
  cleanMessageText,
  DELETE_WINDOW_MS,
  type ChatConversation,
  type ChatMessage,
  type ChatRole,
  type ChatViewer,
} from "./chat";
import { ensureIndexes, getDb } from "./db";
import { sendMail } from "./mail";
import type { User } from "./models";
import { getAllProviders } from "./providers";
import { listAdmins, loadProviders, looksLikeImage } from "./repo";
import { providerById } from "./scheduling";
import { site } from "./site";

type Sides<T> = { patient: T; provider: T };

type ConversationDoc = {
  _id: ObjectId;
  providerId: string;
  userId: ObjectId;
  patientName: string;
  patientEmail: string;
  createdAt: Date;
  lastMessageAt: Date | null;
  last: { text: string; from: ChatRole; at: Date; image: boolean; deleted: boolean } | null;
  unread: Sides<number>;
  readAt: Sides<Date | null>;
  seenAt: Sides<Date | null>;
  typingAt: Sides<Date | null>;
  notifiedAt: Sides<Date | null>;
};

type MessageDoc = {
  _id: ObjectId;
  conversationId: ObjectId;
  from: ChatRole;
  senderName: string;
  text: string;
  image: { fileId: ObjectId; contentType: string } | null;
  createdAt: Date;
  deletedAt: Date | null;
};

const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_IMAGE = 6 * 1024 * 1024;
/** Emails go out at most this often per chat and side, and not while they're online. */
const NOTIFY_EVERY_MS = 15 * 60_000;
const NOTIFY_IF_AWAY_MS = 2 * 60_000;

async function db() {
  await ensureIndexes();
  const database = await getDb();
  return {
    conversations: database.collection<ConversationDoc>("chat_conversations"),
    messages: database.collection<MessageDoc>("chat_messages"),
    files: new GridFSBucket(database, { bucketName: "chat_files" }),
  };
}

const iso = (date: Date | null | undefined) => (date ? date.toISOString() : null);
const other = (role: ChatRole): ChatRole => (role === "patient" ? "provider" : "patient");
const objectId = (id: string) => (/^[a-f\d]{24}$/i.test(id) ? new ObjectId(id) : null);

/** Shown on the site with a Chat button: shown, chat on, and the provider can sign in to answer. */
export function chatAvailable(providerId: string): boolean {
  const provider = providerById(providerId);
  return Boolean(provider?.active && provider.chatEnabled && provider.hasLogin);
}

function serializeConversation(doc: ConversationDoc, viewer: ChatViewer): ChatConversation {
  const provider = providerById(doc.providerId);
  return {
    id: doc._id.toString(),
    providerId: doc.providerId,
    providerName: provider?.name ?? "Provider",
    patientName: doc.patientName,
    ...(viewer === "patient" ? {} : { patientEmail: doc.patientEmail }),
    createdAt: doc.createdAt.toISOString(),
    lastMessageAt: iso(doc.lastMessageAt),
    last: doc.last
      ? {
          // A deleted last message shows as deleted — the text stays for admins.
          text: doc.last.deleted && viewer !== "admin" ? "" : doc.last.text,
          from: doc.last.from,
          at: doc.last.at.toISOString(),
          image: doc.last.image,
          deleted: doc.last.deleted,
        }
      : null,
    unread: viewer === "admin" ? 0 : (doc.unread?.[viewer] ?? 0),
    readAt: { patient: iso(doc.readAt?.patient), provider: iso(doc.readAt?.provider) },
    seenAt: { patient: iso(doc.seenAt?.patient), provider: iso(doc.seenAt?.provider) },
    typingAt: { patient: iso(doc.typingAt?.patient), provider: iso(doc.typingAt?.provider) },
  };
}

function serializeMessage(doc: MessageDoc, viewer: ChatViewer): ChatMessage {
  const hidden = Boolean(doc.deletedAt) && viewer !== "admin";
  return {
    id: doc._id.toString(),
    conversationId: doc.conversationId.toString(),
    from: doc.from,
    text: hidden ? "" : doc.text,
    image: hidden || !doc.image ? null : { id: doc.image.fileId.toString(), contentType: doc.image.contentType },
    createdAt: doc.createdAt.toISOString(),
    deletedAt: iso(doc.deletedAt),
  };
}

/* ------------------------------------------------------------ opening -- */

/** The patient's chat with a provider, started on first use. */
export async function openConversation(user: User, providerId: string): Promise<ChatConversation> {
  await loadProviders();
  if (!chatAvailable(providerId)) throw new ChatError("This provider isn't taking chat messages right now");
  const { conversations } = await db();
  const userId = new ObjectId(user.id);
  const now = new Date();
  const empty = { patient: null, provider: null };
  try {
    await conversations.updateOne(
      { providerId, userId },
      {
        $setOnInsert: {
          providerId,
          userId,
          createdAt: now,
          lastMessageAt: null,
          last: null,
          unread: { patient: 0, provider: 0 },
          readAt: empty,
          seenAt: empty,
          typingAt: empty,
          notifiedAt: empty,
        },
        // Kept current, so staff see the account's latest name and email.
        $set: { patientName: user.name, patientEmail: user.email },
      },
      { upsert: true },
    );
  } catch (error) {
    // Two first clicks at once: the other request made it.
    if (!(error instanceof MongoServerError && error.code === 11000)) throw error;
  }
  const doc = await conversations.findOne({ providerId, userId });
  if (!doc) throw new ChatError("Could not open the chat");
  return serializeConversation(doc, "patient");
}

/* ------------------------------------------------------------- lists -- */

export async function listPatientConversations(userId: string): Promise<ChatConversation[]> {
  await loadProviders();
  const { conversations } = await db();
  const docs = await conversations.find({ userId: new ObjectId(userId) }).sort({ lastMessageAt: -1, createdAt: -1 }).toArray();
  return docs.map((doc) => serializeConversation(doc, "patient"));
}

/** A provider's chats that have a message; all chats for an admin. */
export async function listStaffConversations(viewer: "provider" | "admin", providerId: string | null): Promise<ChatConversation[]> {
  await loadProviders();
  const { conversations } = await db();
  const filter = viewer === "provider" ? { providerId: providerId ?? "", lastMessageAt: { $ne: null } } : { lastMessageAt: { $ne: null } };
  const docs = await conversations.find(filter).sort({ lastMessageAt: -1 }).limit(500).toArray();
  return docs.map((doc) => serializeConversation(doc, viewer));
}

/* ------------------------------------------------------------- access -- */

export type ChatAccess = { viewer: ChatViewer; userId?: string; providerId?: string | null };

/** The chat, if this viewer may see it; otherwise null (reads as "not found"). */
async function findFor(id: string, access: ChatAccess): Promise<ConversationDoc | null> {
  const _id = objectId(id);
  if (!_id) return null;
  const { conversations } = await db();
  const doc = await conversations.findOne({ _id });
  if (!doc) return null;
  if (access.viewer === "patient" && doc.userId.toString() !== access.userId) return null;
  if (access.viewer === "provider" && doc.providerId !== access.providerId) return null;
  return doc;
}

/**
 * The chat and its messages — all of them, or only what is new or deleted
 * since `after` (the `now` of the previous call). Opening it as the patient or
 * the provider counts as that side being online.
 */
export async function readConversation(id: string, access: ChatAccess, after: string | null) {
  await loadProviders();
  const doc = await findFor(id, access);
  if (!doc) return null;
  const { conversations, messages } = await db();
  const now = new Date();
  if (access.viewer !== "admin") {
    await conversations.updateOne({ _id: doc._id }, { $set: { [`seenAt.${access.viewer}`]: now } });
    doc.seenAt = { ...doc.seenAt, [access.viewer]: now };
  }
  const since = after && !Number.isNaN(Date.parse(after)) ? new Date(after) : null;
  const filter = since
    ? { conversationId: doc._id, $or: [{ createdAt: { $gt: since } }, { deletedAt: { $gt: since } }] }
    : { conversationId: doc._id };
  // The newest 300 on first open, oldest first.
  const docs = since
    ? await messages.find(filter).sort({ createdAt: 1 }).limit(300).toArray()
    : (await messages.find(filter).sort({ createdAt: -1 }).limit(300).toArray()).reverse();
  return {
    conversation: serializeConversation(doc, access.viewer),
    messages: docs.map((message) => serializeMessage(message, access.viewer)),
    // A little overlap, so a message saved during this read isn't missed next time.
    now: new Date(now.getTime() - 2000).toISOString(),
  };
}

/* ----------------------------------------------------------- writing -- */

async function storeImage(file: File, conversationId: ObjectId): Promise<{ fileId: ObjectId; contentType: string }> {
  if (!IMAGE_TYPES.has(file.type)) throw new ChatError("Send a JPEG, PNG or WebP picture");
  if (file.size > MAX_IMAGE) throw new ChatError("That picture is too large (6 MB max)");
  const data = Buffer.from(await file.arrayBuffer());
  if (!looksLikeImage(data)) throw new ChatError("That file isn't a picture");
  const { files } = await db();
  const fileId = new ObjectId();
  await new Promise<void>((resolve, reject) => {
    const upload = files.openUploadStreamWithId(fileId, "chat-image", {
      metadata: { contentType: file.type, conversationId },
    });
    upload.once("finish", () => resolve());
    upload.once("error", reject);
    upload.end(data);
  });
  return { fileId, contentType: file.type };
}

export async function sendMessage(
  id: string,
  access: ChatAccess & { viewer: ChatRole; name: string },
  input: { text: unknown; image: File | null },
): Promise<ChatMessage | null> {
  const doc = await findFor(id, access);
  if (!doc) return null;
  const text = cleanMessageText(input.text);
  if (!text && !input.image) throw new ChatError("Type a message or add a picture");
  if (access.viewer === "patient" && !chatAvailable(doc.providerId)) {
    throw new ChatError("This provider isn't taking chat messages right now");
  }
  const { conversations, messages } = await db();
  const image = input.image ? await storeImage(input.image, doc._id) : null;
  const now = new Date();
  const message: MessageDoc = {
    _id: new ObjectId(),
    conversationId: doc._id,
    from: access.viewer,
    senderName: access.name,
    text,
    image,
    createdAt: now,
    deletedAt: null,
  };
  await messages.insertOne(message);
  const to = other(access.viewer);
  await conversations.updateOne(
    { _id: doc._id },
    {
      $set: {
        lastMessageAt: now,
        last: { text: text.slice(0, 200), from: access.viewer, at: now, image: Boolean(image), deleted: false },
        // Sending means you've read everything before it.
        [`readAt.${access.viewer}`]: now,
        [`seenAt.${access.viewer}`]: now,
        [`unread.${access.viewer}`]: 0,
        [`typingAt.${access.viewer}`]: null,
      },
      $inc: { [`unread.${to}`]: 1 },
    },
  );
  void notify(doc, to, now).catch((error) => console.error("chat notification failed", error));
  return serializeMessage(message, access.viewer);
}

/** The viewer has seen everything so far: ✓✓ turns blue on the other side. */
export async function markRead(id: string, access: ChatAccess & { viewer: ChatRole }): Promise<boolean> {
  const doc = await findFor(id, access);
  if (!doc) return false;
  const { conversations } = await db();
  const now = new Date();
  await conversations.updateOne(
    { _id: doc._id },
    { $set: { [`readAt.${access.viewer}`]: now, [`seenAt.${access.viewer}`]: now, [`unread.${access.viewer}`]: 0 } },
  );
  return true;
}

export async function setTyping(id: string, access: ChatAccess & { viewer: ChatRole }): Promise<boolean> {
  const doc = await findFor(id, access);
  if (!doc) return false;
  const { conversations } = await db();
  const now = new Date();
  await conversations.updateOne({ _id: doc._id }, { $set: { [`typingAt.${access.viewer}`]: now, [`seenAt.${access.viewer}`]: now } });
  return true;
}

/**
 * "Delete for everyone": only your own message, within an hour. The patient
 * and provider then see "This message was deleted"; the text stays in the
 * database for the practice's record and admins still see it.
 */
export async function deleteMessage(id: string, messageId: string, access: ChatAccess & { viewer: ChatRole }): Promise<ChatMessage | null> {
  const doc = await findFor(id, access);
  const _id = objectId(messageId);
  if (!doc || !_id) return null;
  const { conversations, messages } = await db();
  const message = await messages.findOne({ _id, conversationId: doc._id });
  if (!message) return null;
  if (message.from !== access.viewer) throw new ChatError("You can only delete your own messages");
  if (Date.now() - message.createdAt.getTime() > DELETE_WINDOW_MS) throw new ChatError("Messages can only be deleted within an hour of sending");
  const now = new Date();
  const updated = await messages.findOneAndUpdate({ _id, deletedAt: null }, { $set: { deletedAt: now } }, { returnDocument: "after" });
  if (doc.last && doc.last.at.getTime() === message.createdAt.getTime()) {
    await conversations.updateOne({ _id: doc._id }, { $set: { "last.deleted": true } });
  }
  return serializeMessage(updated ?? { ...message, deletedAt: now }, access.viewer);
}

/* ------------------------------------------------------------ pictures -- */

/** A picture from a chat, if this viewer may see that chat. */
export async function readChatImage(fileId: string, access: ChatAccess): Promise<{ data: Buffer; contentType: string } | null> {
  const _id = objectId(fileId);
  if (!_id) return null;
  const { files, messages } = await db();
  const [file] = await files.find({ _id }).limit(1).toArray();
  if (!file) return null;
  const message = await messages.findOne({ "image.fileId": _id });
  // A deleted message's picture is for admins only, like its text.
  if (!message || (message.deletedAt && access.viewer !== "admin")) return null;
  if (!(await findFor(message.conversationId.toString(), access))) return null;
  const chunks: Buffer[] = [];
  await new Promise<void>((resolve, reject) => {
    files
      .openDownloadStream(_id)
      .on("data", (chunk: Buffer) => chunks.push(chunk))
      .on("end", () => resolve())
      .on("error", reject);
  });
  return { data: Buffer.concat(chunks), contentType: message.image?.contentType ?? "image/jpeg" };
}

/* ------------------------------------------------------------ emails -- */

/**
 * "You have a new message" — never the message itself. Not while the other
 * side is online, and at most every 15 minutes per chat.
 */
async function notify(doc: ConversationDoc, to: ChatRole, now: Date): Promise<void> {
  const seen = doc.seenAt?.[to];
  const notified = doc.notifiedAt?.[to];
  if (seen && now.getTime() - seen.getTime() < NOTIFY_IF_AWAY_MS) return;
  if (notified && now.getTime() - notified.getTime() < NOTIFY_EVERY_MS) return;
  const { conversations } = await db();
  const claimed = await conversations.updateOne(
    { _id: doc._id, [`notifiedAt.${to}`]: notified ?? null },
    { $set: { [`notifiedAt.${to}`]: now } },
  );
  if (!claimed.modifiedCount) return;

  const providerName = getAllProviders().find((provider) => provider.id === doc.providerId)?.name ?? "your provider";
  let recipients: string[];
  let subject: string;
  let lines: string[];
  let link: string;
  if (to === "patient") {
    recipients = [doc.patientEmail];
    subject = `New message from ${providerName}`;
    link = siteUrl(`/my-bookings/messages?chat=${doc._id.toString()}`);
    lines = [`${providerName} sent you a message.`, "Sign in to read it and reply:"];
  } else {
    recipients = (await listAdmins()).filter((admin) => admin.role === "provider" && admin.providerId === doc.providerId).map((admin) => admin.email);
    subject = "New message from a patient";
    link = siteUrl(`/admin/doctor/messages?chat=${doc._id.toString()}`);
    lines = ["A patient sent you a message on the website.", "Sign in to read it and reply:"];
  }
  const text = [...lines, link, "", `${site.name} · ${site.phone}`].join("\n");
  const html = `<p>${lines.map((line) => line.replace(/&/g, "&amp;").replace(/</g, "&lt;")).join("<br>")}</p><p><a href="${link}">${link}</a></p><p style="color:#5e5357;font-size:13px">${site.name} &middot; ${site.phone}</p>`;
  for (const email of recipients) await sendMail({ to: email, subject, text, html });
}

