import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { adminRoute, readJson } from "@/lib/api-helpers";
import { ProviderInputError, updateProvider } from "@/lib/repo";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** PATCH — save a provider's profile (and whether they show on the site). */
export const PATCH = adminRoute(async (request, ctx: Ctx) => {
  const { id } = await ctx.params;
  const body = await readJson<Record<string, unknown>>(request);
  try {
    const provider = await updateProvider(id, body);
    if (!provider) return NextResponse.json({ error: "Provider not found" }, { status: 404 });
    // Names, photos and profiles appear on every public page.
    revalidatePath("/", "layout");
    return NextResponse.json({ provider });
  } catch (error) {
    if (error instanceof ProviderInputError) return NextResponse.json({ error: error.message }, { status: 400 });
    throw error;
  }
});
