/**
 * Blog articles: types, validation, the Markdown subset they are written in,
 * internal-link suggestions and SEO checks. No database and no Node APIs, so
 * the admin editor runs exactly the same code in the browser as the server
 * runs on save. The database side is lib/articles-repo.ts.
 */
import type { PhotoKey } from "./photos";

export type ArticleStatus = "draft" | "in_review" | "changes_requested" | "approved";

export const STATUS_LABELS: Record<ArticleStatus, string> = {
  draft: "Draft",
  in_review: "In medical review",
  changes_requested: "Changes requested",
  approved: "Medically approved",
};

/** The fields a reviewing doctor signs off on. Any change voids the approval. */
export type ArticleContent = {
  title: string;
  slug: string;
  /** The page's <title>. Empty means "use the title". */
  seoTitle: string;
  /** Meta description and the summary under the title. */
  description: string;
  /** The search phrase the article is written for; also what other articles link on. */
  focusKeyword: string;
  body: string;
  cover: PhotoKey | null;
};

export type ArticleAction =
  | "created"
  | "edited"
  | "returned_to_draft"
  | "submitted"
  | "withdrawn"
  | "approved"
  | "changes_requested"
  | "published"
  | "unpublished";

export type ArticleEvent = {
  at: string;
  action: ArticleAction;
  by: string;
  role: "admin" | "provider" | "staff";
  note?: string;
  /** Fingerprint of the content at the time — ties approvals to exact text. */
  hash?: string;
};

export type Reviewer = { providerId: string; name: string; cred: string };

export type Approval = Reviewer & { staffId: string; at: string; hash: string };

/** What the public site shows: a frozen copy of the approved text. */
export type LiveArticle = ArticleContent & {
  hash: string;
  reviewedBy: Reviewer;
  reviewedAt: string;
  /** First publication — stays put through later updates. */
  publishedAt: string;
  /** This version went live. */
  updatedAt: string;
};

export type ArticleOrigin = { type: "ai"; model: string; topicId: string | null; generatedAt: string };

export type Article = ArticleContent & {
  id: string;
  status: ArticleStatus;
  hash: string;
  /** Bumped on every write; a save from a stale editor is refused. */
  version: number;
  reviewerId: string | null;
  approval: Approval | null;
  /** The doctor's latest "changes requested" note. */
  reviewNote: string | null;
  live: LiveArticle | null;
  /** Set when the first draft was written by the AI writer. */
  origin: ArticleOrigin | null;
  /** Once an article has been public its address never changes. */
  slugLocked: boolean;
  createdAt: string;
  updatedAt: string;
  history: ArticleEvent[];
};

export const LIMITS = {
  title: 120,
  slug: 80,
  seoTitle: 70,
  description: 170,
  focusKeyword: 60,
  body: 60_000,
  note: 1000,
};

/** Search engines cut titles and descriptions beyond about these lengths. */
export const SEO_TITLE_IDEAL = 60;
export const DESCRIPTION_IDEAL: [number, number] = [70, 160];
/** An article needs at least this much before a doctor is asked to review it. */
export const MIN_REVIEW_WORDS = 150;

export class ArticleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ArticleError";
  }
}

export function slugify(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, LIMITS.slug)
    .replace(/-+$/, "");
}

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function line(value: unknown, field: string, max: number, required: boolean): string {
  const clean = typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
  if (required && !clean) throw new ArticleError(`${field} can't be empty`);
  if (clean.length > max) throw new ArticleError(`${field} is too long (${max} characters max)`);
  return clean;
}

/**
 * Validates what the editor sends. Throws ArticleError with a readable
 * message. `coverKeys` are the photo-library pictures a cover may use.
 */
export function cleanArticleContent(input: unknown, coverKeys: readonly string[]): ArticleContent {
  const body = (input ?? {}) as Record<string, unknown>;
  const title = line(body.title, "Title", LIMITS.title, true);
  const slug = typeof body.slug === "string" && body.slug.trim() ? body.slug.trim() : slugify(title);
  if (!SLUG.test(slug) || slug.length > LIMITS.slug) {
    throw new ArticleError("The web address may only use lowercase letters, numbers and dashes");
  }
  const text = typeof body.body === "string" ? body.body.replace(/\r\n?/g, "\n").replace(/[ \t]+$/gm, "").trim() : "";
  if (text.length > LIMITS.body) throw new ArticleError(`The article is too long (${LIMITS.body} characters max)`);
  const cover = typeof body.cover === "string" && coverKeys.includes(body.cover) ? (body.cover as PhotoKey) : null;
  if (body.cover != null && body.cover !== "" && !cover) throw new ArticleError("Choose a cover picture from the library");
  return {
    title,
    slug,
    seoTitle: line(body.seoTitle, "Search title", LIMITS.seoTitle, false),
    description: line(body.description, "Description", LIMITS.description, false),
    focusKeyword: line(body.focusKeyword, "Focus keyword", LIMITS.focusKeyword, false),
    body: text,
    cover,
  };
}

