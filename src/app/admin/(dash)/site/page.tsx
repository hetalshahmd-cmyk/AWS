import type { Metadata } from "next";
import SiteContentEditor from "@/components/admin/SiteContentEditor";
import { requireAdminPage } from "@/lib/auth";
import { loadSiteContent } from "@/lib/repo";

export const metadata: Metadata = { title: "Modify site — Admin" };
export const dynamic = "force-dynamic";

export default async function SiteContentPage() {
  await requireAdminPage();
  const content = await loadSiteContent(true);

  return (
    <div>
      <h1 className="font-display text-[1.9rem] font-semibold">Modify site</h1>
      <p className="mt-1 max-w-[70ch] text-plum-soft">
        The top section of the home page and the office cards — words and pictures. Changes go
        live within a minute.
      </p>
      <SiteContentEditor initial={content} />
    </div>
  );
}
