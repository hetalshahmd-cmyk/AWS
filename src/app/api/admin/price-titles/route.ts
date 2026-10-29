import { NextResponse } from "next/server";
import { adminRoute, readJson } from "@/lib/api-helpers";
import { addPriceTitle, getPriceTitles } from "@/lib/repo";

export const dynamic = "force-dynamic";

/** GET — the title choices for price cards. */
export const GET = adminRoute(async () => {
  return NextResponse.json({ titles: await getPriceTitles() });
});

/** POST { title } — save a new title choice; returns the updated list. */
export const POST = adminRoute(async (request) => {
  const body = await readJson<{ title?: unknown }>(request);
  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (title.length < 2) {
    return NextResponse.json({ error: "Write a title" }, { status: 400 });
  }
  return NextResponse.json({ titles: await addPriceTitle(title) }, { status: 201 });
});
