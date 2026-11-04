/**
 * The AI article writer, minus the network and the database: topics and
 * duplicate checks, the instructions, the answer's shape, and turning the
 * answer into an article. lib/article-writer.ts does the calling and saving.
 *
 * The model writes words only. Code decides the structure (headings, FAQ,
 * "when to call", references), the sources (picked by id from a checked list,
 * never a typed address), the links (only real site pages survive) and the
 * cover — and every draft still goes to a doctor before anyone can publish it.
 */
import { REFERENCES, referenceById } from "./article-references";
import {
  applyLinkSuggestion,
  articleLinks,
  classifyHref,
  linkProblems,
  LIMITS,
  slugify,
  suggestLinks,
  type ArticleContent,
  type LinkTarget,
} from "./articles";
import type { PhotoKey } from "./photos";

/* ---------------------------------------------------------------- topics -- */

export const TOPIC_CATEGORIES = {
  "pregnancy-testing": "Pregnancy testing",
  ultrasound: "Ultrasound",
  "prenatal-care": "Prenatal care",
  "early-pregnancy": "Early pregnancy",
  gynecology: "Gynecology",
  "birth-control": "Birth control",
  coverage: "Insurance & support",
} as const;

export type TopicCategory = keyof typeof TOPIC_CATEGORIES;

export const TOPIC_LOCATIONS = ["Phoenix", "Maryvale", "Glendale"] as const;
export type TopicLocation = (typeof TOPIC_LOCATIONS)[number];

export type TopicStatus = "queued" | "generating" | "used" | "skipped";

export type TopicInput = {
  title: string;
  focusKeyword: string;
  category: TopicCategory;
  location: TopicLocation | null;
  notes: string;
};

export type Topic = TopicInput & {
  id: string;
  status: TopicStatus;
  attempts: number;
  lastError: string | null;
  articleId: string | null;
  createdAt: string;
  usedAt: string | null;
};

export class TopicError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TopicError";
  }
}

const STOP_WORDS = new Set(
  "a an and are at can do does for from how i in is it my of on or should the to what when where which who why with you your vs versus".split(" "),
);

/** The words that make two topics the same topic, in a stable order. */
export function topicWords(text: string): string[] {
  const words = text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word && !STOP_WORDS.has(word))
    // "tests"/"test", "ultrasounds"/"ultrasound" count as the same word.
    .map((word) => (word.length > 4 && word.endsWith("s") && !word.endsWith("ss") ? word.slice(0, -1) : word));
  return [...new Set(words)].sort();
}

export const topicKey = (focusKeyword: string) => topicWords(focusKeyword).join(" ");

/** How alike two phrases are, 0–1 (shared words over all words). */
export function similarity(a: string, b: string): number {
  const left = new Set(topicWords(a));
  const right = new Set(topicWords(b));
  if (!left.size || !right.size) return 0;
  let shared = 0;
  for (const word of left) if (right.has(word)) shared += 1;
  return shared / (left.size + right.size - shared);
}

export const DUPLICATE_SIMILARITY = 0.75;

/** The first existing phrase that is the same topic as `focusKeyword`, if any. */
export function findDuplicate(focusKeyword: string, existing: { label: string; phrase: string }[]): string | null {
  const key = topicKey(focusKeyword);
  for (const item of existing) {
    if (!item.phrase) continue;
    if (topicKey(item.phrase) === key || similarity(focusKeyword, item.phrase) >= DUPLICATE_SIMILARITY) return item.label;
  }
  return null;
}

export function cleanTopicInput(input: unknown): TopicInput {
  const body = (input ?? {}) as Record<string, unknown>;
  const text = (value: unknown, field: string, max: number, required: boolean) => {
    const clean = typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
    if (required && !clean) throw new TopicError(`${field} can't be empty`);
    if (clean.length > max) throw new TopicError(`${field} is too long (${max} characters max)`);
    return clean;
  };
  const title = text(body.title, "Topic", 140, true);
  const focusKeyword = text(body.focusKeyword, "Focus keyword", LIMITS.focusKeyword, true);
  if (topicWords(focusKeyword).length === 0) throw new TopicError("The focus keyword needs real words");
  if (typeof body.category !== "string" || !(body.category in TOPIC_CATEGORIES)) throw new TopicError("Choose a category");
  const location = TOPIC_LOCATIONS.find((place) => place === body.location) ?? null;
  return { title, focusKeyword, category: body.category as TopicCategory, location, notes: text(body.notes, "Notes", 400, false) };
}

