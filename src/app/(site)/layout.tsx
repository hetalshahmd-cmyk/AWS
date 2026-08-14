import SiteNav from "@/components/site/SiteNav";
import SiteFooter from "@/components/site/SiteFooter";

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SiteNav />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </>
  );
}
