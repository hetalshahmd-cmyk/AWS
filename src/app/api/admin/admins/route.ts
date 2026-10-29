import { NextResponse } from "next/server";
import { adminRoute, readJson } from "@/lib/api-helpers";
import { createAdminAccount, listStaff, StaffInputError } from "@/lib/repo";

export const dynamic = "force-dynamic";

/** GET — the full admin accounts (provider sign-ins are under Doctors). */
export const GET = adminRoute(async () => {
  const admins = (await listStaff()).filter((account) => account.role === "admin");
  return NextResponse.json({ admins });
});

/** POST { name, email, password } — another admin. */
export const POST = adminRoute(async (request) => {
  const body = await readJson<Record<string, unknown>>(request);
  try {
    const admin = await createAdminAccount(body);
    return NextResponse.json({ admin }, { status: 201 });
  } catch (error) {
    if (error instanceof StaffInputError) return NextResponse.json({ error: error.message }, { status: 400 });
    throw error;
  }
});
