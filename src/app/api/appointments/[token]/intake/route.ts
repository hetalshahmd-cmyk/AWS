import { crossSiteBlocked } from "@/lib/csrf";
import { NextResponse } from "next/server";
import { BadPhotoError, deletePhoto, savePhoto } from "@/lib/intake-files";
import type { Intake } from "@/lib/models";
import { getBookingByToken, hasStarted, saveIntake } from "@/lib/repo";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ token: string }> };

const TEXT_FIELDS = [
  ["phone", 30],
  ["street", 120],
  ["city", 60],
  ["state", 30],
  ["zip", 12],
  ["emergencyName", 80],
  ["emergencyPhone", 30],
  ["memberId", 60],
  ["groupNumber", 60],
  ["allergies", 600],
  ["medications", 800],
  ["conditions", 800],
  ["surgeries", 800],
  ["lmp", 20],
  ["pregnancies", 10],
] as const;

const PHOTOS = [
  ["cardFront", "cardFrontId"],
  ["cardBack", "cardBackId"],
  ["photoId", "photoIdId"],
] as const;

/** POST (multipart) — save or update the pre-visit check-in. */
export async function POST(request: Request, ctx: Ctx) {
  const csrf = crossSiteBlocked(request);
  if (csrf) return csrf;
  const booking = await getBookingByToken((await ctx.params).token).catch(() => null);
  if (!booking) return NextResponse.json({ error: "This link isn't valid" }, { status: 404 });
  const id = booking.id;
  if (booking.status !== "confirmed" || hasStarted(booking)) {
    return NextResponse.json(
      { error: "Check-in is only open for upcoming appointments" },
      { status: 409 },
    );
  }

  // Three phone photos, already shrunk in the browser, fit well under this.
  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > 20 * 1024 * 1024) {
    return NextResponse.json({ error: "Those photos are too large" }, { status: 413 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form" }, { status: 400 });
  }
  if (form.get("attest") !== "yes") {
    return NextResponse.json(
      { error: "Please confirm the information is accurate" },
      { status: 400 },
    );
  }

  const previous = booking.intake ?? null;
  const text = Object.fromEntries(
    TEXT_FIELDS.map(([key, max]) => [key, String(form.get(key) ?? "").trim().slice(0, max)]),
  ) as Record<(typeof TEXT_FIELDS)[number][0], string>;
  const pregnantRaw = String(form.get("pregnant") ?? "");
  const pregnant = (
    ["yes", "no", "not-sure"].includes(pregnantRaw) ? pregnantRaw : ""
  ) as Intake["pregnant"];

  // A new photo replaces the old one; no new photo keeps what's on file.
  const photoIds: Record<string, string | null> = {};
  const replaced: (string | null)[] = [];
  try {
    for (const [field, key] of PHOTOS) {
      const file = form.get(field);
      if (file instanceof File && file.size > 0) {
        photoIds[key] = await savePhoto(file, id, field);
        replaced.push(previous?.[key] ?? null);
      } else {
        photoIds[key] = previous?.[key] ?? null;
      }
    }
  } catch (error) {
    if (error instanceof BadPhotoError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }

  const intake: Intake = {
    ...text,
    pregnant,
    cardFrontId: photoIds.cardFrontId,
    cardBackId: photoIds.cardBackId,
    photoIdId: photoIds.photoIdId,
    submittedAt: new Date().toISOString(),
  };
  await saveIntake(id, intake);
  await Promise.all(replaced.map((old) => deletePhoto(old)));
  return NextResponse.json({ ok: true, submittedAt: intake.submittedAt });
}
