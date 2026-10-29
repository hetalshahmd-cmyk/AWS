import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { adminRoute, readJson } from "@/lib/api-helpers";
import { createProvider, listStaff, loadProviders, ProviderInputError } from "@/lib/repo";

export const dynamic = "force-dynamic";

/** GET — every provider (hidden ones too) with the email of their sign-in. */
export const GET = adminRoute(async () => {
  const [providers, staff] = await Promise.all([loadProviders(true), listStaff()]);
  const logins = Object.fromEntries(
    staff.filter((account) => account.role === "provider" && account.providerId).map((account) => [account.providerId, account.email]),
  );
  return NextResponse.json({ providers, logins });
});

/** POST — add a provider. */
export const POST = adminRoute(async (request) => {
  const body = await readJson<Record<string, unknown>>(request);
  try {
    const provider = await createProvider(body);
    revalidatePath("/", "layout");
    return NextResponse.json({ provider }, { status: 201 });
  } catch (error) {
    if (error instanceof ProviderInputError) return NextResponse.json({ error: error.message }, { status: 400 });
    throw error;
  }
});
