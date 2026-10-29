"use client";

import { setSiteContent, type SiteContent } from "@/lib/site-content";

/**
 * Hands the browser the hero and office details the server rendered with
 * (Admin → Site content), like ProvidersSync does for providers.
 */
export default function SiteContentSync({ content }: { content: SiteContent }) {
  setSiteContent(content);
  return null;
}
