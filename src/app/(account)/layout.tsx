import SiteNav from "@/components/site/SiteNav";

/**
 * Account pages (log in, register, my bookings) keep the header so people can
 * navigate, but drop the marketing CTA and footer — nothing to sell here.
 */
export default function AccountLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SiteNav />
      <main className="flex-1">{children}</main>
    </>
  );
}
