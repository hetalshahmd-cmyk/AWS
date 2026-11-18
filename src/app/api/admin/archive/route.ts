import { NextResponse } from "next/server";
import { adminRoute, readJson } from "@/lib/api-helpers";
import { deletePatientChats } from "@/lib/chat-repo";
import { listArchive, purgeBookings, purgeUsers, restoreBookings, restoreUsers } from "@/lib/repo";

export const dynamic = "force-dynamic";

/** Admin → Archive: deleted bookings and patients, until restored or erased. */
export const GET = adminRoute(async () => NextResponse.json(await listArchive()));

/**
 * { kind: "bookings" | "patients", action: "restore" | "delete", ids: [...] }.
 * "delete" erases for good; the dashboard's numbers stay the same either way.
 */
export const POST = adminRoute(async (request) => {
  const body = await readJson<{ kind?: unknown; action?: unknown; ids?: unknown }>(request);
  const ids = Array.isArray(body.ids) ? body.ids.filter((id): id is string => typeof id === "string").slice(0, 500) : [];
  if (!ids.length) return NextResponse.json({ error: "Select at least one" }, { status: 400 });

  if (body.kind === "bookings" && body.action === "restore") {
    return NextResponse.json({ ok: true, count: await restoreBookings(ids) });
  }
  if (body.kind === "bookings" && body.action === "delete") {
    return NextResponse.json({ ok: true, count: await purgeBookings(ids) });
  }
  if (body.kind === "patients" && body.action === "restore") {
    return NextResponse.json({ ok: true, count: await restoreUsers(ids) });
  }
  if (body.kind === "patients" && body.action === "delete") {
    const removed = await purgeUsers(ids);
    for (const id of removed) await deletePatientChats(id);
    return NextResponse.json({ ok: true, count: removed.length });
  }
  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
});