/**
 * The starting list: what people around the practice search for. Admins add,
 * skip and remove topics in Admin → Articles → Topics.
 */
export const DEFAULT_TOPICS: Omit<TopicInput, "notes">[] = [
  { title: "When to take a pregnancy test for the most accurate result", focusKeyword: "when to take a pregnancy test", category: "pregnancy-testing", location: null },
  { title: "Free pregnancy testing in Phoenix: what happens at a walk-in visit", focusKeyword: "free pregnancy test phoenix", category: "pregnancy-testing", location: "Phoenix" },
  { title: "Home pregnancy test or clinic test: which should you trust?", focusKeyword: "home pregnancy test vs clinic test", category: "pregnancy-testing", location: null },
  { title: "Positive pregnancy test? Your next steps in Glendale", focusKeyword: "positive pregnancy test next steps glendale", category: "pregnancy-testing", location: "Glendale" },
  { title: "What a faint line on a pregnancy test means", focusKeyword: "faint line pregnancy test", category: "pregnancy-testing", location: null },
  { title: "Your first pregnancy ultrasound: when it happens and what you'll see", focusKeyword: "first pregnancy ultrasound", category: "ultrasound", location: null },
  { title: "Dating ultrasound: how doctors work out how far along you are", focusKeyword: "dating ultrasound", category: "ultrasound", location: null },
  { title: "Walk-in pregnancy ultrasound in Maryvale: what to know before you come", focusKeyword: "pregnancy ultrasound maryvale", category: "ultrasound", location: "Maryvale" },
  { title: "Transvaginal vs. abdominal ultrasound in early pregnancy", focusKeyword: "transvaginal vs abdominal ultrasound", category: "ultrasound", location: null },
  { title: "Your first prenatal appointment: a simple checklist", focusKeyword: "first prenatal appointment", category: "prenatal-care", location: null },
  { title: "How often you'll see your OB-GYN during pregnancy", focusKeyword: "prenatal visit schedule", category: "prenatal-care", location: null },
  { title: "Prenatal care in Glendale, AZ: getting started", focusKeyword: "prenatal care glendale az", category: "prenatal-care", location: "Glendale" },
  { title: "Prenatal care in Phoenix: what every visit covers", focusKeyword: "prenatal care phoenix", category: "prenatal-care", location: "Phoenix" },
  { title: "Prenatal vitamins and folic acid: what to take and when", focusKeyword: "prenatal vitamins folic acid", category: "prenatal-care", location: null },
  { title: "Eating well during pregnancy", focusKeyword: "pregnancy nutrition", category: "prenatal-care", location: null },
  { title: "High blood pressure in pregnancy: signs to watch for", focusKeyword: "high blood pressure in pregnancy", category: "prenatal-care", location: null },
  { title: "Prenatal screening tests explained", focusKeyword: "prenatal screening tests", category: "prenatal-care", location: null },
  { title: "Pregnancy warning signs: when to call your doctor", focusKeyword: "pregnancy warning signs", category: "prenatal-care", location: null },
  { title: "First-trimester symptoms and how to feel better", focusKeyword: "first trimester symptoms", category: "early-pregnancy", location: null },
  { title: "Morning sickness: what helps and when to get care", focusKeyword: "morning sickness relief", category: "early-pregnancy", location: null },
  { title: "Bleeding in early pregnancy: what it can mean", focusKeyword: "bleeding in early pregnancy", category: "early-pregnancy", location: null },
  { title: "Ectopic pregnancy: warning signs everyone should know", focusKeyword: "ectopic pregnancy symptoms", category: "early-pregnancy", location: null },
  { title: "Teen pregnancy: confidential care and support", focusKeyword: "teen pregnancy support", category: "early-pregnancy", location: null },
  { title: "When to get a Pap smear and what to expect", focusKeyword: "pap smear", category: "gynecology", location: null },
  { title: "Irregular periods: when to see a gynecologist", focusKeyword: "irregular periods", category: "gynecology", location: null },
  { title: "Ovarian cysts: symptoms and when to get checked", focusKeyword: "ovarian cyst symptoms", category: "gynecology", location: null },
  { title: "Uterine fibroids: signs and next steps", focusKeyword: "uterine fibroids symptoms", category: "gynecology", location: null },
  { title: "PCOS: common signs and how it's diagnosed", focusKeyword: "pcos symptoms", category: "gynecology", location: null },
  { title: "Yeast infection or bacterial vaginosis? Telling them apart", focusKeyword: "yeast infection vs bacterial vaginosis", category: "gynecology", location: null },
  { title: "Finding a gynecologist in Maryvale", focusKeyword: "gynecologist maryvale", category: "gynecology", location: "Maryvale" },
  { title: "Choosing birth control that fits your life", focusKeyword: "choosing birth control", category: "birth-control", location: null },
  { title: "Getting an IUD: what happens at the appointment", focusKeyword: "iud insertion", category: "birth-control", location: null },
  { title: "The Depo shot: how the birth control injection works", focusKeyword: "depo shot birth control", category: "birth-control", location: null },
  { title: "Pregnant without insurance in Phoenix: self-pay prenatal care", focusKeyword: "pregnant without insurance phoenix", category: "coverage", location: "Phoenix" },
  { title: "Using AHCCCS and WIC during pregnancy", focusKeyword: "ahcccs wic pregnancy", category: "coverage", location: null },
];

