import type { StaticImageData } from "next/image";
import { photos } from "./photos";
import type { ImageRef } from "./site-content";

/** The picture to render for an ImageRef: an upload's URL or a library photo. */
export function resolveImage(image: ImageRef): { src: StaticImageData | string; alt: string } {
  if (image.url) return { src: image.url, alt: image.alt };
  const photo = image.photo && image.photo in photos ? photos[image.photo] : photos.heroConsultation;
  return { src: photo.src, alt: image.alt || photo.alt };
}
