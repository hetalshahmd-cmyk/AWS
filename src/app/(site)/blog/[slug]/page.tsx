import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import ArticleBody from "@/components/blog/ArticleBody";
import { articleDateValue, formatArticleDate } from "@/components/blog/dates";
import { CallAndBook, Container, Eyebrow, Photo } from "@/components/site/ui";
import { extractFaqs, readingMinutes } from "@/lib/articles";
import { getLiveArticle, listLiveArticles } from "@/lib/articles-repo";
import { photos } from "@/lib/photos";
import { site } from "@/lib/site";

// Published from the admin panel; read on every request.
export const dynamic = "force-dynamic";

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://arizonawomenspecialists.com").replace(/\/+$/, "");

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const article = await getLiveArticle((await params).slug);
  if (!article) return { title: `Not found — ${site.name}`, robots: { index: false } };
  const cover = article.cover ? photos[article.cover] : null;
  const title = article.seoTitle || `${article.title} — ${site.name}`;
  return {
    title,
    description: article.description,
    alternates: { canonical: `/blog/${article.slug}` },
    openGraph: {
      type: "article",
      url: `/blog/${article.slug}`,
      title,
      description: article.description,
      siteName: site.name,
      publishedTime: article.publishedAt,
      modifiedTime: article.updatedAt,
      images: cover ? [{ url: cover.src.src, width: cover.src.width, height: cover.src.height, alt: cover.alt }] : undefined,
    },
  };
}

export default async function ArticlePage({ params }: Props) {
  const article = await getLiveArticle((await params).slug);
  if (!article) notFound();
  const others = await listLiveArticles();
  const publicArticles = new Set(others.map((item) => item.slug));
  const more = others.filter((item) => item.slug !== article.slug).slice(0, 3);
  const cover = article.cover ? photos[article.cover] : null;
  const url = `${SITE_URL}/blog/${article.slug}`;

  // Structured data for search engines: a medical page, who reviewed it, when
  // — and its questions and answers, when it has an FAQ section.
  const faqs = extractFaqs(article.body);
  const page = {
    "@type": "MedicalWebPage",
    "@id": url,
    url,
    headline: article.title,
    name: article.seoTitle || article.title,
    description: article.description,
    datePublished: article.publishedAt,
    dateModified: article.updatedAt,
    lastReviewed: articleDateValue(article.reviewedAt),
    reviewedBy: { "@type": "Person", name: article.reviewedBy.name, jobTitle: article.reviewedBy.cred || undefined },
    ...(cover ? { image: `${SITE_URL}${cover.src.src}` } : {}),
    inLanguage: "en-US",
    publisher: { "@type": "MedicalOrganization", name: site.name, url: SITE_URL },
  };
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": faqs.length
      ? [
          page,
          {
            "@type": "FAQPage",
            "@id": `${url}#faq`,
            mainEntity: faqs.map((faq) => ({
              "@type": "Question",
              name: faq.question,
              acceptedAnswer: { "@type": "Answer", text: faq.answer },
            })),
          },
        ]
      : [page],
  };

  return (
    <>
      <script
        type="application/ld+json"
        // Escaping "<" keeps any text in the article from closing the script tag.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
      <article className="bg-white">
        <header className="bg-ivory">
          <Container className="pb-[clamp(2.5rem,6vw,4rem)] pt-[clamp(2.5rem,6vw,4.5rem)]">
            <div className="mx-auto max-w-[760px]">
              <Link href="/blog" className="focus-ring text-[14px] font-medium text-plum-soft hover:text-wine">
                ← Health library
              </Link>
              <div className="mt-6">
                <Eyebrow>Health library</Eyebrow>
              </div>
              <h1 className="mt-5 font-display text-[clamp(2.2rem,5vw,3.6rem)] font-normal leading-[1.06] tracking-[-0.02em] text-plum">
                {article.title}
              </h1>
              {article.description && (
                <p className="mt-5 text-[clamp(1.05rem,1.5vw,1.2rem)] leading-relaxed text-plum-soft">{article.description}</p>
              )}
              <p className="mt-6 flex flex-wrap gap-x-3 gap-y-1 text-[14px] text-plum-soft">
                <span>
                  Medically reviewed by <strong className="font-semibold text-plum">{article.reviewedBy.name}</strong>
                  {article.reviewedBy.cred ? `, ${article.reviewedBy.cred}` : ""} on{" "}
                  <time dateTime={articleDateValue(article.reviewedAt)}>{formatArticleDate(article.reviewedAt)}</time>
                </span>
                <span aria-hidden="true">·</span>
                <span>
                  Updated <time dateTime={articleDateValue(article.updatedAt)}>{formatArticleDate(article.updatedAt)}</time>
                </span>
                <span aria-hidden="true">·</span>
                <span>{readingMinutes(article.body)} min read</span>
              </p>
            </div>
          </Container>
        </header>

        <Container className="pb-[clamp(4rem,9vw,7rem)]">
          <div className="mx-auto max-w-[760px]">
            {cover && (
              <Photo
                src={cover.src}
                alt={cover.alt}
                sizes="(min-width: 800px) 760px, 100vw"
                preload
                className="-mt-2 aspect-[16/9] w-full"
              />
            )}
            <div className="mt-10">
              <ArticleBody body={article.body} publicArticles={publicArticles} />
            </div>

            <aside className="mt-14 rounded-[24px] bg-shell p-[clamp(1.5rem,4vw,2.25rem)]" aria-label="Talk to us">
              <p className="font-display text-[1.5rem] leading-snug text-plum">Questions about your own care?</p>
              <p className="mt-2 text-[15px] leading-relaxed text-plum-soft">
                This article is general information, not medical advice for you. Our doctors can look at your situation —
                book a visit or call us. In an emergency, call 911.
              </p>
              <CallAndBook className="mt-6" />
            </aside>

            {more.length > 0 && (
              <nav className="mt-14" aria-labelledby="more-articles">
                <h2 id="more-articles" className="font-display text-[1.6rem] text-plum">
                  More from the health library
                </h2>
                <ul className="mt-5 divide-y divide-mist border-y border-mist">
                  {more.map((item) => (
                    <li key={item.slug} className="py-4">
                      <Link href={`/blog/${item.slug}`} className="focus-ring font-semibold text-plum hover:text-wine">
                        {item.title}
                      </Link>
                      <p className="mt-1 text-[14px] text-plum-soft">{item.description}</p>
                    </li>
                  ))}
                </ul>
              </nav>
            )}
          </div>
        </Container>
      </article>
    </>
  );
}
