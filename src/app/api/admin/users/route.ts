import { NextResponse } from "next/server";
import { adminRoute } from "@/lib/api-helpers";
import { listUserRows } from "@/lib/repo";

export const dynamic = "force-dynamic";

export const GET = adminRoute(async () => {
  return NextResponse.json({ users: await listUserRows() });
});