/** A fitting picture from the library for each kind of topic. */
export const COVER_FOR: Record<TopicCategory, PhotoKey> = {
  "pregnancy-testing": "consultTablet",
  ultrasound: "heroUltrasound",
  "prenatal-care": "heroPregnancy",
  "early-pregnancy": "firstTrimester",
  gynecology: "heroConsultation",
  "birth-control": "clinicConsultWide",
  coverage: "bookingPhone",
};

/* ----------------------------------------------------- the instructions -- */

export type WriterContext = {
  topic: TopicInput;
  practiceName: string;
  offices: { name: string; area: string; city: string }[];
  services: { title: string; body: string }[];
  /** Site pages the article may link to. */
  targets: LinkTarget[];
  /** Articles that exist already, so this one doesn't repeat them. */
  existing: { title: string; focusKeyword: string }[];
};

export const SYSTEM_PROMPT = `You write patient-education articles for the website of a women's health and OB-GYN practice in the Phoenix area of Arizona. A doctor at the practice reviews every article before it is published.

Who reads them: people in Phoenix, Maryvale and Glendale searching for answers about pregnancy, pregnancy tests, ultrasound, prenatal care, gynecology and birth control. Many are anxious, some are teenagers, many read on a phone. Write warmly and plainly, at about an 8th-grade reading level, in short paragraphs. Explain any medical term the first time you use it.

Medical safety — these rules come before anything else:
- Give general information only. Never diagnose, never tell a reader what they have, and never give medicine names with doses.
- State only well-established, mainstream medical facts that the chosen references support. Do not make up statistics, studies, percentages or quotes. If you are not sure something is true, leave it out.
- Always say when to seek care, and say plainly that heavy bleeding, severe belly pain, fainting, or thoughts of harming yourself need emergency care (call 911).
- Never invent facts about the practice: no prices, hours, doctor names, insurance promises, waiting times or guarantees. Use only the practice facts given to you.
- No patient stories, testimonials or "our patients say".
- Do not write any web addresses. Cite sources only by choosing reference ids from the list provided.

Search: answer the question in the topic early and directly, use the focus keyword naturally in the first paragraph and in at least one heading, and use clear question-style headings where they fit. When the topic names a place, mention it naturally once or twice; never stuff place names.

Links: where it reads naturally, link to the practice's own pages using Markdown like [prenatal care](/services#service-4), using only the exact addresses provided. Two to four such links in the whole article is plenty.

Format each text field as simple Markdown: paragraphs separated by blank lines, "- " bullet lists, **bold** for a few key phrases. Do not use headings inside fields except "### " subheadings where a section really needs them.`;

