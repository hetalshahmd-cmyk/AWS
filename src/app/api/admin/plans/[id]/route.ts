import { NextResponse } from "next/server";
import { adminRoute, readJson } from "@/lib/api-helpers";
import { deletePlan, updatePlan } from "@/lib/repo";
import type { Plan } from "@/lib/models";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = adminRoute(async (request, ctx: Ctx) => {
  const { id } = await ctx.params;
  const body = await readJson<Partial<Plan>>(request);

  const patch: Partial<Omit<Plan, "id">> = {};
  if (typeof body.tag === "string") patch.tag = body.tag.trim();
  if (typeof body.tagIcon === "string") patch.tagIcon = body.tagIcon;
  if (typeof body.amount === "string") patch.amount = body.amount.trim();
  if (typeof body.title === "string") patch.title = body.title.trim();
  if (typeof body.body === "string") patch.body = body.body.trim();
  if (typeof body.order === "number") patch.order = body.order;

  const plan = await updatePlan(id, patch);
  if (!plan) return NextResponse.json({ error: "Plan not found" }, { status: 404 });
  return NextResponse.json({ plan });
});

export const DELETE = adminRoute(async (_request, ctx: Ctx) => {
  const { id } = await ctx.params;
  const ok = await deletePlan(id);
  if (!ok) return NextResponse.json({ error: "Plan not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
});
