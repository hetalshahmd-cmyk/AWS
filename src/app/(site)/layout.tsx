import SiteNav from "@/components/site/SiteNav";
import SiteFooter from "@/components/site/SiteFooter";

/**
 * Office hours and providers on these pages come from the database. Pages are
 * rendered per request (the CSP nonce needs it — see app/layout.tsx), so a
 * change in the admin panel shows on the next page view.
 */

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SiteNav />
      <main id="main" className="flex-1">
        {children}
      </main>
      <SiteFooter />
    </>
  );
}
