import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { adminRoute } from "@/lib/api-helpers";
import { ProviderInputError, setProviderPhoto } from "@/lib/repo";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** POST (multipart, field "photo") — a new headshot. */
export const POST = adminRoute(async (request, ctx: Ctx) => {
  const { id } = await ctx.params;
  if (Number(request.headers.get("content-length") ?? 0) > 5 * 1024 * 1024) {
    return NextResponse.json({ error: "That photo is too large (4 MB max)" }, { status: 413 });
  }
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid upload" }, { status: 400 });
  }
  const file = form.get("photo");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "Choose a photo" }, { status: 400 });
  }
  try {
    const provider = await setProviderPhoto(id, file);
    if (!provider) return NextResponse.json({ error: "Provider not found" }, { status: 404 });
    revalidatePath("/", "layout");
    return NextResponse.json({ provider });
  } catch (error) {
    if (error instanceof ProviderInputError) return NextResponse.json({ error: error.message }, { status: 400 });
    throw error;
  }
});
