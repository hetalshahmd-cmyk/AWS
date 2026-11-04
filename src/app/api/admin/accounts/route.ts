import { NextResponse } from "next/server";
import { adminRoute, readJson } from "@/lib/api-helpers";
import { createAdminAccount, generatePassword, listStaff, loadProviders, StaffInputError } from "@/lib/repo";
import { providerById } from "@/lib/scheduling";

export const dynamic = "force-dynamic";

/** GET — every sign-in for the back office: admins, front desk, providers. */
export const GET = adminRoute(async () => {
  await loadProviders();
  const accounts = (await listStaff()).map((account) => ({
    ...account,
    providerName: account.providerId ? (providerById(account.providerId)?.name ?? account.providerId) : null,
  }));
  return NextResponse.json({ accounts });
});

/**
 * POST { name, email, role: "admin" | "staff", password | generate: true } —
 * a new admin or front-desk account. Provider sign-ins are made under Doctors.
 */
export const POST = adminRoute(async (request) => {
  const body = await readJson<Record<string, unknown>>(request);
  const password = body.generate === true ? generatePassword() : body.password;
  try {
    const account = await createAdminAccount({ ...body, password });
    return NextResponse.json({ account, ...(body.generate === true ? { password } : {}) }, { status: 201 });
  } catch (error) {
    if (error instanceof StaffInputError) return NextResponse.json({ error: error.message }, { status: 400 });
    throw error;
  }
});
