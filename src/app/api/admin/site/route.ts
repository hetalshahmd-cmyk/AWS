import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { adminRoute, readJson } from "@/lib/api-helpers";
import { loadSiteContent, saveSiteContent, SiteContentError } from "@/lib/repo";

export const dynamic = "force-dynamic";

/** GET — the home page hero and the office cards. */
export const GET = adminRoute(async () => {
  return NextResponse.json({ content: await loadSiteContent(true) });
});

/** PUT `{hero, offices}` — save both. */
export const PUT = adminRoute(async (request) => {
  const body = await readJson<unknown>(request);
  try {
    const content = await saveSiteContent(body);
    // Office names and addresses appear on every public page.
    revalidatePath("/", "layout");
    return NextResponse.json({ content });
  } catch (error) {
    if (error instanceof SiteContentError) return NextResponse.json({ error: error.message }, { status: 400 });
    throw error;
  }
});
