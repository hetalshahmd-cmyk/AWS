/**
 * Unit tests for blog articles: validation, the Markdown subset, link rules,
 * internal-link suggestions and SEO checks. No database:  npm test
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ArticleBody from "@/components/blog/ArticleBody";
import {
  applyLinkSuggestion,
  articleLinks,
  canonicalContent,
  classifyHref,
  cleanArticleContent,
  linkProblems,
  parseMarkdown,
  reviewProblems,
  seoChecks,
  slugify,
  suggestLinks,
  wordCount,
  type ArticleContent,
  type LinkTarget,
} from "@/lib/articles";

const COVERS = ["heroPregnancy", "stethoscope"];
const html = (body: string, publicArticles?: Set<string>) =>
  renderToStaticMarkup(createElement(ArticleBody, { body, publicArticles }));

const content = (extra: Partial<ArticleContent> = {}): ArticleContent => ({
  title: "Early pregnancy symptoms",
  slug: "early-pregnancy-symptoms",
  seoTitle: "",
  description: "",
  focusKeyword: "",
  body: "",
  cover: null,
  ...extra,
});

describe("cleanArticleContent", () => {
  it("makes a web address from the title", () => {
    const clean = cleanArticleContent({ title: "  Is it safe to exercise   while pregnant? " }, COVERS);
    assert.equal(clean.title, "Is it safe to exercise while pregnant?");
    assert.equal(clean.slug, "is-it-safe-to-exercise-while-pregnant");
  });
  it("refuses a bad address, a missing title and an unknown cover", () => {
    assert.throws(() => cleanArticleContent({ title: "x", slug: "../admin" }, COVERS), /web address/);
    assert.throws(() => cleanArticleContent({ title: "   " }, COVERS), /Title/);
    assert.throws(() => cleanArticleContent({ title: "x", cover: "notAPhoto" }, COVERS), /cover/);
  });
  it("keeps a library cover", () => assert.equal(cleanArticleContent({ title: "x", cover: "stethoscope" }, COVERS).cover, "stethoscope"));
  it("fingerprints the same content the same way", () => {
    const a = cleanArticleContent({ title: "A", body: "Hello\r\n\r\nWorld  " }, COVERS);
    const b = cleanArticleContent({ title: "A", body: "Hello\n\nWorld" }, COVERS);
    assert.equal(canonicalContent(a), canonicalContent(b));
    assert.notEqual(canonicalContent(a), canonicalContent({ ...a, body: "Hello\n\nWorld!" }));
  });
  it("slugify drops accents and symbols", () => assert.equal(slugify("Café & Crème: 2nd Trimester!"), "cafe-and-creme-2nd-trimester"));
});

describe("Markdown", () => {
  it("parses headings, lists, quotes and paragraphs", () => {
    const blocks = parseMarkdown("## Signs\n\nFirst line\nsame paragraph\n\n- one\n- **two**\n\n1. a\n2. b\n\n> Call us\n\n### More\n---");
    assert.deepEqual(
      blocks.map((block) => block.type),
      ["heading", "paragraph", "list", "list", "quote", "heading", "rule"],
    );
    assert.equal(blocks[0].type === "heading" && blocks[0].id, "signs");
  });
  it("never makes an h1 — the title is the page's only one", () => {
    const blocks = parseMarkdown("# Big");
    assert.equal(blocks[0].type === "heading" && blocks[0].level, 2);
  });
  it("renders typed HTML and script as text", () => {
    const out = html('<script>alert(1)</script>\n\n<img src=x onerror="alert(1)">');
    assert.ok(!out.includes("<script"));
    assert.ok(!out.includes("<img"));
    assert.ok(out.includes("&lt;script&gt;"));
  });
  for (const evil of ["javascript:alert(1)", "JAVASCRIPT:alert(1)", "data:text/html,x", "//evil.example", "http://plain.example", "/\\evil.example", "vbscript:x"]) {
    it(`does not link ${evil}`, () => {
      const out = html(`[click](${evil})`);
      assert.ok(!out.includes("<a"), out);
      assert.ok(out.includes("click"));
    });
  }
  it("links site pages and https sources, opening sources in a new tab", () => {
    const out = html("[book](/book) and [ACOG](https://www.acog.org/womens-health)");
    assert.ok(out.includes('href="/book"'));
    assert.match(out, /href="https:\/\/www\.acog\.org\/womens-health" target="_blank" rel="noopener noreferrer"/);
  });
  it("shows a link to an unpublished article as plain words", () => {
    const out = html("[read this](/blog/draft-one) and [that](/blog/live-one)", new Set(["live-one"]));
    assert.ok(!out.includes("draft-one"));
    assert.ok(out.includes('href="/blog/live-one"'));
  });
  it("counts words without the Markdown", () => assert.equal(wordCount("## Two words\n\n- **bold** item\n\n[a link](/book)"), 6));
});

describe("links", () => {
  it("classifies addresses", () => {
    assert.equal(classifyHref("/services#service-2"), "internal");
    assert.equal(classifyHref("https://www.cdc.gov/pregnancy"), "external");
    assert.equal(classifyHref("https://user:pw@evil.example"), null);
    assert.equal(classifyHref("mailto:x@y.z"), null);
  });
  it("reports bad, unknown and self links", () => {
    const problems = linkProblems(
      "[a](/nope) [b](/blog/missing) [c](/blog/early-pregnancy-symptoms) [d](javascript:x) [e](/blog/other) [f](/services#service-1)",
      ["other"],
      "early-pregnancy-symptoms",
    );
    assert.equal(problems.length, 4, problems.join("\n"));
  });
  it("finds every link, nested in lists and bold", () => {
    assert.deepEqual(
      articleLinks("- **[x](/book)**\n\n> see [y](https://a.example)").map((link) => link.href),
      ["/book", "https://a.example"],
    );
  });
});

describe("internal-link suggestions", () => {
  const targets: LinkTarget[] = [
    { href: "/services#service-4", title: "Prenatal Care", phrases: ["prenatal care"] },
    { href: "/services#service-2", title: "Ultrasound", phrases: ["ultrasound"] },
    { href: "/book", title: "Book", phrases: ["book an appointment"] },
    { href: "/about#provider-shah", title: "Dr. Hetal Shah", phrases: ["Dr. Shah"] },
  ];
  const body = "## Prenatal care basics\n\nGood prenatal care matters. Ask about an [ultrasound](/services#service-2).\n\nTo book an appointment, call. Dr. Shahrazad is not Dr. Shah.";

  it("suggests unlinked mentions, outside headings and existing links", () => {
    const suggestions = suggestLinks(body, targets, "/blog/self");
    assert.deepEqual(suggestions.map((item) => item.href), ["/services#service-4", "/book", "/about#provider-shah"]);
    const prenatal = suggestions[0];
    assert.equal(body.slice(prenatal.index, prenatal.index + prenatal.phrase.length), "prenatal care");
    assert.ok(prenatal.index > body.indexOf("\n"), "not the heading");
  });
  it("matches whole words only", () => {
    const doctor = suggestLinks(body, targets, "/blog/self").find((item) => item.href.includes("shah"));
    assert.equal(doctor?.index, body.lastIndexOf("Dr. Shah"));
  });
  it("adds the link in place and then stops suggesting it", () => {
    const [first] = suggestLinks(body, targets, "/blog/self");
    const linked = applyLinkSuggestion(body, first);
    assert.ok(linked.includes("Good [prenatal care](/services#service-4) matters"));
    assert.ok(!suggestLinks(linked, targets, "/blog/self").some((item) => item.href === first.href));
  });
  it("leaves the text alone if it moved", () => {
    const [first] = suggestLinks(body, targets, "/blog/self");
    assert.equal(applyLinkSuggestion(`x${body}`, first), `x${body}`);
  });
  it("never suggests the article itself", () => {
    assert.equal(suggestLinks("Read about prenatal care", targets, "/services#service-4").length, 0);
  });
});

describe("SEO and review readiness", () => {
  it("flags what is missing", () => {
    const failing = seoChecks(content()).filter((check) => !check.ok).length;
    assert.ok(failing >= 8);
  });
  it("passes a complete article", () => {
    const words = Array.from({ length: 320 }, () => "word").join(" ");
    const checks = seoChecks(
      content({
        seoTitle: "Early pregnancy symptoms: what to expect",
        description: "Early pregnancy symptoms explained by our OB-GYN team: what is normal, what is not, and when to call us for a visit.",
        focusKeyword: "early pregnancy symptoms",
        body: `Early pregnancy symptoms vary.\n\n## Common signs\n\n${words} [test](/services#service-1) [book](/book) [ACOG](https://www.acog.org)`,
        cover: "heroPregnancy",
      }),
    );
    assert.deepEqual(checks.filter((check) => !check.ok), []);
  });
  it("needs a description and enough words before review", () => {
    assert.equal(reviewProblems(content()).length, 2);
  });
});
