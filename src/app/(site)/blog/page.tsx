import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Container, Eyebrow } from "@/components/site/ui";
import { formatArticleDate } from "@/components/blog/dates";
import { readingMinutes } from "@/lib/articles";
import { listLiveArticles } from "@/lib/articles-repo";
import { photos } from "@/lib/photos";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: `Health Library — ${site.name}`,
  description:
    "Pregnancy and women's health articles from Arizona Women Specialists, each reviewed by one of our doctors before it is published.",
  alternates: { canonical: "/blog" },
};

// Articles are published from the admin panel, so read them on every request.
export const dynamic = "force-dynamic";

export default async function BlogPage() {
  const articles = await listLiveArticles();
  // Nothing published yet: the page doesn't exist rather than standing empty.
  if (!articles.length) notFound();

  return (
    <section className="bg-ivory">
      <Container className="pb-[clamp(4rem,9vw,7rem)] pt-[clamp(2.5rem,6vw,4.5rem)]">
        <Eyebrow>Health library</Eyebrow>
        <h1 className="mt-5 max-w-[20ch] font-display text-[clamp(2.5rem,5.6vw,4.2rem)] font-normal leading-[1.04] tracking-[-0.02em] text-plum">
          Answers to the questions we hear most
        </h1>
        <p className="mt-6 max-w-[56ch] text-[clamp(1.05rem,1.5vw,1.18rem)] leading-relaxed text-plum-soft">
          Plain-language articles on pregnancy and women&apos;s health. Every one is reviewed by one of our doctors
          before it is published.
        </p>

        <ul className="mt-12 grid gap-6 min-[700px]:grid-cols-2 min-[1100px]:grid-cols-3">
          {articles.map((article) => {
            const cover = article.cover ? photos[article.cover] : null;
            return (
              <li key={article.slug} className="group relative flex flex-col overflow-hidden rounded-[24px] border border-mist bg-white">
                {cover && (
                  <div className="relative aspect-[16/10] overflow-hidden bg-sand">
                    <Image
                      src={cover.src}
                      alt=""
                      fill
                      sizes="(min-width: 1100px) 33vw, (min-width: 700px) 50vw, 100vw"
                      placeholder="blur"
                      className="object-cover transition duration-500 group-hover:scale-[1.03]"
                    />
                  </div>
                )}
                <div className="flex flex-1 flex-col p-6">
                  <h2 className="font-display text-[1.45rem] leading-snug text-plum">
                    <Link href={`/blog/${article.slug}`} className="focus-ring after:absolute after:inset-0 hover:text-wine">
                      {article.title}
                    </Link>
                  </h2>
                  <p className="mt-3 flex-1 text-[15px] leading-relaxed text-plum-soft">{article.description}</p>
                  <p className="mt-5 text-[13px] text-plum-soft">
                    Reviewed by {article.reviewedBy.name} · {formatArticleDate(article.updatedAt)} ·{" "}
                    {readingMinutes(article.body)} min read
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      </Container>
    </section>
  );
}
