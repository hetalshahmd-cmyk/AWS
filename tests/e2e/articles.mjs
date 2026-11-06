// Admin → Articles, the doctor's medical review, and the public blog.
import { jar } from "./lib.mjs";

const filler = Array.from(
  { length: 30 },
  (_, i) => `Sentence ${i + 1} explains what many people notice in the first weeks of pregnancy.`,
).join(" ");

const TITLE = 'Early signs </script><script>alert("t")</script> of pregnancy';
const BODY = [
  "Early pregnancy symptoms differ from person to person, and prenatal care can start early.",
  "## What you may notice",
  filler,
  '<script>alert("x")</script>',
  '<img src=x onerror="alert(1)">',
  "- Tiredness\n- **Nausea** in the morning",
  "Read what [ACOG says](https://www.acog.org/womens-health/faqs) and [book a visit](/book).",
].join("\n\n");

export async function run({ call, check, db, admin, doctor }) {
  console.log("\n# Articles & medical review");
  const bookingsBefore = await db.collection("bookings").countDocuments();
  const A = jar();
  await call(A, "POST", "/api/admin/session", admin);
  const D = jar(); // Julie Denton — the reviewer
  await call(D, "POST", "/api/admin/session", doctor);
  const T = jar(); // Kylee Tate — another doctor
  await call(T, "POST", "/api/admin/session", { email: "tate@arizonawomen.com", password: doctor.password });

  // Who can get in
  check(
    "signed out: articles are closed",
    (await call(jar(), "GET", "/api/admin/articles")).status === 401 &&
      (await call(jar(), "POST", "/api/admin/articles/0123456789abcdef01234567/workflow", { action: "approve" })).status === 401,
  );
  check(
    "a doctor can't list, write or create articles",
    (await call(D, "GET", "/api/admin/articles")).status === 403 && (await call(D, "POST", "/api/admin/articles", { title: "x" })).status === 403,
  );
  check("the admin page opens", (await call(A, "GET", "/admin/articles")).text.includes("Articles"));
  check("nothing published: /blog doesn't exist yet", (await call(null, "GET", "/blog")).status === 404);
  check("…and the sitemap has no blog", !(await call(null, "GET", "/sitemap.xml")).text.includes("/blog"));
  const menu = (text) => [...text.matchAll(/<nav aria-label="Primary"[\s\S]*?<\/nav>/g)].flatMap((m) => [...m[0].matchAll(/href="([^"]+)"/g)].map((h) => h[1]));
  const homeMenu = menu((await call(null, "GET", "/")).text);
  check(
    "the menu reads Home, Providers, Services, Self Pay, Insurance, Contact — no Blog yet",
    homeMenu.join(" ") === "/ /about /services /self-pay /insurance /contact",
    homeMenu.join(" "),
  );

  // Writing
  const bad = await Promise.all([
    call(A, "POST", "/api/admin/articles", { title: "Bad link", body: "[x](javascript:alert(1))" }),
    call(A, "POST", "/api/admin/articles", { title: "Missing page", body: "[x](/no-such-page)" }),
    call(A, "POST", "/api/admin/articles", { title: "Missing article", body: "[x](/blog/does-not-exist)" }),
    call(A, "POST", "/api/admin/articles", { title: "Bad address", slug: "../../admin" }),
    call(A, "POST", "/api/admin/articles", { title: "" }),
  ]);
  check("bad links, addresses and empty titles are refused", bad.every((r) => r.status === 400), bad.map((r) => r.status).join(","));

  const created = await call(A, "POST", "/api/admin/articles", {
    title: TITLE,
    slug: "early-signs-of-pregnancy",
    description: "Early signs of pregnancy explained by our OB-GYN team, and when it is time to come in for a visit.",
    focusKeyword: "early pregnancy symptoms",
    body: BODY,
    cover: "heroPregnancy",
  });
  let article = created.data?.article;
  check("create a draft", created.status === 201 && article?.status === "draft" && article.history[0]?.action === "created");
  check(
    "the same address can't be used twice",
    (await call(A, "POST", "/api/admin/articles", { title: "Copy", slug: "early-signs-of-pregnancy" })).status === 400,
  );
  const short = (await call(A, "POST", "/api/admin/articles", { title: "Too short", body: "Only a few words." })).data.article;
  check(
    "a too-short article can't go to review",
    (await call(A, "POST", `/api/admin/articles/${short.id}/workflow`, { action: "submit", hash: short.hash, reviewerId: "denton" })).status === 400,
  );
  check(
    "it can only be sent to a doctor with a sign-in",
    (await call(A, "POST", `/api/admin/articles/${article.id}/workflow`, { action: "submit", hash: article.hash, reviewerId: "cook" })).status === 400,
  );

  // Review
  const flow = (j, action, extra = {}) =>
    call(j, "POST", `/api/admin/articles/${article.id}/workflow`, { action, hash: article.hash, ...extra });
  const submitted = await flow(A, "submit", { reviewerId: "denton" });
  article = submitted.data?.article ?? article;
  check("send for medical review", submitted.status === 200 && article.status === "in_review" && article.reviewerId === "denton");
  check("…it shows on her review list", (await call(D, "GET", "/admin/doctor/reviews")).text.includes("Early signs"));
  check(
    "…not on another doctor's, who can't open it",
    !(await call(T, "GET", "/admin/doctor/reviews")).text.includes("Early signs") &&
      (await call(T, "GET", `/admin/doctor/reviews/${article.id}`)).status === 404,
  );
  check("an admin can't approve", (await flow(A, "approve", { confirm: true })).status === 403);
  check("another doctor can't approve", (await flow(T, "approve", { confirm: true })).status === 403);
  check("a doctor can't publish", (await flow(D, "publish")).status === 403);
  check(
    "approving text that changed since it was opened is refused",
    (await flow(D, "approve", { confirm: true, hash: "0".repeat(64) })).status === 409,
  );
  check("approval needs the accuracy confirmation", (await flow(D, "approve")).status === 400);
  const approved = await flow(D, "approve", { confirm: true });
  article = (await call(A, "GET", `/api/admin/articles/${article.id}`)).data.article;
  check(
    "the doctor approves",
    approved.status === 200 && article.status === "approved" && article.approval?.providerId === "denton" && article.approval.hash === article.hash,
  );

  // Any change voids the approval
  const save = (changes, version = article.version) =>
    call(A, "PUT", `/api/admin/articles/${article.id}`, { ...article, ...changes, version });
  const edited = await save({ body: `${BODY}\n\nOne more sentence.` });
  check(
    "editing approved text sends it back to draft and clears the approval",
    edited.status === 200 && edited.data.article.status === "draft" && edited.data.article.approval === null,
  );
  check(
    "…the history says why",
    edited.data.article.history.some((item) => item.action === "returned_to_draft" && /Julie Denton/.test(item.note ?? "")),
  );
  check("a save from an out-of-date editor is refused", (await save({ title: "Stale" }, article.version)).status === 409);
  article = edited.data.article;
  check("unapproved text can't be published", (await flow(A, "publish")).status === 400);

  // Changes requested, then approved again
  article = (await flow(A, "submit", { reviewerId: "denton" })).data.article;
  check("asking for changes needs a note", (await flow(D, "request_changes", { note: "" })).status === 400);
  await flow(D, "request_changes", { note: "Add when to call the office about bleeding." });
  article = (await call(A, "GET", `/api/admin/articles/${article.id}`)).data.article;
  check("the doctor asks for changes", article.status === "changes_requested" && article.reviewNote.includes("bleeding"));
  article = (await save({ body: `${BODY}\n\n> Call us right away about heavy bleeding or severe pain.` })).data.article;
  article = (await flow(A, "submit", { reviewerId: "denton" })).data.article;
  await flow(D, "approve", { confirm: true });
  article = (await call(A, "GET", `/api/admin/articles/${article.id}`)).data.article;
  check("…and approves the new version", article.status === "approved");

  // Publish
  const published = await flow(A, "publish");
  article = published.data?.article ?? article;
  check("publish", published.status === 200 && article.live?.hash === article.hash);
  const list = await call(null, "GET", "/blog");
  check("/blog lists it", list.status === 200 && list.text.includes("early-signs-of-pregnancy"));
  const withBlog = menu((await call(null, "GET", "/services")).text);
  check("…and Blog appears in the menu, before Contact", withBlog.join(" ") === "/ /about /services /self-pay /insurance /blog /contact", withBlog.join(" "));
  check("…and in the footer", (await call(null, "GET", "/contact")).text.split("<footer")[1]?.includes('href="/blog"'));
  const page = await call(null, "GET", "/blog/early-signs-of-pregnancy");
  check("the article page opens", page.status === 200 && page.text.includes("heavy bleeding"));
  check("…shows who reviewed it", page.text.replace(/<!-- -->/g, "").includes("Medically reviewed by"));
  check(
    "…with SEO metadata",
    page.text.includes('rel="canonical" href="https://') &&
      page.text.includes("/blog/early-signs-of-pregnancy") &&
      page.text.includes('property="og:type" content="article"') &&
      page.text.includes('"@type":"MedicalWebPage"'),
  );
  check(
    "typed HTML and a title with </script> stay harmless",
    !page.text.includes('<script>alert("x")') &&
      !page.text.includes('<script>alert("t")') &&
      !page.text.includes("<img src=x") &&
      page.text.includes("&lt;script&gt;"),
  );
  check(
    "outside sources open in a new tab",
    /href="https:\/\/www\.acog\.org\/womens-health\/faqs" target="_blank" rel="noopener noreferrer"/.test(page.text),
  );
  check("drafts aren't public", (await call(null, "GET", `/blog/${short.slug}`)).status === 404);
  const sitemap = await call(null, "GET", "/sitemap.xml");
  check("the sitemap lists the article", sitemap.text.includes("/blog/early-signs-of-pregnancy") && !sitemap.text.includes(short.slug));
  check("robots.txt points to the sitemap", (await call(null, "GET", "/robots.txt")).text.includes("Sitemap:"));

  // Editing a live article never puts unreviewed words online
  const liveEdit = await save({ body: `${BODY}\n\nUNREVIEWED SENTENCE` });
  article = liveEdit.data.article;
  check(
    "editing a live article keeps the approved version on the site",
    liveEdit.status === 200 && !(await call(null, "GET", "/blog/early-signs-of-pregnancy")).text.includes("UNREVIEWED SENTENCE"),
  );
  check("a public article's address can't change", (await save({ slug: "new-address" })).status === 400);
  check("a live article can't be deleted", (await call(A, "DELETE", `/api/admin/articles/${article.id}`)).status === 409);
  const off = await flow(A, "unpublish");
  check("take it off the site", off.status === 200 && (await call(null, "GET", "/blog/early-signs-of-pregnancy")).status === 404);

  // The audit trail
  const doc = await db.collection("articles").findOne({ slug: "early-signs-of-pregnancy" });
  const actions = doc.history.map((item) => item.action);
  check(
    "every step is in the history, with who did it",
    ["created", "submitted", "approved", "edited", "returned_to_draft", "changes_requested", "published", "unpublished"].every((a) =>
      actions.includes(a),
    ) && doc.history.every((item) => item.by && item.staffId && item.at),
  );
  check("…and the history isn't sent to doctors", !("article" in approved.data));

  check("delete", (await call(A, "DELETE", `/api/admin/articles/${article.id}`)).status === 200);
  await call(A, "DELETE", `/api/admin/articles/${short.id}`);
  check("bookings weren't touched", (await db.collection("bookings").countDocuments()) === bookingsBefore);
}
