import { NextResponse } from "next/server";
import { ForbiddenError, getCurrentAdmin, getCurrentUser, UnauthorizedError } from "./auth";
import { ChatError, type ChatRole } from "./chat";
import type { ChatAccess } from "./chat-repo";
import { crossSiteBlocked } from "./csrf";
import { providerById } from "./scheduling";

/**
 * Who is calling a chat API. Patients use /api/my/chats with their patient
 * session; staff use /api/doctor/chats with the staff session — a provider
 * sees their own chats, an admin every chat but only to read.
 */
export type ChatCaller = ChatAccess & { name: string };

export async function patientCaller(): Promise<ChatCaller> {
  const user = await getCurrentUser();
  if (!user) throw new UnauthorizedError();
  return { viewer: "patient", userId: user.id, name: user.name };
}

export async function staffCaller(): Promise<ChatCaller> {
  const staff = await getCurrentAdmin();
  if (!staff) throw new UnauthorizedError();
  // Admins and front-desk staff monitor chats; they never write in them.
  if (staff.role === "admin" || staff.role === "staff") return { viewer: "admin", name: staff.name };
  return { viewer: "provider", providerId: staff.providerId, name: providerById(staff.providerId)?.name ?? staff.name };
}

/** Writing (send, read, typing, delete) is for the two people in the chat — not admins. */
export function writer(caller: ChatCaller): ChatCaller & { viewer: ChatRole } {
  if (caller.viewer === "admin") throw new ForbiddenError();
  return caller as ChatCaller & { viewer: ChatRole };
}

/** Runs a chat handler: cross-site check, then readable errors. */
export async function chatRoute(request: Request, handler: () => Promise<NextResponse>): Promise<NextResponse> {
  const csrf = crossSiteBlocked(request);
  if (csrf) return csrf;
  try {
    return await handler();
  } catch (error) {
    if (error instanceof UnauthorizedError) return NextResponse.json({ error: "Sign in first" }, { status: 401 });
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: "Admins can read chats but not write in them" }, { status: 403 });
    }
    if (error instanceof ChatError) return NextResponse.json({ error: error.message }, { status: 400 });
    console.error("chat route failed", error);
    return NextResponse.json({ error: "Something went wrong — please try again." }, { status: 500 });
  }
}

export const notFound = () => NextResponse.json({ error: "Chat not found" }, { status: 404 });