export function userPrompt(context: WriterContext): string {
  const { topic } = context;
  const lines = [
    `Write an article on this topic: "${topic.title}"`,
    `Focus keyword: "${topic.focusKeyword}"`,
    topic.location ? `Place to mention: ${topic.location}, Arizona` : "No particular place — the practice serves Phoenix, Maryvale and Glendale.",
    topic.notes ? `Notes from the practice: ${topic.notes}` : "",
    "",
    `Practice facts you may use (nothing else): ${context.practiceName} is an OB-GYN and women's health practice with offices in ${context.offices.map((office) => `${office.area} (${office.city})`).join(" and ")}. Patients can book online at /book or walk in for a free pregnancy test. Services:`,
    ...context.services.map((service) => `- ${service.title}: ${service.body}`),
    "",
    "Pages you may link to (use these exact addresses):",
    ...context.targets.slice(0, 40).map((target) => `- ${target.href} — ${target.title}`),
    "",
    context.existing.length
      ? `Articles that already exist — do not repeat them; take a different angle:\n${context.existing.map((article) => `- ${article.title} (${article.focusKeyword})`).join("\n")}`
      : "No other articles exist yet.",
    "",
    "References you may cite (choose 2 to 5 that support what you wrote, by id):",
    ...REFERENCES.map((reference) => `- ${reference.id}: ${reference.title} — ${reference.publisher}`),
    "",
    "Length: 900 to 1,400 words across the intro and sections. 4 to 6 sections. 3 to 5 FAQs with short answers.",
  ];
  return lines.filter((line, index, all) => line !== "" || all[index - 1] !== "").join("\n");
}

/** The answer's shape, enforced by the API (structured outputs). */
export const OUTPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["title", "seoTitle", "description", "slug", "intro", "sections", "whenToCall", "faqs", "referenceIds"],
  properties: {
    title: { type: "string", description: "The article's heading, under 70 characters." },
    seoTitle: { type: "string", description: "The search-result title: 50 to 60 characters, includes the focus keyword." },
    description: { type: "string", description: "Meta description: 140 to 160 characters, includes the focus keyword." },
    slug: { type: "string", description: "Short lowercase web address words joined by dashes." },
    intro: { type: "string", description: "One or two opening paragraphs that answer the question directly." },
    sections: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["heading", "body"],
        properties: {
          heading: { type: "string" },
          body: { type: "string" },
        },
      },
    },
    whenToCall: { type: "string", description: "A short bullet list of when to call the doctor and when to call 911." },
    faqs: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["question", "answer"],
        properties: {
          question: { type: "string" },
          answer: { type: "string" },
        },
      },
    },
    referenceIds: { type: "array", items: { type: "string", enum: REFERENCES.map((reference) => reference.id) } },
  },
} as const;

export type WriterOutput = {
  title: string;
  seoTitle: string;
  description: string;
  slug: string;
  intro: string;
  sections: { heading: string; body: string }[];
  whenToCall: string;
  faqs: { question: string; answer: string }[];
  referenceIds: string[];
};

export class WriterError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WriterError";
  }
}

/** Checks the model's JSON really has the expected shape. */
export function parseWriterOutput(text: string): WriterOutput {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new WriterError("The AI's answer wasn't valid JSON");
  }
  const value = data as Record<string, unknown>;
  const str = (key: string) => {
    if (typeof value?.[key] !== "string" || !(value[key] as string).trim()) throw new WriterError(`The AI's answer has no ${key}`);
    return (value[key] as string).trim();
  };
  const list = <T>(key: string, map: (item: Record<string, unknown>) => T): T[] => {
    if (!Array.isArray(value?.[key])) throw new WriterError(`The AI's answer has no ${key}`);
    return (value[key] as Record<string, unknown>[]).map(map);
  };
  const out: WriterOutput = {
    title: str("title"),
    seoTitle: str("seoTitle"),
    description: str("description"),
    slug: str("slug"),
    intro: str("intro"),
    sections: list("sections", (item) => ({ heading: String(item?.heading ?? "").trim(), body: String(item?.body ?? "").trim() })).filter(
      (section) => section.heading && section.body,
    ),
    whenToCall: str("whenToCall"),
    faqs: list("faqs", (item) => ({ question: String(item?.question ?? "").trim(), answer: String(item?.answer ?? "").trim() })).filter(
      (faq) => faq.question && faq.answer,
    ),
    referenceIds: list("referenceIds", (item) => String(item)),
  };
  if (out.sections.length < 2) throw new WriterError("The AI's answer has too few sections");
  return out;
}

