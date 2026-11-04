"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ProviderAvatar from "@/components/site/ProviderAvatar";
import {
  clockTime,
  dayLabel,
  DELETE_WINDOW_MS,
  isOnline,
  isTyping,
  listTime,
  MAX_MESSAGE,
  POLL_MS,
  sameDay,
  tickState,
  type ChatConversation,
  type ChatMessage,
  type ChatRole,
  type ChatViewer,
} from "@/lib/chat";
import { getAllProviders } from "@/lib/providers";

/* ------------------------------------------------------------- words -- */

const WORDS = {
  en: {
    chats: "Chats",
    search: "Search chats",
    noChats: "No chats yet.",
    startHint: "Open a provider's profile and press Chat to start.",
    seeProviders: "See our providers",
    pick: "Pick a chat to read it.",
    typing: "typing…",
    online: "online",
    lastSeen: (when: string) => `last seen ${when}`,
    message: "Message",
    send: "Send",
    attach: "Add a picture",
    caption: "Add a caption (optional)",
    removePicture: "Remove picture",
    deleted: "This message was deleted",
    youDeleted: "You deleted this message",
    deleteForAll: "Delete for everyone",
    deleteConfirm: "Delete this message for everyone?",
    sending: "Sending…",
    failed: "Not sent — tap to try again",
    newMessages: (n: number) => `${n} new message${n === 1 ? "" : "s"}`,
    back: "Back to chats",
    photo: "Photo",
    you: "You",
    download: "Download",
    close: "Close",
    emergency:
      "For emergencies call 911. Chat isn't watched around the clock — messages are answered during office hours, Monday–Friday 8 am–5 pm.",
    readOnly: "Monitoring — read only. Admins can see every chat but can't write in them.",
    tooLong: `Messages can be up to ${MAX_MESSAGE} characters.`,
    serverDown: "Could not reach the server.",
    deletedTag: (who: string, when: string) => `Deleted by ${who} · ${when}`,
  },
  es: {
    chats: "Chats",
    search: "Buscar chats",
    noChats: "Todavía no hay chats.",
    startHint: "Abra el perfil de un proveedor y toque Chat para empezar.",
    seeProviders: "Ver nuestros proveedores",
    pick: "Elija un chat para leerlo.",
    typing: "escribiendo…",
    online: "en línea",
    lastSeen: (when: string) => `últ. vez ${when}`,
    message: "Mensaje",
    send: "Enviar",
    attach: "Agregar una foto",
    caption: "Agregar un texto (opcional)",
    removePicture: "Quitar foto",
    deleted: "Se eliminó este mensaje",
    youDeleted: "Usted eliminó este mensaje",
    deleteForAll: "Eliminar para todos",
    deleteConfirm: "¿Eliminar este mensaje para todos?",
    sending: "Enviando…",
    failed: "No se envió — toque para reintentar",
    newMessages: (n: number) => `${n} mensaje${n === 1 ? "" : "s"} nuevo${n === 1 ? "" : "s"}`,
    back: "Volver a los chats",
    photo: "Foto",
    you: "Usted",
    download: "Descargar",
    close: "Cerrar",
    emergency:
      "En una emergencia llame al 911. El chat no se revisa a toda hora: respondemos en horario de oficina, lunes a viernes de 8 am a 5 pm.",
    readOnly: "Supervisión — solo lectura.",
    tooLong: `Los mensajes pueden tener hasta ${MAX_MESSAGE} caracteres.`,
    serverDown: "No se pudo conectar con el servidor.",
    deletedTag: (who: string, when: string) => `Eliminado por ${who} · ${when}`,
  },
};

type Words = (typeof WORDS)["en"];

/* ------------------------------------------------------------ helpers -- */

/** A message being sent from this screen, before the server has it. */
type Pending = { tempId: string; text: string; file: File | null; preview: string | null; status: "sending" | "failed"; createdAt: string };

type Thread = { messages: ChatMessage[]; after: string | null; loaded: boolean };

