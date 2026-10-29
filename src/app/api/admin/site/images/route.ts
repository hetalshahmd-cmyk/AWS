import { NextResponse } from "next/server";
import { adminRoute } from "@/lib/api-helpers";
import { SiteContentError, uploadSiteImage } from "@/lib/repo";

export const dynamic = "force-dynamic";

/**
 * POST (multipart, field "image") — upload a picture for the hero or an
 * office card. It goes live only when the content is saved with its URL.
 */
export const POST = adminRoute(async (request) => {
  if (Number(request.headers.get("content-length") ?? 0) > 9 * 1024 * 1024) {
    return NextResponse.json({ error: "That picture is too large (8 MB max)" }, { status: 413 });
  }
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid upload" }, { status: 400 });
  }
  const file = form.get("image");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "Choose a picture" }, { status: 400 });
  }
  try {
    return NextResponse.json({ url: await uploadSiteImage(file) }, { status: 201 });
  } catch (error) {
    if (error instanceof SiteContentError) return NextResponse.json({ error: error.message }, { status: 400 });
    throw error;
  }
});
