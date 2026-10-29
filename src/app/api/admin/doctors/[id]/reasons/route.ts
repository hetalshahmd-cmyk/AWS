import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { adminRoute, readJson } from "@/lib/api-helpers";
import { isProviderId } from "@/lib/scheduling";
import { loadProviders, ProviderInputError, saveReasonsFor } from "@/lib/repo";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** PUT { reasons: string[] } — the visit reasons this provider's booking form offers. */
export const PUT = adminRoute(async (request, ctx: Ctx) => {
  const { id } = await ctx.params;
  await loadProviders();
  if (!isProviderId(id)) return NextResponse.json({ error: "Provider not found" }, { status: 404 });
  const body = await readJson<{ reasons?: unknown }>(request);
  const list = Array.isArray(body.reasons) ? body.reasons.filter((item): item is string => typeof item === "string") : [];
  try {
    const reasons = await saveReasonsFor(id, list);
    revalidatePath("/", "layout");
    return NextResponse.json({ reasons });
  } catch (error) {
    if (error instanceof ProviderInputError) return NextResponse.json({ error: error.message }, { status: 400 });
    throw error;
  }
});
