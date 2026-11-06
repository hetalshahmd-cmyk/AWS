import SiteNav from "@/components/site/SiteNav";
import { hasLiveArticles } from "@/lib/articles-repo";
import { navLinksFor } from "@/lib/site";

/**
 * Account pages (log in, register, my bookings) keep the header so people can
 * navigate, but drop the marketing CTA and footer — nothing to sell here.
 */
export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SiteNav links={navLinksFor(await hasLiveArticles().catch(() => false))} />
      <main id="main" className="flex-1">
        {children}
      </main>
    </>
  );
}
