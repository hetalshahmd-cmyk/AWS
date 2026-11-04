import { NextResponse } from "next/server";
import { readJson, staffRoute } from "@/lib/api-helpers";
import { ArticleError } from "@/lib/articles";
import { articleAction, ArticleConflictError, WORKFLOW_ACTIONS, type WorkflowAction } from "@/lib/articles-repo";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/**
 * POST `{action, hash, reviewerId?, note?, confirm?}` — review and
 * publication. Admins submit, withdraw, publish and unpublish; the assigned
 * doctor approves or asks for changes. `hash` is the text the person saw.
 */
export const POST = staffRoute(async (request, staff, ctx: Ctx) => {
  const body = await readJson<Record<string, unknown>>(request);
  const action = body.action as WorkflowAction;
  if (!WORKFLOW_ACTIONS.includes(action)) return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  try {
    const article = await articleAction((await ctx.params).id, action, staff, body);
    if (!article) return NextResponse.json({ error: "Article not found" }, { status: 404 });
    // Doctors only need to know it worked; the text and history are for admins.
    return NextResponse.json(staff.role === "admin" ? { article } : { status: article.status });
  } catch (error) {
    if (error instanceof ArticleError) return NextResponse.json({ error: error.message }, { status: 400 });
    if (error instanceof ArticleConflictError) return NextResponse.json({ error: error.message }, { status: 409 });
    throw error;
  }
});