/* ------------------------------------------------- answer → article text -- */

/** Shortens to `max` characters at a word break. */
function clip(text: string, max: number): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max + 1);
  return cut.slice(0, Math.max(cut.lastIndexOf(" "), Math.floor(max * 0.6))).replace(/[\s,;:–-]+$/, "");
}

/**
 * Model text made safe for an article: no headings above ###, and every link
 * that isn't a real site page turned back into plain words (so no web address
 * the model typed survives — sources come only from the reference list).
 */
export function cleanModelText(text: string, articleSlugs: string[]): string {
  const withoutBigHeadings = text.replace(/^#{1,2}\s+/gm, "### ").replace(/^#{4,6}\s+/gm, "### ");
  const bad = new Set(
    articleLinks(withoutBigHeadings)
      .filter((link) => classifyHref(link.href) !== "internal" || linkProblems(`[x](${link.href})`, articleSlugs, "").length > 0)
      .map((link) => link.href),
  );
  if (!bad.size) return withoutBigHeadings.trim();
  return withoutBigHeadings
    .replace(/\[([^\]\n]*)\]\(([^)\s]*)\)/g, (match, label: string, href: string) => (bad.has(href) ? label : match))
    .trim();
}

export const MAX_AUTO_LINKS = 4;

/**
 * Builds the article from the model's answer. The headings for "when to call",
 * the FAQ and the references are fixed here, not written by the model.
 */
export function assembleArticle(
  output: WriterOutput,
  context: { topic: TopicInput; targets: LinkTarget[]; articleSlugs: string[]; takenSlugs: string[] },
): ArticleContent {
  const clean = (text: string) => cleanModelText(text, context.articleSlugs);
  const references = [...new Set(output.referenceIds)].map(referenceById).filter((reference) => reference !== null);

  const parts = [clean(output.intro)];
  for (const section of output.sections) {
    parts.push(`## ${clip(section.heading.replace(/^#+\s*/, ""), 90)}`, clean(section.body));
  }
  parts.push("## When to call your doctor", clean(output.whenToCall));
  if (output.faqs.length) {
    parts.push("## Frequently asked questions");
    for (const faq of output.faqs) parts.push(`### ${clip(faq.question.replace(/^#+\s*/, ""), 150)}`, clean(faq.answer));
  }
  if (references.length) {
    parts.push("## References", references.map((reference) => `- [${reference.title}](${reference.url}) — ${reference.publisher}`).join("\n"));
  }
  let body = parts.filter(Boolean).join("\n\n");

  // Internal links: add the best few the model didn't already make.
  let slug = slugify(output.slug) || slugify(output.title) || slugify(context.topic.focusKeyword);
  for (let n = 2; context.takenSlugs.includes(slug); n += 1) slug = `${slugify(output.slug || output.title).slice(0, 70)}-${n}`;
  // Applied last-first, so adding one link doesn't move the places of the others.
  const internal = articleLinks(body).filter((link) => classifyHref(link.href) === "internal").length;
  const picked = suggestLinks(body, context.targets, `/blog/${slug}`).slice(0, Math.max(0, MAX_AUTO_LINKS - internal));
  for (const suggestion of picked.sort((a, b) => b.index - a.index)) body = applyLinkSuggestion(body, suggestion);

  return {
    title: clip(output.title, LIMITS.title),
    slug,
    seoTitle: clip(output.seoTitle, LIMITS.seoTitle),
    description: clip(output.description, LIMITS.description),
    focusKeyword: context.topic.focusKeyword,
    body,
    cover: COVER_FOR[context.topic.category],
  };
}

/* ------------------------------------------------------------------ cost -- */

/** US dollars per million tokens (input, output) — from Anthropic's price list. */
export const MODEL_PRICES: Record<string, [number, number]> = {
  "claude-haiku-5-5": [0.1, 0.5],
  "claude-sonnet-5-5": [2, 10],
  "claude-opus-5-5": [4, 20],
};

export const DEFAULT_ARTICLE_MODEL = "claude-haiku-5-5";

export function estimateCost(model: string, inputTokens: number, outputTokens: number): number | null {
  const price = MODEL_PRICES[model];
  if (!price) return null;
  return (inputTokens * price[0] + outputTokens * price[1]) / 1_000_000;
}