/** Phone photos are big: send at most 1600px, as JPEG, like the check-in form. */
async function shrink(file: File): Promise<File> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && file.size < 1.5 * 1024 * 1024 && file.type !== "image/heic") return file;
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
    return blob ? new File([blob], "photo.jpg", { type: "image/jpeg" }) : file;
  } catch {
    return file;
  }
}

function initialsOf(name: string): string {
  return (
    name
      .replace(/^dr\.?\s+/i, "")
      .split(/[\s,]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "?"
  );
}

const COLORS = ["#00a884", "#7c2c3e", "#4e7b73", "#8a6a9e", "#b0607a", "#2b6cb0"];
const colorFor = (text: string) => COLORS[[...text].reduce((sum, char) => sum + char.charCodeAt(0), 0) % COLORS.length];

function Avatar({ conversation, viewer, size = 44 }: { conversation: ChatConversation; viewer: ChatViewer; size?: number }) {
  const provider = viewer === "patient" ? getAllProviders().find((item) => item.id === conversation.providerId) : null;
  if (provider) {
    // The site's avatar, scaled to the chat's size (it has a ring and shadow).
    return (
      <span className="grid shrink-0 place-items-center overflow-hidden rounded-full" style={{ width: size, height: size }}>
        <span style={{ transform: `scale(${size / 56})` }} className="block shrink-0">
          <ProviderAvatar provider={provider} size="sm" />
        </span>
      </span>
    );
  }
  const name = conversation.patientName;
  return (
    <span
      aria-hidden="true"
      className="grid shrink-0 place-items-center rounded-full font-semibold text-white"
      style={{ width: size, height: size, background: colorFor(name), fontSize: size * 0.36 }}
    >
      {initialsOf(name)}
    </span>
  );
}

function Ticks({ state }: { state: "sent" | "delivered" | "read" }) {
  const color = state === "read" ? "#53bdeb" : "#667781";
  const label = state === "read" ? "Read" : state === "delivered" ? "Delivered" : "Sent";
  return (
    <svg viewBox="0 0 18 12" width="17" height="11" role="img" aria-label={label} className="inline-block shrink-0">
      <path d="M1 6.5l3.2 3.2L11 2.5" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      {state !== "sent" && <path d="M6.5 9.4l.3.3L13.6 2.5" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />}
    </svg>
  );
}

/* --------------------------------------------------------------- app -- */

export default function ChatApp({
  viewer,
  api,
  initial,
  initialId,
  lang = "en",
}: {
  viewer: ChatViewer;
  /** "/api/my/chats" for patients, "/api/doctor/chats" for staff. */
  api: string;
  initial: ChatConversation[];
  initialId: string | null;
  lang?: "en" | "es";
}) {
  const w: Words = WORDS[lang] ?? WORDS.en;
  const me: ChatRole | null = viewer === "admin" ? null : viewer;
  const [conversations, setConversations] = useState(initial);
  const [selectedId, setSelectedId] = useState<string | null>(initialId);
  const [threads, setThreads] = useState<Record<string, Thread>>({});
  const [pending, setPending] = useState<Record<string, Pending[]>>({});
  const [draft, setDraft] = useState("");
  const [attachment, setAttachment] = useState<{ file: File; url: string } | null>(null);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [unseenBelow, setUnseenBelow] = useState(0);
  const scroller = useRef<HTMLDivElement>(null);
  const atBottom = useRef(true);
  const lastTyping = useRef(0);
  const fileInput = useRef<HTMLInputElement>(null);
  const textArea = useRef<HTMLTextAreaElement>(null);

  const selected = conversations.find((item) => item.id === selectedId) ?? null;
  const thread = selectedId ? threads[selectedId] : undefined;
  const fileUrl = (id: string, download = false) =>
    `/api/chat-files/${id}?as=${viewer === "patient" ? "patient" : "staff"}${download ? "&download=1" : ""}`;
  const nameOf = (conversation: ChatConversation) => (viewer === "patient" ? conversation.providerName : conversation.patientName);

  /* ---------------------------------------------------------- loading -- */

  const upsertConversation = useCallback((conversation: ChatConversation) => {
    setConversations((list) => {
      const rest = list.filter((item) => item.id !== conversation.id);
      return [conversation, ...rest].sort((a, b) => (b.lastMessageAt ?? b.createdAt).localeCompare(a.lastMessageAt ?? a.createdAt));
    });
  }, []);

  const loadThread = useCallback(
    async (id: string) => {
      const current = threads[id];
      const after = current?.loaded ? current.after : null;
      try {
        const response = await fetch(`${api}/${id}${after ? `?after=${encodeURIComponent(after)}` : ""}`, { cache: "no-store" });
        if (!response.ok) return;
        const data = (await response.json()) as { conversation: ChatConversation; messages: ChatMessage[]; now: string };
        setThreads((all) => {
          const before = all[id]?.loaded ? all[id].messages : [];
          const byId = new Map(before.map((message) => [message.id, message]));
          let added = 0;
          for (const message of data.messages) {
            if (!byId.has(message.id)) added += 1;
            byId.set(message.id, message);
          }
          if (added && !atBottom.current && before.length) setUnseenBelow((count) => count + added);
          const messages = [...byId.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
          return { ...all, [id]: { messages, after: data.now, loaded: true } };
        });
        upsertConversation(data.conversation);
      } catch {
        /* the next poll tries again */
      }
    },
    [api, threads, upsertConversation],
  );

  const loadList = useCallback(async () => {
    try {
      const response = await fetch(api, { cache: "no-store" });
      if (!response.ok) return;
      const data = (await response.json()) as { conversations: ChatConversation[] };
      setConversations((list) => {
        // Keep a just-opened chat that has no messages yet.
        const extra = list.filter((item) => !data.conversations.some((fresh) => fresh.id === item.id) && item.id === selectedId);
        return [...data.conversations, ...extra];
      });
    } catch {
      /* try again later */
    }
  }, [api, selectedId]);

  // The open chat: right away, then every few seconds while the page is visible.
  useEffect(() => {
    if (!selectedId) return;
    void loadThread(selectedId);
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void loadThread(selectedId);
    }, POLL_MS);
    return () => window.clearInterval(timer);
    // loadThread changes with every message; the interval only needs the chat id.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  // The chat list (new chats, unread counts) a little less often.
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void loadList();
    }, POLL_MS * 4);
    return () => window.clearInterval(timer);
  }, [loadList]);

  // "online" and "typing…" wear off without a new message.
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 2000);
    return () => window.clearInterval(timer);
  }, []);

  // The address bar follows the open chat, so a reload or a shared link reopens it.
  useEffect(() => {
    const url = new URL(window.location.href);
    if (selectedId) url.searchParams.set("chat", selectedId);
    else url.searchParams.delete("chat");
    url.searchParams.delete("provider");
    window.history.replaceState(null, "", url.toString());
  }, [selectedId]);

  /* ------------------------------------------------------------- read -- */

  const unreadFromOther = useMemo(() => {
    if (!me || !selected || !thread?.loaded) return false;
    const readAt = selected.readAt[me];
    return thread.messages.some((message) => message.from !== me && (!readAt || message.createdAt > readAt));
  }, [me, selected, thread]);

  useEffect(() => {
    if (!unreadFromOther || !selectedId || document.visibilityState !== "visible") return;
    void fetch(`${api}/${selectedId}/read`, { method: "POST" }).then(() => {
      setConversations((list) =>
        list.map((item) =>
          item.id === selectedId && me ? { ...item, unread: 0, readAt: { ...item.readAt, [me]: new Date().toISOString() } } : item,
        ),
      );
    });
  }, [unreadFromOther, selectedId, api, me]);

  /* ----------------------------------------------------------- scroll -- */

  const scrollToBottom = (smooth = false) => {
    const box = scroller.current;
    if (!box) return;
    box.scrollTo({ top: box.scrollHeight, behavior: smooth ? "smooth" : "auto" });
    setUnseenBelow(0);
  };

  const messageCount = (thread?.messages.length ?? 0) + (selectedId ? (pending[selectedId]?.length ?? 0) : 0);
  useEffect(() => {
    if (atBottom.current) scrollToBottom();
  }, [messageCount, selectedId]);

  /* ------------------------------------------------------------- send -- */

  function pickFile(file: File | null) {
    if (attachment) URL.revokeObjectURL(attachment.url);
    setAttachment(file ? { file, url: URL.createObjectURL(file) } : null);
    textArea.current?.focus();
  }

  async function deliver(conversationId: string, item: Pending) {
    const body = new FormData();
    body.set("text", item.text);
    if (item.file) body.set("image", await shrink(item.file));
    setPending((all) => ({
      ...all,
      [conversationId]: (all[conversationId] ?? []).map((entry) => (entry.tempId === item.tempId ? { ...entry, status: "sending" } : entry)),
    }));
    try {
      const response = await fetch(`${api}/${conversationId}/messages`, { method: "POST", body });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? w.serverDown);
      const message = data.message as ChatMessage;
      setThreads((all) => {
        const current = all[conversationId] ?? { messages: [], after: null, loaded: false };
        const messages = current.messages.some((entry) => entry.id === message.id) ? current.messages : [...current.messages, message];
        return { ...all, [conversationId]: { ...current, messages } };
      });
      setPending((all) => ({ ...all, [conversationId]: (all[conversationId] ?? []).filter((entry) => entry.tempId !== item.tempId) }));
      if (item.preview) URL.revokeObjectURL(item.preview);
      setConversations((list) =>
        list
          .map((entry) =>
            entry.id === conversationId
              ? { ...entry, lastMessageAt: message.createdAt, last: { text: message.text, from: message.from, at: message.createdAt, image: Boolean(message.image), deleted: false } }
              : entry,
          )
          .sort((a, b) => (b.lastMessageAt ?? b.createdAt).localeCompare(a.lastMessageAt ?? a.createdAt)),
      );
      setError("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : w.serverDown);
      setPending((all) => ({
        ...all,
        [conversationId]: (all[conversationId] ?? []).map((entry) => (entry.tempId === item.tempId ? { ...entry, status: "failed" } : entry)),
      }));
    }
  }

  function send(event?: React.FormEvent) {
    event?.preventDefault();
    if (!selectedId || !me) return;
    const text = draft.trim();
    if (!text && !attachment) return;
    if (text.length > MAX_MESSAGE) {
      setError(w.tooLong);
      return;
    }
    const item: Pending = {
      tempId: `tmp-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      text,
      file: attachment?.file ?? null,
      preview: attachment?.url ?? null,
      status: "sending",
      createdAt: new Date().toISOString(),
    };
    setPending((all) => ({ ...all, [selectedId]: [...(all[selectedId] ?? []), item] }));
    setDraft("");
    setAttachment(null);
    atBottom.current = true;
    void deliver(selectedId, item);
  }

  function onDraft(value: string) {
    setDraft(value);
    if (!selectedId || !me || !value.trim()) return;
    if (Date.now() - lastTyping.current > 3000) {
      lastTyping.current = Date.now();
      void fetch(`${api}/${selectedId}/typing`, { method: "POST" }).catch(() => undefined);
    }
  }

  async function remove(message: ChatMessage) {
    if (!selectedId || !window.confirm(w.deleteConfirm)) return;
    const response = await fetch(`${api}/${selectedId}/messages/${message.id}`, { method: "DELETE" });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(data.error ?? w.serverDown);
      return;
    }
    setThreads((all) => {
      const current = all[selectedId];
      if (!current) return all;
      return { ...all, [selectedId]: { ...current, messages: current.messages.map((entry) => (entry.id === message.id ? data.message : entry)) } };
    });
  }

  /* -------------------------------------------------------------- view -- */

  const shown = conversations.filter((item) => {
    const term = search.trim().toLowerCase();
    if (!term) return true;
    return `${item.providerName} ${item.patientName} ${item.patientEmail ?? ""}`.toLowerCase().includes(term);
  });

  const otherRole: ChatRole | null = me ? (me === "patient" ? "provider" : "patient") : null;
  const status = (() => {
    if (!selected) return "";
    if (viewer === "admin") return `${selected.patientName} ↔ ${selected.providerName}`;
    const side = otherRole as ChatRole;
    if (isTyping(selected.typingAt[side], now)) return w.typing;
    if (isOnline(selected.seenAt[side], now)) return w.online;
    const seen = selected.seenAt[side];
    return seen ? w.lastSeen(`${dayLabel(seen, lang, new Date(now)).toLowerCase()} ${clockTime(seen, lang)}`) : "";
  })();

  return (
    <div className="flex h-[min(80vh,780px)] min-h-[520px] overflow-hidden rounded-2xl border border-[#d1d7db] bg-white shadow-[0_6px_24px_-12px_rgba(11,20,26,.35)]">
      {/* ------------------------------------------------------ chat list -- */}
      <aside
        className={`${selected ? "hidden md:flex" : "flex"} w-full flex-col border-r border-[#d1d7db] md:w-[340px] md:shrink-0`}
        aria-label={w.chats}
      >
        <div className="bg-[#f0f2f5] px-4 py-3">
          <h2 className="text-[17px] font-semibold text-[#111b21]">{w.chats}</h2>
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={w.search}
            aria-label={w.search}
            className="mt-2 w-full rounded-lg bg-white px-3 py-2 text-[14px] text-[#111b21] outline-none placeholder:text-[#667781] focus-visible:ring-2 focus-visible:ring-[#00a884]"
          />
        </div>
        <ul className="min-h-0 flex-1 overflow-y-auto">
          {shown.length === 0 && (
            <li className="px-5 py-8 text-center text-[14px] text-[#667781]">
              <p>{w.noChats}</p>
              {viewer === "patient" && (
                <>
                  <p className="mt-1">{w.startHint}</p>
                  <Link href="/about#providers" className="mt-3 inline-block font-semibold text-[#008069] underline">
                    {w.seeProviders}
                  </Link>
                </>
              )}
            </li>
          )}
          {shown.map((conversation) => {
            const active = conversation.id === selectedId;
            const last = conversation.last;
            const mine = me && last?.from === me;
            return (
              <li key={conversation.id}>
                <button
                  type="button"
                  onClick={() => {
                    atBottom.current = true;
                    setSelectedId(conversation.id);
                    setError("");
                  }}
                  aria-current={active ? "true" : undefined}
                  className={`flex w-full items-center gap-3 px-3 py-2.5 text-left transition hover:bg-[#f5f6f6] focus-visible:bg-[#f0f2f5] focus-visible:outline-none ${active ? "bg-[#f0f2f5]" : ""}`}
                >
                  <Avatar conversation={conversation} viewer={viewer} />
                  <span className="min-w-0 flex-1 border-b border-[#e9edef] pb-2.5">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-[16px] text-[#111b21]">
                        {viewer === "admin" ? `${conversation.patientName} → ${conversation.providerName}` : nameOf(conversation)}
                      </span>
                      {last && (
                        <span className={`shrink-0 text-[12px] ${conversation.unread ? "font-semibold text-[#00a884]" : "text-[#667781]"}`}>
                          {listTime(last.at, lang, new Date(now))}
                        </span>
                      )}
                    </span>
                    <span className="mt-0.5 flex items-center gap-1.5">
                      {mine && last && !last.deleted && <Ticks state={tickState({ from: last.from, createdAt: last.at }, conversation)} />}
                      <span className="min-w-0 flex-1 truncate text-[14px] text-[#667781]">
                        {!last
                          ? ""
                          : last.deleted
                            ? viewer === "admin"
                              ? `🚫 ${last.text}`
                              : `🚫 ${w.deleted}`
                            : last.image && !last.text
                              ? `📷 ${w.photo}`
                              : `${last.image ? "📷 " : ""}${last.text}`}
                      </span>
                      {conversation.unread > 0 && (
                        <span className="grid h-5 min-w-5 shrink-0 place-items-center rounded-full bg-[#25d366] px-1.5 text-[12px] font-semibold text-white">
                          {conversation.unread}
                        </span>
                      )}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </aside>

      {/* ----------------------------------------------------------- chat -- */}
      <section className={`${selected ? "flex" : "hidden md:flex"} min-w-0 flex-1 flex-col`} aria-label={selected ? nameOf(selected) : w.chats}>
        {!selected ? (
          <div className="grid flex-1 place-items-center bg-[#f0f2f5] p-8 text-center text-[15px] text-[#667781]">{w.pick}</div>
        ) : (
          <>
            <header className="flex items-center gap-3 bg-[#f0f2f5] px-3 py-2.5">
              <button
                type="button"
                onClick={() => setSelectedId(null)}
                aria-label={w.back}
                className="grid h-9 w-9 place-items-center rounded-full text-[#54656f] hover:bg-black/5 md:hidden"
              >
                <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M19 12H5M11 6l-6 6 6 6" />
                </svg>
              </button>
              <Avatar conversation={selected} viewer={viewer} size={40} />
              <div className="min-w-0">
                <p className="truncate text-[16px] font-medium text-[#111b21]">
                  {viewer === "admin" ? `${selected.patientName} → ${selected.providerName}` : nameOf(selected)}
                </p>
                <p className={`truncate text-[13px] ${status === w.typing ? "text-[#00a884]" : "text-[#667781]"}`} aria-live="polite">
                  {viewer === "admin" ? selected.patientEmail : status}
                </p>
              </div>
            </header>

            {viewer === "patient" && (
              <p className="bg-[#fff5c4] px-4 py-2 text-[13px] leading-snug text-[#54656f]">{w.emergency}</p>
            )}
            {viewer === "admin" && <p className="bg-[#e7f3ff] px-4 py-2 text-[13px] text-[#1f4f7a]">{w.readOnly}</p>}

            <div
              ref={scroller}
              onScroll={(event) => {
                const box = event.currentTarget;
                atBottom.current = box.scrollHeight - box.scrollTop - box.clientHeight < 80;
                if (atBottom.current) setUnseenBelow(0);
              }}
              className="relative min-h-0 flex-1 overflow-y-auto bg-[#efeae2] px-[4%] py-3"
              style={{ backgroundImage: "radial-gradient(rgba(0,0,0,.035) 1px, transparent 1px)", backgroundSize: "18px 18px" }}
            >
              {thread?.messages.map((message, index) => {
                const previous = thread.messages[index - 1];
                const mine = me ? message.from === me : message.from === "provider";
                const newDay = !previous || !sameDay(previous.createdAt, message.createdAt);
                const deleted = Boolean(message.deletedAt);
                const canDelete = me && message.from === me && !deleted && now - new Date(message.createdAt).getTime() < DELETE_WINDOW_MS;
                return (
                  <div key={message.id}>
                    {newDay && (
                      <p className="my-3 text-center">
                        <span className="rounded-lg bg-white/90 px-3 py-1 text-[12.5px] text-[#54656f] shadow-sm">{dayLabel(message.createdAt, lang, new Date(now))}</span>
                      </p>
                    )}
                    <div className={`group mb-1 flex ${mine ? "justify-end" : "justify-start"}`}>
                      <div
                        className={`relative max-w-[min(78%,520px)] rounded-lg px-2 pb-1.5 pt-1.5 text-[14.5px] leading-snug text-[#111b21] shadow-[0_1px_.5px_rgba(11,20,26,.13)] ${
                          mine ? "rounded-tr-none bg-[#d9fdd3]" : "rounded-tl-none bg-white"
                        }`}
                      >
                        {viewer === "admin" && (
                          <p className={`px-1 text-[12.5px] font-semibold ${message.from === "provider" ? "text-[#7c2c3e]" : "text-[#00a884]"}`}>
                            {message.from === "provider" ? selected.providerName : selected.patientName}
                          </p>
                        )}
                        {deleted && viewer !== "admin" ? (
                          <p className="px-1 italic text-[#667781]">🚫 {message.from === me ? w.youDeleted : w.deleted}</p>
                        ) : (
                          <>
                            {message.image && (
                              <button type="button" onClick={() => setLightbox(fileUrl(message.image!.id))} className="block overflow-hidden rounded-md">
                                {/* eslint-disable-next-line @next/next/no-img-element -- private chat picture, not cached */}
                                <img
                                  src={fileUrl(message.image.id)}
                                  alt={w.photo}
                                  onLoad={() => {
                                    if (atBottom.current) scrollToBottom();
                                  }}
                                  className="max-h-72 w-full max-w-[320px] object-cover"
                                />
                              </button>
                            )}
                            {message.text && <p className="whitespace-pre-wrap break-words px-1 pt-0.5">{message.text}</p>}
                            {deleted && viewer === "admin" && message.deletedAt && (
                              <p className="mt-1 px-1 text-[12px] font-medium text-[#b42318]">
                                🚫 {w.deletedTag(message.from === "provider" ? selected.providerName : selected.patientName, `${dayLabel(message.deletedAt, lang)} ${clockTime(message.deletedAt, lang)}`)}
                              </p>
                            )}
                          </>
                        )}
                        <p className="mt-0.5 flex items-center justify-end gap-1 px-1 text-[11px] text-[#667781]">
                          {clockTime(message.createdAt, lang)}
                          {mine && me && !deleted && <Ticks state={tickState(message, selected)} />}
                        </p>
                        {canDelete && (
                          <button
                            type="button"
                            onClick={() => void remove(message)}
                            className="absolute -left-8 top-1 hidden h-7 w-7 place-items-center rounded-full bg-white/90 text-[#54656f] shadow group-hover:grid group-focus-within:grid focus-visible:grid"
                            aria-label={w.deleteForAll}
                            title={w.deleteForAll}
                          >
                            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}

              {(pending[selected.id] ?? []).map((item) => (
                <div key={item.tempId} className="mb-1 flex justify-end">
                  <div className="max-w-[min(78%,520px)] rounded-lg rounded-tr-none bg-[#d9fdd3] px-2 pb-1.5 pt-1.5 text-[14.5px] text-[#111b21] opacity-80 shadow-[0_1px_.5px_rgba(11,20,26,.13)]">
                    {item.preview && (
                      // eslint-disable-next-line @next/next/no-img-element -- local preview while sending
                      <img src={item.preview} alt={w.photo} className="max-h-72 w-full max-w-[320px] rounded-md object-cover" />
                    )}
                    {item.text && <p className="whitespace-pre-wrap break-words px-1 pt-0.5">{item.text}</p>}
                    {item.status === "failed" ? (
                      <button type="button" onClick={() => void deliver(selected.id, item)} className="mt-0.5 block w-full px-1 text-right text-[11.5px] font-semibold text-[#b42318]">
                        ⚠ {w.failed}
                      </button>
                    ) : (
                      <p className="mt-0.5 px-1 text-right text-[11px] text-[#667781]">🕓 {w.sending}</p>
                    )}
                  </div>
                </div>
              ))}

              {unseenBelow > 0 && (
                <button
                  type="button"
                  onClick={() => scrollToBottom(true)}
                  className="sticky bottom-2 left-full ml-auto block rounded-full bg-white px-3 py-1.5 text-[13px] font-semibold text-[#00a884] shadow-md"
                >
                  ↓ {w.newMessages(unseenBelow)}
                </button>
              )}
            </div>

            {error && (
              <p role="alert" className="bg-[#fde8e8] px-4 py-2 text-[13px] text-[#b42318]">
                {error}
              </p>
            )}

            {me && (
              <form onSubmit={send} className="bg-[#f0f2f5] px-3 py-2.5">
                {attachment && (
                  <div className="mb-2 flex items-center gap-3 rounded-lg bg-white p-2">
                    {/* eslint-disable-next-line @next/next/no-img-element -- local preview */}
                    <img src={attachment.url} alt={w.photo} className="h-16 w-16 rounded-md object-cover" />
                    <span className="min-w-0 flex-1 truncate text-[13px] text-[#667781]">{w.caption}</span>
                    <button type="button" onClick={() => pickFile(null)} className="rounded-full px-2 py-1 text-[13px] font-semibold text-[#b42318] hover:bg-black/5">
                      {w.removePicture}
                    </button>
                  </div>
                )}
                <div className="flex items-end gap-2">
                  <button
                    type="button"
                    onClick={() => fileInput.current?.click()}
                    aria-label={w.attach}
                    title={w.attach}
                    className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-[#54656f] hover:bg-black/5"
                  >
                    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8">
                      <path d="M21 12.5l-8.5 8.5a5.5 5.5 0 0 1-7.8-7.8L13.4 4.5a3.7 3.7 0 0 1 5.2 5.2l-8.6 8.6a1.8 1.8 0 0 1-2.6-2.6L15 8.1" />
                    </svg>
                  </button>
                  <input
                    ref={fileInput}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/heic"
                    className="sr-only"
                    tabIndex={-1}
                    aria-hidden="true"
                    onChange={(event) => {
                      pickFile(event.target.files?.[0] ?? null);
                      event.target.value = "";
                    }}
                  />
                  <textarea
                    ref={textArea}
                    rows={1}
                    value={draft}
                    maxLength={MAX_MESSAGE}
                    onChange={(event) => onDraft(event.target.value)}
                    onKeyDown={(event) => {
                      // Enter sends; Shift+Enter starts a new line.
                      if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                        event.preventDefault();
                        send();
                      }
                    }}
                    placeholder={attachment ? w.caption : w.message}
                    aria-label={w.message}
                    className="max-h-36 min-h-10 flex-1 resize-none rounded-lg bg-white px-3 py-2.5 text-[15px] text-[#111b21] outline-none placeholder:text-[#667781] [field-sizing:content] focus-visible:ring-2 focus-visible:ring-[#00a884]"
                  />
                  <button
                    type="submit"
                    disabled={!draft.trim() && !attachment}
                    aria-label={w.send}
                    title={w.send}
                    className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#00a884] text-white transition hover:bg-[#008069] disabled:bg-[#8696a0]"
                  >
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                      <path d="M3.4 20.4l17.5-7.5a1 1 0 0 0 0-1.8L3.4 3.6a1 1 0 0 0-1.4 1.2L4 11l9 1-9 1-2 6.2a1 1 0 0 0 1.4 1.2z" />
                    </svg>
                  </button>
                </div>
              </form>
            )}
          </>
        )}
      </section>

      {lightbox && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={w.photo}
          className="fixed inset-0 z-[100] flex flex-col bg-[#0b141a]/95"
          onClick={(event) => {
            if (event.target === event.currentTarget) setLightbox(null);
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") setLightbox(null);
          }}
        >
          <div className="flex justify-end gap-2 p-3">
            <a
              href={`${lightbox}&download=1`}
              download
              className="rounded-full bg-white/10 px-4 py-2 text-[14px] font-semibold text-white hover:bg-white/20"
            >
              {w.download}
            </a>
            <button type="button" autoFocus onClick={() => setLightbox(null)} className="rounded-full bg-white/10 px-4 py-2 text-[14px] font-semibold text-white hover:bg-white/20">
              {w.close}
            </button>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element -- private chat picture */}
          <img src={lightbox} alt={w.photo} className="m-auto max-h-[85vh] max-w-[95vw] object-contain" />
        </div>
      )}
    </div>
  );
}