/** Stable text for fingerprinting: same content, same string, every time. */
export function canonicalContent(content: ArticleContent): string {
  return JSON.stringify([
    content.title,
    content.slug,
    content.seoTitle,
    content.description,
    content.focusKeyword,
    content.body,
    content.cover,
  ]);
}

/* ----------------------------------------------------------- Markdown -- */

/*
 * Articles are written in a small Markdown subset:
 *
 *   ## Heading / ### Smaller heading        - bullet / 1. numbered lists
 *   > A note                                 --- a dividing line
 *   **bold**  *italic*  [words](/services)   blank line = new paragraph
 *
 * Nothing is ever turned into raw HTML: the parser produces a tree that
 * components/blog/ArticleBody renders as React elements, so typed HTML or
 * script shows up as plain text.
 */

export type Inline =
  | { type: "text"; text: string }
  | { type: "strong"; children: Inline[] }
  | { type: "em"; children: Inline[] }
  | { type: "link"; href: string; children: Inline[] };

export type Block =
  | { type: "heading"; level: 2 | 3; id: string; children: Inline[] }
  | { type: "paragraph"; children: Inline[] }
  | { type: "list"; ordered: boolean; items: Inline[][] }
  | { type: "quote"; children: Inline[] }
  | { type: "rule" };

const LIST_ITEM = /^\s*(?:[-*+]|\d{1,3}[.)])\s+/;

export function parseMarkdown(source: string): Block[] {
  const blocks: Block[] = [];
  const usedIds = new Map<string, number>();
  const lines = source.replace(/\r\n?/g, "\n").split("\n");
  let i = 0;

  const headingId = (text: string) => {
    const base = slugify(text) || "section";
    const seen = usedIds.get(base) ?? 0;
    usedIds.set(base, seen + 1);
    return seen ? `${base}-${seen + 1}` : base;
  };

  while (i < lines.length) {
    const current = lines[i];
    if (!current.trim()) {
      i += 1;
      continue;
    }
    const heading = current.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      // The page title is the only h1; deeper levels fold into h3.
      const level = heading[1].length <= 2 ? 2 : 3;
      const text = heading[2].replace(/\s+#+\s*$/, "").trim();
      blocks.push({ type: "heading", level, id: headingId(plainInline(text)), children: parseInline(text) });
      i += 1;
      continue;
    }
    if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(current)) {
      blocks.push({ type: "rule" });
      i += 1;
      continue;
    }
    if (LIST_ITEM.test(current)) {
      const ordered = /^\s*\d/.test(current);
      const items: Inline[][] = [];
      while (i < lines.length && LIST_ITEM.test(lines[i]) && /^\s*\d/.test(lines[i]) === ordered) {
        let item = lines[i].replace(LIST_ITEM, "");
        i += 1;
        // Indented lines continue the item above.
        while (i < lines.length && /^\s{2,}\S/.test(lines[i]) && !LIST_ITEM.test(lines[i])) {
          item += ` ${lines[i].trim()}`;
          i += 1;
        }
        items.push(parseInline(item.trim()));
      }
      blocks.push({ type: "list", ordered, items });
      continue;
    }
    if (/^\s*>/.test(current)) {
      const parts: string[] = [];
      while (i < lines.length && /^\s*>/.test(lines[i])) {
        parts.push(lines[i].replace(/^\s*>\s?/, ""));
        i += 1;
      }
      blocks.push({ type: "quote", children: parseInline(parts.join(" ").trim()) });
      continue;
    }
    const parts: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() &&
      !/^#{1,6}\s/.test(lines[i]) &&
      !LIST_ITEM.test(lines[i]) &&
      !/^\s*>/.test(lines[i])
    ) {
      parts.push(lines[i].trim());
      i += 1;
    }
    blocks.push({ type: "paragraph", children: parseInline(parts.join(" ")) });
  }
  return blocks;
}

