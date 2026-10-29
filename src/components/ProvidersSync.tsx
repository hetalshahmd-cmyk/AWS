"use client";

import { setProviders, type Provider } from "@/lib/providers";

/**
 * Hands the browser the providers the server rendered with (from MongoDB).
 * It renders before the page, so every component that reads lib/providers
 * during its own render already sees this list.
 */
export default function ProvidersSync({ list }: { list: Provider[] }) {
  setProviders(list);
  return null;
}
