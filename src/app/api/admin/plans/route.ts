import { NextResponse } from "next/server";
import { adminRoute, readJson } from "@/lib/api-helpers";
import { createPlan, getPlans } from "@/lib/repo";
import type { Plan } from "@/lib/models";

export const dynamic = "force-dynamic";

export const GET = adminRoute(async () => {
  return NextResponse.json({ plans: await getPlans() });
});

export const POST = adminRoute(async (request) => {
  const body = await readJson<Partial<Plan>>(request);
  const plans = await getPlans();

  const plan = await createPlan({
    order: body.order ?? plans.length,
    tag: body.tag?.trim() || "Visit",
    tagIcon: body.tagIcon ?? "star",
    amount: body.amount?.trim() || "$0",
    title: body.title?.trim() || "New service",
    body: body.body?.trim() || "",
  });

  return NextResponse.json({ plan }, { status: 201 });
});
