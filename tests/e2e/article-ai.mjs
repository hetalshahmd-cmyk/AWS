// The AI article writer: topics, "Generate with AI", the daily run, and that
// AI drafts go through the same doctor approval as any other article.
import { ObjectId } from "mongodb";
import { jar } from "./lib.mjs";

export async function run({ call, check, db, admin, doctor, fakeAi }) {
  // Read here, not at import: run.mjs sets it after loading the suites.
  const CRON = { authorization: `Bearer ${process.env.E2E_CRON_SECRET}` };
  console.log("\n# AI article writer");
  const bookingsBefore = await db.collection("bookings").countDocuments();
  const A = jar();
  await call(A, "POST", "/api/admin/session", admin);
  const D = jar();
  await call(D, "POST", "/api/admin/session", doctor);

  // Who can use it
  const closed = await Promise.all([
    call(jar(), "POST", "/api/admin/articles/generate", {}),
    call(jar(), "GET", "/api/admin/articles/topics"),
    call(jar(), "GET", "/api/admin/articles/automation"),
  ]);
  check("signed out: the AI writer is closed", closed.every((r) => r.status === 401));
  const doctorTries = await Promise.all([
    call(D, "POST", "/api/admin/articles/generate", {}),
    call(D, "GET", "/api/admin/articles/topics"),
    call(D, "PUT", "/api/admin/articles/automation", { enabled: true }),
  ]);
  check("a doctor can't generate, see topics or switch the daily run", doctorTries.every((r) => r.status === 403));

  // Topics
  const topics = (await call(A, "GET", "/api/admin/articles/topics")).data?.topics ?? [];
  check("starts with the topic list, all waiting", topics.length >= 30 && topics.every((t) => t.status === "queued"));
  check(
    "…covering Phoenix, Maryvale and Glendale",
    ["Phoenix", "Maryvale", "Glendale"].every((place) => topics.some((t) => t.location === place)),
  );
  check(
    "a topic that repeats one on the list is refused",
    (await call(A, "POST", "/api/admin/articles/topics", { title: "Pregnancy tests", focusKeyword: "pregnancy test: when to take", category: "pregnancy-testing" })).status === 400,
  );
  const added = await call(A, "POST", "/api/admin/articles/topics", {
    title: "What a 20-week anatomy scan checks",
    focusKeyword: "20 week anatomy scan",
    category: "ultrasound",
    location: "Glendale",
  });
  check("add a new topic", added.status === 201 && added.data.topic.status === "queued");
  const topic = added.data.topic;

  const automation = (await call(A, "GET", "/api/admin/articles/automation")).data;
  check("the writer is set up with the economical model, daily run off", automation.configured && automation.model === "claude-haiku-5-5" && automation.automation.enabled === false);

  // Generate with AI
  const asked = fakeAi.requests.length;
  const made = await call(A, "POST", "/api/admin/articles/generate", { topicId: topic.id, reviewerId: "denton" });
  const articleId = made.data?.article?.id;
  check("Generate with AI writes a draft and sends it for medical review", made.status === 201 && made.data.article.status === "in_review" && /Denton/.test(made.data.sentTo ?? ""), made.text.slice(0, 200));
  const request = fakeAi.requests[asked];
  check(
    "…one call to the economical model, asking for structured output",
    fakeAi.requests.length === asked + 1 &&
      request.body.model === "claude-haiku-5-5" &&
      request.body.output_config?.format?.type === "json_schema" &&
      /Medical safety/.test(request.body.system) &&
      // The SDK sends the key as x-api-key or (1.x) in Authorization.
      `${request.headers["x-api-key"] ?? ""} ${request.headers.authorization ?? ""}`.includes("e2e-fake-key"),
    JSON.stringify({ n: fakeAi.requests.length - asked, model: request?.body.model, format: request?.body.output_config?.format?.type, system: typeof request?.body.system }),
  );
  const patients = await db.collection("bookings").find({}, { projection: { "patient.email": 1 } }).toArray();
  check(
    "…sending no patient information",
    patients.length > 0 && patients.every((booking) => !request.raw.includes(booking.patient.email)),
  );

  const article = (await call(A, "GET", `/api/admin/articles/${articleId}`)).data.article;
  check("the draft is marked as written by AI", article.origin?.type === "ai" && article.origin.model === "claude-haiku-5-5");
  check(
    "…with SEO title, description, focus keyword and cover",
    article.seoTitle && article.description.length >= 50 && article.focusKeyword === "20 week anatomy scan" && article.cover === "heroUltrasound",
  );
  check(
    "…headings, when to call, FAQ and references",
    ["## What is", "## When to call your doctor", "## Frequently asked questions", "## References"].every((part) => article.body.includes(part)),
  );
  check(
    "…citing only checked sources, never a made-up one",
    article.body.includes("https://medlineplus.gov/pregnancy.html") && !article.body.includes("made-up.example"),
  );
  check("…with links to our services added", article.body.includes("](/services#service-4)") && article.body.includes("](/book)"));
  check("…and a history entry saying it is an AI draft", article.history[0]?.note?.includes("AI draft"));

  const used = (await call(A, "GET", "/api/admin/articles/topics")).data.topics.find((t) => t.id === topic.id);
  check("the topic is marked written, with its article", used.status === "used" && used.articleId === articleId);
  const log = await db.collection("article_generations").findOne({ articleId });
  check("the run is logged with its tokens and cost", log?.status === "ok" && log.inputTokens === 6000 && log.costUsd > 0 && log.costUsd < 0.01);
  check("the same topic can't be written twice", (await call(A, "POST", "/api/admin/articles/generate", { topicId: topic.id })).status === 400);
  check(
    "a typed-in topic that repeats an article is refused before any AI call",
    (await call(A, "POST", "/api/admin/articles/generate", { customTopic: { title: "Anatomy scans", focusKeyword: "anatomy scan 20 week", category: "ultrasound" } })).status === 400 &&
      fakeAi.requests.length === asked + 1,
  );

  // The doctor's queue
  const queue = await call(D, "GET", "/admin/doctor/reviews");
  check("the draft is in the doctor's review queue", queue.text.includes("A guide to 20 week anatomy scan"));
  check("…and the review page warns it was written with AI", (await call(D, "GET", `/admin/doctor/reviews/${articleId}`)).text.includes("Written with AI"));
  check("it can't be published before the doctor approves", (await call(A, "POST", `/api/admin/articles/${articleId}/workflow`, { action: "publish", hash: article.hash })).status === 400);

  // Approved and published, it gets FAQ structured data
  await call(D, "POST", `/api/admin/articles/${articleId}/workflow`, { action: "approve", hash: article.hash, confirm: true });
  const published = await call(A, "POST", `/api/admin/articles/${articleId}/workflow`, { action: "publish", hash: article.hash });
  const page = await call(null, "GET", `/blog/${article.slug}`);
  check("after approval and an admin's publish it is public, with FAQ structured data", published.status === 200 && page.status === 200 && page.text.includes('"@type":"FAQPage"'));
  await call(A, "POST", `/api/admin/articles/${articleId}/workflow`, { action: "unpublish", hash: article.hash });

  // A failed run
  const failing = (await call(A, "POST", "/api/admin/articles/topics", { title: "Failure test", focusKeyword: "failcase ovarian torsion", category: "gynecology" })).data.topic;
  const articlesBefore = await db.collection("articles").countDocuments();
  const failed = await call(A, "POST", "/api/admin/articles/generate", { topicId: failing.id });
  const failedTopic = (await call(A, "GET", "/api/admin/articles/topics")).data.topics.find((t) => t.id === failing.id);
  check(
    "when the AI fails: an error, no article, and the topic goes back in the queue",
    failed.status === 502 && (await db.collection("articles").countDocuments()) === articlesBefore && failedTopic.status === "queued" && failedTopic.attempts === 1 && failedTopic.lastError,
  );
  await call(A, "DELETE", `/api/admin/articles/topics/${failing.id}`);

  // The daily run
  check("the daily run needs the scheduler's secret", (await call(null, "GET", "/api/cron/articles")).status === 401);
  const off = await call(null, "GET", "/api/cron/articles", undefined, CRON);
  check("…and does nothing while switched off", off.status === 200 && off.data.done === false && /off/.test(off.data.reason));
  check("the daily reviewer must be a doctor with a sign-in", (await call(A, "PUT", "/api/admin/articles/automation", { enabled: true, reviewerId: "nobody" })).status === 400);
  const on = await call(A, "PUT", "/api/admin/articles/automation", { enabled: true, reviewerId: "denton" });
  check("switch daily drafts on", on.status === 200 && on.data.automation.enabled && on.data.automation.reviewerId === "denton");
  const daily = await call(null, "GET", "/api/cron/articles", undefined, CRON);
  check("the daily run writes the next topic and sends it for review", daily.data?.done === true && /Denton/.test(daily.data.sentTo ?? ""), daily.text.slice(0, 200));
  const again = await call(null, "GET", "/api/cron/articles", undefined, CRON);
  check("…only once a day, however often it is called", again.data?.done === false && /Already ran/.test(again.data.reason));
  const dailyArticle = await db.collection("articles").findOne({ _id: new ObjectId(daily.data.articleId) });
  check(
    "…recorded as the daily writer, not public",
    dailyArticle?.history?.[0]?.by === "AI article writer (daily)" && dailyArticle.status === "in_review" && dailyArticle.live === null,
  );
  await call(A, "PUT", "/api/admin/articles/automation", { enabled: false, reviewerId: "denton" });

  const list = await call(A, "GET", "/admin/articles");
  check("Admin → Articles shows the AI writer and AI drafts", list.text.includes("AI article writer") && list.text.includes("AI draft") && list.text.includes("Generate article with AI"));
  check("Admin → Articles → Topics opens", (await call(A, "GET", "/admin/articles/topics")).text.includes("Article topics"));
  check("bookings weren't touched", (await db.collection("bookings").countDocuments()) === bookingsBefore);
}
