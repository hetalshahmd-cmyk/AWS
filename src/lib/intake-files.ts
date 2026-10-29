import { GridFSBucket, ObjectId } from "mongodb";
import { getDb } from "./db";

/**
 * Check-in photos (insurance card, ID) in MongoDB GridFS, bucket "intake".
 * They are health information: served only to signed-in admins, never cached
 * publicly, and kept in the same database as the bookings so they share its
 * access controls (and its BAA, if the database host signs one).
 */

const MAX_BYTES = 6 * 1024 * 1024;
const TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]);

async function bucket() {
  return new GridFSBucket(await getDb(), { bucketName: "intake" });
}

export class BadPhotoError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BadPhotoError";
  }
}

/** The file's own first bytes must match an image format, whatever it claims to be. */
function looksLikeImage(data: Buffer): boolean {
  if (data.length < 12) return false;
  if (data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) return true; // JPEG
  if (data.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return true; // PNG
  if (data.toString("latin1", 0, 4) === "RIFF" && data.toString("latin1", 8, 12) === "WEBP") return true; // WebP
  if (data.toString("latin1", 4, 8) === "ftyp") return true; // HEIC / HEIF
  return false;
}

export async function savePhoto(file: File, bookingId: string, kind: string): Promise<string> {
  if (!TYPES.has(file.type)) throw new BadPhotoError("Photos must be JPEG, PNG, WebP or HEIC");
  if (file.size > MAX_BYTES) throw new BadPhotoError("That photo is too large");
  const data = Buffer.from(await file.arrayBuffer());
  if (!looksLikeImage(data)) throw new BadPhotoError("That file isn't a photo");
  const id = new ObjectId();
  const upload = (await bucket()).openUploadStreamWithId(id, `${bookingId}-${kind}`, {
    metadata: { bookingId, kind, contentType: file.type },
  });
  await new Promise<void>((resolve, reject) => {
    upload.once("finish", () => resolve());
    upload.once("error", reject);
    upload.end(data);
  });
  return id.toString();
}

export async function deletePhoto(id: string | null | undefined): Promise<void> {
  if (!id || !ObjectId.isValid(id)) return;
  await (await bucket()).delete(new ObjectId(id)).catch(() => undefined);
}

export async function readPhoto(
  id: string,
): Promise<{ data: Buffer; contentType: string; bookingId: string } | null> {
  if (!ObjectId.isValid(id)) return null;
  const b = await bucket();
  const [file] = await b.find({ _id: new ObjectId(id) }).limit(1).toArray();
  if (!file) return null;
  const chunks: Buffer[] = [];
  await new Promise<void>((resolve, reject) => {
    b.openDownloadStream(file._id)
      .on("data", (chunk: Buffer) => chunks.push(chunk))
      .on("end", () => resolve())
      .on("error", reject);
  });
  const meta = (file.metadata ?? {}) as { contentType?: string; bookingId?: string };
  return {
    data: Buffer.concat(chunks),
    contentType: meta.contentType ?? "image/jpeg",
    bookingId: meta.bookingId ?? "",
  };
}
