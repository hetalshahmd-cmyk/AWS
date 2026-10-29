import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { adminRoute, readJson } from "@/lib/api-helpers";
import { ALL_VISIT_REASONS } from "@/lib/practice";
import { getProviderReasons, saveProviderReasons, type ProviderReasons } from "@/lib/repo";
import { isProviderId } from "@/lib/scheduling";

export const dynamic = "force-dynamic";

const ALL = new Set<string>(ALL_VISIT_REASONS);

/** GET — which visit reasons each provider sees. */
export const GET = adminRoute(async () => {
  return NextResponse.json({ reasons: await getProviderReasons() });
});

/** PUT — save each provider's list. */
export const PUT = adminRoute(async (request) => {
  const body = await readJson<{ reasons?: Record<string, unknown> }>(request);
  const clean: ProviderReasons = {};
  for (const [providerId, list] of Object.entries(body.reasons ?? {})) {
    if (!isProviderId(providerId) || !Array.isArray(list)) continue;
    const reasons = [...new Set(list.filter((reason): reason is string => typeof reason === "string" && ALL.has(reason)))];
    if (reasons.length === 0) {
      return NextResponse.json(
        { error: "Every provider needs at least one visit reason" },
        { status: 400 },
      );
    }
    clean[providerId] = reasons;
  }
  await saveProviderReasons(clean);
  // The Providers page builds each provider's booking form from these.
  revalidatePath("/about");
  return NextResponse.json({ reasons: clean });
});