export function parseInline(text: string): Inline[] {
  const out: Inline[] = [];
  let buffer = "";
  const flush = () => {
    if (buffer) out.push({ type: "text", text: buffer });
    buffer = "";
  };
  let i = 0;
  while (i < text.length) {
    const char = text[i];
    if (char === "\\" && i + 1 < text.length && /[\\*_[\]()#>`-]/.test(text[i + 1])) {
      buffer += text[i + 1];
      i += 2;
      continue;
    }
    if (char === "[") {
      const link = readLink(text, i);
      if (link) {
        flush();
        out.push({ type: "link", href: link.href, children: parseInline(link.label) });
        i = link.end;
        continue;
      }
    }
    if (text.startsWith("**", i) || text.startsWith("__", i)) {
      const marker = text.slice(i, i + 2);
      const close = text.indexOf(marker, i + 2);
      if (close > i + 2) {
        flush();
        out.push({ type: "strong", children: parseInline(text.slice(i + 2, close)) });
        i = close + 2;
        continue;
      }
    }
    if ((char === "*" || char === "_") && text[i + 1] && text[i + 1] !== " ") {
      // `_` only counts at a word edge, so snake_case words stay intact.
      const atEdge = char === "*" || i === 0 || /\W/.test(text[i - 1]);
      const close = findClose(text, char, i + 1);
      if (atEdge && close > i + 1 && (char === "*" || !/\w/.test(text[close + 1] ?? ""))) {
        flush();
        out.push({ type: "em", children: parseInline(text.slice(i + 1, close)) });
        i = close + 1;
        continue;
      }
    }
    buffer += char;
    i += 1;
  }
  flush();
  return out;
}

function findClose(text: string, marker: string, from: number): number {
  for (let j = from; j < text.length; j += 1) {
    if (text[j] === "\\") {
      j += 1;
      continue;
    }
    if (text[j] === marker && text[j + 1] !== marker && text[j - 1] !== " ") return j;
  }
  return -1;
}

/** `[label](href)` starting at `start`, or null. */
function readLink(text: string, start: number): { label: string; href: string; end: number } | null {
  let depth = 0;
  let j = start;
  for (; j < text.length; j += 1) {
    if (text[j] === "\\") {
      j += 1;
      continue;
    }
    if (text[j] === "[") depth += 1;
    if (text[j] === "]") {
      depth -= 1;
      if (depth === 0) break;
    }
  }
  if (j >= text.length || text[j + 1] !== "(") return null;
  const close = text.indexOf(")", j + 2);
  if (close < 0) return null;
  const href = text.slice(j + 2, close).trim();
  if (!href || /\s/.test(href)) return null;
  return { label: text.slice(start + 1, j), href, end: close + 1 };
}

export function plainInline(text: string): string {
  return inlineText(parseInline(text));
}

export function inlineText(nodes: Inline[]): string {
  return nodes.map((node) => (node.type === "text" ? node.text : inlineText(node.children))).join("");
}

export function blockText(block: Block): string {
  switch (block.type) {
    case "rule":
      return "";
    case "list":
      return block.items.map(inlineText).join(" ");
    default:
      return inlineText(block.children);
  }
}

export function wordCount(body: string): number {
  const text = parseMarkdown(body).map(blockText).join(" ");
  return text.match(/[\p{L}\p{N}'’-]+/gu)?.length ?? 0;
}

export function readingMinutes(body: string): number {
  return Math.max(1, Math.round(wordCount(body) / 220));
}

/* --------------------------------------------------------------- links -- */

export type LinkKind = "internal" | "external";

/**
 * How a link is treated: an internal path, an https address, or null for
 * anything else (javascript:, data:, http:, protocol-relative…), which is
 * rendered as plain words.
 */
export function classifyHref(href: string): LinkKind | null {
  if (/^\/(?![/\\])[A-Za-z0-9\-._~/%]*(?:#[A-Za-z0-9\-_]*)?$/.test(href)) return "internal";
  if (/^https:\/\//i.test(href)) {
    try {
      const url = new URL(href);
      if (url.protocol === "https:" && url.hostname.includes(".") && !url.username && !url.password) return "external";
    } catch {
      return null;
    }
  }
  return null;
}

/** Every link in an article, in order. */
export function articleLinks(body: string): { href: string; text: string }[] {
  const found: { href: string; text: string }[] = [];
  const walk = (nodes: Inline[]) => {
    for (const node of nodes) {
      if (node.type === "link") found.push({ href: node.href, text: inlineText(node.children) });
      if (node.type !== "text") walk(node.children);
    }
  };
  for (const block of parseMarkdown(body)) {
    if (block.type === "list") block.items.forEach(walk);
    else if (block.type !== "rule") walk(block.children);
  }
  return found;
}

export const pathOf = (href: string) => href.split("#")[0] || "/";

/** Public pages an article may link to, besides /blog/<slug>. */
export const SITE_PATHS = ["/", "/services", "/insurance", "/self-pay", "/pricing", "/about", "/contact", "/book", "/blog", "/privacy"];

/**
 * Problems with an article's links, for the editor and the save check.
 * `articleSlugs` are the articles that exist (any status).
 */
export function linkProblems(body: string, articleSlugs: Iterable<string>, selfSlug: string): string[] {
  const slugs = new Set(articleSlugs);
  const problems: string[] = [];
  for (const link of articleLinks(body)) {
    const kind = classifyHref(link.href);
    if (!kind) {
      problems.push(`"${link.text}" → ${link.href}: only site pages (starting with /) and https:// addresses work`);
      continue;
    }
    if (kind === "external") continue;
    const path = pathOf(link.href).replace(/\/+$/, "") || "/";
    const article = path.match(/^\/blog\/([a-z0-9-]+)$/);
    if (article) {
      if (article[1] === selfSlug) problems.push(`"${link.text}" links to this article itself`);
      else if (!slugs.has(article[1])) problems.push(`"${link.text}" → ${link.href}: there is no article with that address`);
    } else if (!SITE_PATHS.includes(path)) {
      problems.push(`"${link.text}" → ${link.href}: that page doesn't exist on the site`);
    }
  }
  return problems;
}

/* ----------------------------------------------- internal-link suggestions -- */

/** A page an article can link to, and the words that should link to it. */
export type LinkTarget = { href: string; title: string; phrases: string[] };

export type LinkSuggestion = {
  href: string;
  title: string;
  /** The words as they appear in the article. */
  phrase: string;
  /** Where they start in the Markdown source. */
  index: number;
  /** A little text either side, for the editor. */
  context: string;
};

/**
 * Blanks out the parts of the source that must never become links — headings,
 * existing links, escaped characters — keeping every other character at its
 * position, so a match in the copy is a safe place in the original.
 */
function linkableText(body: string): string {
  const blank = (text: string) => text.replace(/[^\n]/g, " ");
  return body
    .replace(/^#{1,6}\s.*$/gm, blank)
    .replace(/\\./g, blank)
    .replace(/\[[^\]\n]*\]\([^)\s]*\)/g, blank);
}

const escapeRegex = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Where this article could link to other pages: for each target it doesn't
 * already link to, the first unlinked mention of one of its phrases.
 */
export function suggestLinks(body: string, targets: LinkTarget[], selfHref: string, max = 8): LinkSuggestion[] {
  const linked = new Set(
    articleLinks(body)
      .filter((link) => classifyHref(link.href) === "internal")
      .map((link) => link.href),
  );
  const linkedPaths = new Set([...linked].map(pathOf));
  const text = linkableText(body);
  const taken: [number, number][] = [];
  const suggestions: LinkSuggestion[] = [];

  for (const target of targets) {
    if (suggestions.length >= max) break;
    if (target.href === selfHref || linked.has(target.href)) continue;
    // A page linked once (any section of it) is enough, except the service list,
    // where each service is its own destination.
    if (!target.href.includes("#") && linkedPaths.has(pathOf(target.href))) continue;
    let best: { index: number; length: number } | null = null;
    for (const phrase of target.phrases) {
      if (phrase.trim().length < 3) continue;
      const pattern = new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegex(phrase.trim())}(?![\\p{L}\\p{N}])`, "giu");
      for (const match of text.matchAll(pattern)) {
        const index = match.index ?? 0;
        const end = index + match[0].length;
        if (taken.some(([from, to]) => index < to && end > from)) continue;
        if (!best || index < best.index) best = { index, length: match[0].length };
        break;
      }
    }
    if (!best) continue;
    taken.push([best.index, best.index + best.length]);
    const from = Math.max(0, body.lastIndexOf(" ", Math.max(0, best.index - 40)));
    const to = body.indexOf(" ", Math.min(body.length, best.index + best.length + 40));
    suggestions.push({
      href: target.href,
      title: target.title,
      phrase: body.slice(best.index, best.index + best.length),
      index: best.index,
      context: `${from > 0 ? "…" : ""}${body.slice(from, to < 0 ? body.length : to).replace(/\s+/g, " ").trim()}${to < 0 ? "" : "…"}`,
    });
  }
  return suggestions.sort((a, b) => a.index - b.index);
}

/** Turns the suggested words into a link. Returns the body unchanged if they moved. */
export function applyLinkSuggestion(body: string, suggestion: LinkSuggestion): string {
  const { index, phrase, href } = suggestion;
  if (body.slice(index, index + phrase.length) !== phrase) return body;
  return `${body.slice(0, index)}[${phrase}](${href})${body.slice(index + phrase.length)}`;
}

/* ----------------------------------------------------------- SEO checks -- */

export type SeoCheck = { ok: boolean; label: string };

export function seoChecks(content: ArticleContent): SeoCheck[] {
  const title = content.seoTitle || content.title;
  const words = wordCount(content.body);
  const blocks = parseMarkdown(content.body);
  const links = articleLinks(content.body);
  const internal = links.filter((link) => classifyHref(link.href) === "internal").length;
  const external = links.filter((link) => classifyHref(link.href) === "external").length;
  const keyword = content.focusKeyword.toLowerCase();
  const firstParagraph = blocks.find((block) => block.type === "paragraph");
  const has = (text: string) => Boolean(keyword) && text.toLowerCase().includes(keyword);
  const [low, high] = DESCRIPTION_IDEAL;

  return [
    { ok: title.length > 0 && title.length <= SEO_TITLE_IDEAL, label: `Search title is ${title.length} characters (aim for ${SEO_TITLE_IDEAL} or fewer)` },
    {
      ok: content.description.length >= low && content.description.length <= high,
      label: `Description is ${content.description.length} characters (aim for ${low}–${high})`,
    },
    { ok: Boolean(keyword), label: "A focus keyword is set" },
    { ok: has(title), label: "The focus keyword is in the search title" },
    { ok: has(content.description), label: "The focus keyword is in the description" },
    { ok: firstParagraph ? has(blockText(firstParagraph)) : false, label: "The focus keyword is in the first paragraph" },
    { ok: blocks.some((block) => block.type === "heading"), label: "The article has section headings" },
    { ok: words >= 300, label: `${words} words (aim for at least 300)` },
    { ok: internal >= 2, label: `${internal} links to other pages on the site (aim for 2 or more)` },
    { ok: external >= 1, label: `${external} links to outside sources (cite at least one)` },
    { ok: content.cover !== null, label: "A cover picture is chosen" },
  ];
}

/** What must be true before a doctor is asked to review. */
export function reviewProblems(content: ArticleContent): string[] {
  const problems: string[] = [];
  if (content.description.length < 50) problems.push("Write a description of at least 50 characters");
  if (wordCount(content.body) < MIN_REVIEW_WORDS) problems.push(`Write at least ${MIN_REVIEW_WORDS} words`);
  return problems;
}

/* ------------------------------------------------------------------ FAQ -- */

/**
 * The questions under a "Frequently asked questions" (or "FAQ") heading:
 * each `###` question and the text after it. Used for FAQ structured data.
 */
export function extractFaqs(body: string): { question: string; answer: string }[] {
  const blocks = parseMarkdown(body);
  const start = blocks.findIndex(
    (block) => block.type === "heading" && block.level === 2 && /frequently asked|\bfaqs?\b/i.test(inlineText(block.children)),
  );
  if (start < 0) return [];
  const faqs: { question: string; answer: string }[] = [];
  for (const block of blocks.slice(start + 1)) {
    if (block.type === "heading" && block.level === 2) break;
    if (block.type === "heading") faqs.push({ question: inlineText(block.children), answer: "" });
    else if (faqs.length) {
      const last = faqs[faqs.length - 1];
      last.answer = `${last.answer} ${blockText(block)}`.trim();
    }
  }
  return faqs.filter((faq) => faq.question && faq.answer);
}
