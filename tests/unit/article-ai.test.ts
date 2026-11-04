/**
 * Unit tests for the AI article writer's pure parts: topics and duplicates,
 * the answer check, turning an answer into a safe article, and costs.
 * No network, no database:  npm test
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assembleArticle,
  cleanModelText,
  cleanTopicInput,
  DEFAULT_TOPICS,
  estimateCost,
  findDuplicate,
  OUTPUT_SCHEMA,
  parseWriterOutput,
  similarity,
  topicKey,
  userPrompt,
  type WriterOutput,
} from "@/lib/article-ai";
import { REFERENCES } from "@/lib/article-references";
import { articleLinks, classifyHref, extractFaqs, linkProblems, reviewProblems, type LinkTarget } from "@/lib/articles";

const TARGETS: LinkTarget[] = [
  { href: "/services#service-2", title: "Ultrasound", phrases: ["ultrasound"] },
  { href: "/services#service-4", title: "Prenatal Care", phrases: ["prenatal care"] },
  { href: "/book", title: "Book an appointment", phrases: ["book an appointment"] },
  { href: "/contact", title: "Our offices", phrases: ["Glendale office"] },
];
const TOPIC = { title: "Your first pregnancy ultrasound", focusKeyword: "first pregnancy ultrasound", category: "ultrasound" as const, location: "Glendale" as const, notes: "" };
const paragraph = (n: number) => Array.from({ length: n }, (_, i) => `Sentence ${i + 1} about what happens at a first pregnancy ultrasound.`).join(" ");

const ANSWER: WriterOutput = {
  title: "Your first pregnancy ultrasound: what to expect",
  seoTitle: "First Pregnancy Ultrasound: What to Expect | Glendale OB-GYN",
  description: "What happens at your first pregnancy ultrasound, when it is done, and how to prepare — from our OB-GYN team serving Glendale and Phoenix.",
  slug: "First Pregnancy Ultrasound!",
  intro: `Your first pregnancy ultrasound usually happens early. ${paragraph(6)}`,
  sections: [
    { heading: "## When is it done?", body: `${paragraph(8)} Ask about [prenatal care](/services#service-4).` },
    { heading: "What you will see", body: `${paragraph(8)} See [this study](https://made-up.example/study) and [our secret page](/secret).` },
    { heading: "How to prepare", body: `- Drink water\n- Bring your questions\n\nYou can book an appointment online. ${paragraph(4)}` },
  ],
  whenToCall: "- Heavy bleeding\n- Severe belly pain — call 911",
  faqs: [
    { question: "Does an ultrasound hurt?", answer: "No. It may feel a little cold." },
    { question: "Can I bring someone?", answer: "Usually yes." },
  ],
  referenceIds: ["medline-ultrasound", "owh-prenatal-tests", "medline-ultrasound", "not-a-real-id"],
};

describe("topics", () => {
  it("treats word order, small words and plurals as the same topic", () => {
    assert.equal(topicKey("When to take a pregnancy test"), topicKey("pregnancy tests: when to take"));
    assert.equal(similarity("prenatal care glendale az", "glendale prenatal care"), 0.75);
  });
  it("finds duplicates of topics and articles", () => {
    const existing = [
      { label: "the article A", phrase: "first trimester symptoms" },
      { label: "the topic B", phrase: "pap smear" },
    ];
    assert.equal(findDuplicate("symptoms of the first trimester", existing), "the article A");
    assert.equal(findDuplicate("Pap smears", existing), "the topic B");
    assert.equal(findDuplicate("iud insertion", existing), null);
  });
  it("the starting list has no duplicates and covers every requested area", () => {
    for (let i = 0; i < DEFAULT_TOPICS.length; i += 1) {
      const others = DEFAULT_TOPICS.filter((_, j) => j !== i).map((topic) => ({ label: topic.title, phrase: topic.focusKeyword }));
      assert.equal(findDuplicate(DEFAULT_TOPICS[i].focusKeyword, others), null, DEFAULT_TOPICS[i].title);
    }
    const places = new Set(DEFAULT_TOPICS.map((topic) => topic.location));
    for (const place of ["Phoenix", "Maryvale", "Glendale"]) assert.ok(places.has(place as never), place);
    const categories = new Set(DEFAULT_TOPICS.map((topic) => topic.category));
    for (const category of ["pregnancy-testing", "ultrasound", "prenatal-care", "gynecology"]) assert.ok(categories.has(category as never));
  });
  it("validates a new topic", () => {
    assert.throws(() => cleanTopicInput({ title: "", focusKeyword: "x", category: "ultrasound" }), /Topic/);
    assert.throws(() => cleanTopicInput({ title: "A", focusKeyword: "the of and", category: "ultrasound" }), /real words/);
    assert.throws(() => cleanTopicInput({ title: "A", focusKeyword: "iud", category: "cooking" }), /category/);
    assert.equal(cleanTopicInput({ title: "A", focusKeyword: "iud", category: "birth-control", location: "Mars" }).location, null);
  });
});

describe("references", () => {
  it("are https, unique, and the only ids the model may choose", () => {
    const ids = REFERENCES.map((reference) => reference.id);
    assert.equal(new Set(ids).size, ids.length);
    assert.ok(REFERENCES.every((reference) => classifyHref(reference.url) === "external"));
    assert.deepEqual(OUTPUT_SCHEMA.properties.referenceIds.items.enum, ids);
  });
});

describe("the model's answer", () => {
  it("is checked for shape", () => {
    assert.throws(() => parseWriterOutput("not json"), /valid JSON/);
    assert.throws(() => parseWriterOutput(JSON.stringify({ ...ANSWER, title: "" })), /title/);
    assert.throws(() => parseWriterOutput(JSON.stringify({ ...ANSWER, sections: [ANSWER.sections[0]] })), /too few sections/);
    assert.equal(parseWriterOutput(JSON.stringify(ANSWER)).sections.length, 3);
  });
  it("loses any web address the model typed, and links to pages that don't exist", () => {
    const clean = cleanModelText("See [a study](https://made-up.example/x), [bad](javascript:x), [ok](/book) and [gone](/blog/nope).", []);
    assert.equal(clean, "See a study, bad, [ok](/book) and gone.");
  });
  it("never lets the model add a top-level heading", () => {
    assert.equal(cleanModelText("# Big\n## Medium\nText", []), "### Big\n### Medium\nText");
  });
});

describe("assembling the article", () => {
  const content = assembleArticle(ANSWER, { topic: TOPIC, targets: TARGETS, articleSlugs: [], takenSlugs: ["first-pregnancy-ultrasound"] });
  const links = articleLinks(content.body);

  it("uses the topic's keyword, a free address and the topic's cover", () => {
    assert.equal(content.focusKeyword, "first pregnancy ultrasound");
    assert.equal(content.slug, "first-pregnancy-ultrasound-2");
    assert.equal(content.cover, "heroUltrasound");
    assert.ok(content.seoTitle.length <= 70 && content.description.length <= 170);
  });
  it("has the fixed sections: when to call, FAQ and references", () => {
    for (const heading of ["## When is it done?", "## When to call your doctor", "## Frequently asked questions", "## References"]) {
      assert.ok(content.body.includes(heading), heading);
    }
    assert.ok(!content.body.includes("## ## "));
    assert.deepEqual(extractFaqs(content.body).map((faq) => faq.question), ["Does an ultrasound hurt?", "Can I bring someone?"]);
  });
  it("cites only checked sources, each once", () => {
    const external = links.filter((link) => classifyHref(link.href) === "external").map((link) => link.href);
    assert.deepEqual(external, [
      "https://medlineplus.gov/ultrasound.html",
      "https://womenshealth.gov/pregnancy/youre-pregnant-now-what/prenatal-care-and-tests",
    ]);
  });
  it("links to our pages, with every link valid", () => {
    const internal = links.filter((link) => classifyHref(link.href) === "internal").map((link) => link.href);
    assert.ok(internal.includes("/services#service-4"));
    assert.ok(internal.includes("/book"), "added from a suggestion");
    assert.ok(internal.length <= 4);
    assert.deepEqual(linkProblems(content.body, [], content.slug), []);
  });
  it("is ready for a doctor's review", () => assert.deepEqual(reviewProblems(content), []));
});

describe("the prompt", () => {
  it("names the topic, place, links, existing articles and every reference", () => {
    const prompt = userPrompt({
      topic: TOPIC,
      practiceName: "Arizona Women Specialists",
      offices: [{ name: "Maryvale", area: "Maryvale", city: "Phoenix, AZ" }],
      services: [{ title: "Ultrasound", body: "Same-day ultrasounds." }],
      targets: TARGETS,
      existing: [{ title: "Early pregnancy symptoms", focusKeyword: "first trimester symptoms" }],
    });
    for (const part of ["first pregnancy ultrasound", "Glendale, Arizona", "/services#service-2", "Early pregnancy symptoms", ...REFERENCES.map((r) => r.id)]) {
      assert.ok(prompt.includes(part), part);
    }
    assert.ok(!prompt.includes("https://"), "no web addresses for the model to copy");
  });
});

describe("cost", () => {
  it("prices the economical default model", () => {
    assert.equal(estimateCost("claude-haiku-5-5", 1_000_000, 0), 0.1);
    assert.ok(Math.abs((estimateCost("claude-haiku-5-5", 6000, 5000) ?? 0) - 0.0031) < 1e-9);
    assert.equal(estimateCost("unknown-model", 1, 1), null);
  });
});
