/**
 * Blog articles in MongoDB (`articles`). The rules that matter:
 *
 * - A doctor's approval is tied to a fingerprint of the exact text. Any change
 *   to the text clears it and sends the article back to draft.
 * - Only the reviewing doctor (a provider account) can approve; only an admin
 *   can publish, and only text whose approval still matches.
 * - Publishing copies the approved text into `live`. The public site reads
 *   `live` only, so editing an article never puts unreviewed words online —
 *   the old version stays up until the new one is approved and published.
 * - Every step is written to the article's history.
 *
 * Nothing here reads bookings, patients or users.
 */
import { createHash } from "node:crypto";
import { ObjectId, type Collection, MongoServerError } from "mongodb";
import {
  ArticleError,
  canonicalContent,
  cleanArticleContent,
  linkProblems,
  LIMITS,
  reviewProblems,
  type Approval,
  type Article,
  type ArticleAction,
  type ArticleContent,
  seoChecks,
  type ArticleEvent,
  type ArticleOrigin,
  type ArticleStatus,
  type LinkTarget,
  type LiveArticle,
  type Reviewer,
} from "./articles";
import { ForbiddenError } from "./auth";
import { ensureIndexes, getDb } from "./db";
import type { Admin } from "./models";
import { photos } from "./photos";
import { getAllProviders } from "./providers";
import { listAdmins, loadProviders } from "./repo";
import { providerById } from "./scheduling";
import { services } from "./site";

type EventDoc = Omit<ArticleEvent, "at"> & { at: Date; staffId: string };
type ApprovalDoc = Omit<Approval, "at"> & { at: Date };
type LiveDoc = Omit<LiveArticle, "reviewedAt" | "publishedAt" | "updatedAt"> & {
  reviewedAt: Date;
  publishedAt: Date;
  updatedAt: Date;
};

type ArticleDoc = ArticleContent & {
  _id: ObjectId;
  status: ArticleStatus;
  hash: string;
  version: number;
  reviewerId: string | null;
  approval: ApprovalDoc | null;
  reviewNote: string | null;
  live: LiveDoc | null;
  firstPublishedAt: Date | null;
  /** Missing on articles written by hand. */
  origin?: Omit<ArticleOrigin, "generatedAt"> & { generatedAt: Date };
  createdAt: Date;
  updatedAt: Date;
  history: EventDoc[];
};

/** The text changed underneath someone (another tab, another person). */
export class ArticleConflictError extends Error {
  constructor(message = "This article was changed somewhere else — reload it and try again") {
    super(message);
    this.name = "ArticleConflictError";
  }
}

const HISTORY_KEPT = 500;
const COVER_KEYS = Object.keys(photos);

async function articles(): Promise<Collection<ArticleDoc>> {
  await ensureIndexes();
  const db = await getDb();
  return db.collection<ArticleDoc>("articles");
}

export function hashContent(content: ArticleContent): string {
  return createHash("sha256").update(canonicalContent(content)).digest("hex");
}

function serializeLive(live: LiveDoc): LiveArticle {
  return {
    ...live,
    reviewedAt: live.reviewedAt.toISOString(),
    publishedAt: live.publishedAt.toISOString(),
    updatedAt: live.updatedAt.toISOString(),
  };
}

function serialize(doc: ArticleDoc): Article {
  return {
    id: doc._id.toString(),
    title: doc.title,
    slug: doc.slug,
    seoTitle: doc.seoTitle,
    description: doc.description,
    focusKeyword: doc.focusKeyword,
    body: doc.body,
    cover: doc.cover,
    status: doc.status,
    hash: doc.hash,
    version: doc.version,
    reviewerId: doc.reviewerId,
    approval: doc.approval ? { ...doc.approval, at: doc.approval.at.toISOString() } : null,
    reviewNote: doc.reviewNote,
    live: doc.live ? serializeLive(doc.live) : null,
    origin: doc.origin ? { ...doc.origin, generatedAt: doc.origin.generatedAt.toISOString() } : null,
    slugLocked: Boolean(doc.firstPublishedAt),
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
    // Staff ids stay in the database; the editor shows names.
    history: (doc.history ?? []).map((item) => ({
      at: item.at.toISOString(),
      action: item.action,
      by: item.by,
      role: item.role,
      ...(item.note ? { note: item.note } : {}),
      ...(item.hash ? { hash: item.hash } : {}),
    })),
  };
}

function event(staff: Admin, action: ArticleAction, extra: { note?: string; hash?: string } = {}): EventDoc {
  return { at: new Date(), action, by: staff.name, role: staff.role, staffId: staff.id, ...extra };
}

const pushHistory = (...events: EventDoc[]) => ({ history: { $each: events, $slice: -HISTORY_KEPT } });

function objectId(id: string): ObjectId | null {
  return /^[a-f\d]{24}$/i.test(id) ? new ObjectId(id) : null;
}

/** Slugs of every article except `exceptId` — what links may point at. */
async function otherSlugs(collection: Collection<ArticleDoc>, exceptId?: ObjectId): Promise<string[]> {
  const docs = await collection
    .find(exceptId ? { _id: { $ne: exceptId } } : {}, { projection: { slug: 1 } })
    .toArray();
  return docs.map((doc) => doc.slug);
}

function checkLinks(content: ArticleContent, slugs: string[]): void {
  const problems = linkProblems(content.body, slugs, content.slug);
  if (problems.length) {
    throw new ArticleError(problems.length > 1 ? `${problems[0]} (and ${problems.length - 1} more link problems)` : problems[0]);
  }
}

function duplicateSlug(error: unknown): boolean {
  return error instanceof MongoServerError && error.code === 11000;
}

/* --------------------------------------------------------------- admin -- */

export type ArticleSummary = Pick<
  Article,
  "id" | "title" | "slug" | "status" | "reviewerId" | "updatedAt" | "createdAt" | "approval" | "focusKeyword" | "seoTitle" | "description"
> & {
  live: { publishedAt: string; updatedAt: string; hash: string } | null;
  hash: string;
  /** "ai" for drafts from the AI writer. */
  source: "ai" | "manual";
  /** Search-checklist items passed, out of `total`. */
  seo: { passed: number; total: number };
};

export async function listArticles(): Promise<ArticleSummary[]> {
  const collection = await articles();
  const docs = await collection
    .find({}, { projection: { history: 0 } })
    .sort({ updatedAt: -1 })
    .toArray();
  return docs.map((doc) => {
    const checks = seoChecks(doc);
    return {
      id: doc._id.toString(),
      title: doc.title,
      slug: doc.slug,
      focusKeyword: doc.focusKeyword,
      seoTitle: doc.seoTitle,
      description: doc.description,
      source: doc.origin?.type === "ai" ? "ai" : "manual",
      seo: { passed: checks.filter((check) => check.ok).length, total: checks.length },
      status: doc.status,
      reviewerId: doc.reviewerId,
      hash: doc.hash,
      approval: doc.approval ? { ...doc.approval, at: doc.approval.at.toISOString() } : null,
      updatedAt: doc.updatedAt.toISOString(),
      createdAt: doc.createdAt.toISOString(),
      live: doc.live
        ? { publishedAt: doc.live.publishedAt.toISOString(), updatedAt: doc.live.updatedAt.toISOString(), hash: doc.live.hash }
        : null,
    };
  });
}

export async function getArticle(id: string): Promise<Article | null> {
  const _id = objectId(id);
  if (!_id) return null;
  const doc = await (await articles()).findOne({ _id });
  return doc ? serialize(doc) : null;
}

export async function createArticle(
  input: unknown,
  staff: Admin,
  options: { origin?: Omit<ArticleOrigin, "generatedAt">; note?: string } = {},
): Promise<Article> {
  const content = cleanArticleContent(input, COVER_KEYS);
  const collection = await articles();
  checkLinks(content, await otherSlugs(collection));
  const now = new Date();
  const hash = hashContent(content);
  const doc: ArticleDoc = {
    _id: new ObjectId(),
    ...content,
    status: "draft",
    hash,
    version: 1,
    reviewerId: null,
    approval: null,
    reviewNote: null,
    live: null,
    firstPublishedAt: null,
    ...(options.origin ? { origin: { ...options.origin, generatedAt: now } } : {}),
    createdAt: now,
    updatedAt: now,
    history: [event(staff, "created", { hash, ...(options.note ? { note: options.note } : {}) })],
  };
  try {
    await collection.insertOne(doc);
  } catch (error) {
    if (duplicateSlug(error)) throw new ArticleError("Another article already uses that web address");
    throw error;
  }
  return serialize(doc);
}

/**
 * Saves the editor's text. `version` is what the editor loaded; if anything
 * changed since, nothing is saved. Changed text voids an approval or a
 * review in progress.
 */
export async function saveArticle(id: string, input: unknown, version: unknown, staff: Admin): Promise<Article | null> {
  const _id = objectId(id);
  if (!_id) return null;
  const collection = await articles();
  const doc = await collection.findOne({ _id });
  if (!doc) return null;
  if (doc.version !== version) throw new ArticleConflictError();

  const content = cleanArticleContent(input, COVER_KEYS);
  if (doc.firstPublishedAt && content.slug !== doc.slug) {
    throw new ArticleError("This article has been public, so its web address can't change");
  }
  checkLinks(content, await otherSlugs(collection, _id));
  const hash = hashContent(content);
  if (hash === doc.hash) return serialize(doc);

  const events = [event(staff, "edited", { hash })];
  let status = doc.status;
  if (status === "in_review" || status === "approved") {
    events.push(
      event(staff, "returned_to_draft", {
        note:
          status === "approved" && doc.approval
            ? `The text changed after ${doc.approval.name} approved it, so it needs a new medical review`
            : "The text changed during medical review, so it must be sent for review again",
      }),
    );
    status = "draft";
  }

  try {
    const result = await collection.findOneAndUpdate(
      { _id, version: doc.version },
      {
        $set: { ...content, hash, status, approval: null, updatedAt: new Date() },
        $inc: { version: 1 },
        $push: pushHistory(...events),
      },
      { returnDocument: "after" },
    );
    if (!result) throw new ArticleConflictError();
    return serialize(result);
  } catch (error) {
    if (duplicateSlug(error)) throw new ArticleError("Another article already uses that web address");
    throw error;
  }
}

export class ArticleLiveError extends Error {
  constructor() {
    super("Take the article off the site before deleting it");
    this.name = "ArticleLiveError";
  }
}

export async function deleteArticle(id: string): Promise<boolean> {
  const _id = objectId(id);
  if (!_id) return false;
  const collection = await articles();
  const result = await collection.deleteOne({ _id, live: null });
  if (result.deletedCount) return true;
  if (await collection.countDocuments({ _id }, { limit: 1 })) throw new ArticleLiveError();
  return false;
}

/* ------------------------------------------------------------ workflow -- */

export type WorkflowAction = "submit" | "withdraw" | "approve" | "request_changes" | "publish" | "unpublish";

export const WORKFLOW_ACTIONS: WorkflowAction[] = ["submit", "withdraw", "approve", "request_changes", "publish", "unpublish"];

/** Doctors who can review: providers that have their own staff sign-in. */
export async function listReviewers(): Promise<Reviewer[]> {
  await loadProviders();
  const accounts = await listAdmins();
  const seen = new Set<string>();
  const reviewers: Reviewer[] = [];
  for (const account of accounts) {
    if (account.role !== "provider" || !account.providerId || seen.has(account.providerId)) continue;
    const provider = providerById(account.providerId);
    if (!provider) continue;
    seen.add(account.providerId);
    reviewers.push({ providerId: provider.id, name: provider.name, cred: provider.cred });
  }
  return reviewers;
}

/**
 * Moves an article through review and publication. `hash` is the text the
 * person was looking at: if the article changed since, nothing happens.
 */
export async function articleAction(
  id: string,
  action: WorkflowAction,
  staff: Admin,
  input: { hash?: unknown; reviewerId?: unknown; note?: unknown; confirm?: unknown },
): Promise<Article | null> {
  const _id = objectId(id);
  if (!_id) return null;
  const collection = await articles();
  const doc = await collection.findOne({ _id });
  if (!doc) return null;

  const adminOnly = ["submit", "withdraw", "publish", "unpublish"].includes(action);
  if (adminOnly && staff.role !== "admin") throw new ForbiddenError();
  // Medical sign-off is a doctor's, never an admin's.
  if (action === "approve" || action === "request_changes") {
    if (staff.role !== "provider") throw new ForbiddenError();
    // Only the doctor it was sent to — no one else can even probe it.
    if (doc.reviewerId !== staff.providerId) throw new ForbiddenError();
  }

  if (typeof input.hash !== "string" || input.hash !== doc.hash) throw new ArticleConflictError();
  const hash = doc.hash;
  const now = new Date();
  let filter: Record<string, unknown> = { _id, hash };
  let update: Record<string, unknown>;

  switch (action) {
    case "submit": {
      if (doc.status !== "draft" && doc.status !== "changes_requested") {
        throw new ArticleError("Only a draft can be sent for medical review");
      }
      const problems = reviewProblems(doc);
      if (problems.length) throw new ArticleError(`Before review: ${problems.join("; ")}`);
      const reviewers = await listReviewers();
      const reviewer = reviewers.find((item) => item.providerId === input.reviewerId);
      if (!reviewer) throw new ArticleError("Choose a doctor with a sign-in to review it");
      filter = { ...filter, status: doc.status };
      update = {
        $set: { status: "in_review", reviewerId: reviewer.providerId, approval: null, updatedAt: now },
        $push: pushHistory(event(staff, "submitted", { hash, note: `Sent to ${reviewer.name}` })),
      };
      break;
    }
    case "withdraw":
      if (doc.status !== "in_review") throw new ArticleError("This article isn't in review");
      filter = { ...filter, status: "in_review" };
      update = {
        $set: { status: "draft", updatedAt: now },
        $push: pushHistory(event(staff, "withdrawn", { hash })),
      };
      break;
    case "approve":
    case "request_changes": {
      if (doc.status !== "in_review") throw new ArticleError("This article isn't waiting for review");
      filter = { ...filter, status: "in_review", reviewerId: staff.providerId };
      if (action === "approve") {
        if (input.confirm !== true) throw new ArticleError("Confirm that you reviewed the article for medical accuracy");
        const provider = providerById(staff.providerId);
        const approval: ApprovalDoc = {
          providerId: staff.providerId as string,
          name: provider?.name ?? staff.name,
          cred: provider?.cred ?? "",
          staffId: staff.id,
          at: now,
          hash,
        };
        update = {
          $set: { status: "approved", approval, reviewNote: null, updatedAt: now },
          $push: pushHistory(event(staff, "approved", { hash })),
        };
      } else {
        const note = typeof input.note === "string" ? input.note.trim().slice(0, LIMITS.note) : "";
        if (note.length < 5) throw new ArticleError("Say what needs to change");
        update = {
          $set: { status: "changes_requested", reviewNote: note, updatedAt: now },
          $push: pushHistory(event(staff, "changes_requested", { hash, note })),
        };
      }
      break;
    }
    case "publish": {
      if (doc.status !== "approved" || !doc.approval || doc.approval.hash !== hash) {
        throw new ArticleError("Only medically approved text can be published");
      }
      const { providerId, name, cred } = doc.approval;
      const live: LiveDoc = {
        title: doc.title,
        slug: doc.slug,
        seoTitle: doc.seoTitle,
        description: doc.description,
        focusKeyword: doc.focusKeyword,
        body: doc.body,
        cover: doc.cover,
        hash,
        reviewedBy: { providerId, name, cred },
        reviewedAt: doc.approval.at,
        publishedAt: doc.live?.publishedAt ?? doc.firstPublishedAt ?? now,
        updatedAt: now,
      };
      filter = { ...filter, status: "approved", "approval.hash": hash };
      update = {
        $set: { live, firstPublishedAt: doc.firstPublishedAt ?? now, updatedAt: now },
        $push: pushHistory(event(staff, "published", { hash })),
      };
      break;
    }
    case "unpublish":
      if (!doc.live) throw new ArticleError("This article isn't on the site");
      filter = { ...filter, live: { $ne: null } };
      update = {
        $set: { live: null, updatedAt: now },
        $push: pushHistory(event(staff, "unpublished", { hash: doc.live.hash })),
      };
      break;
  }

  const result = await collection.findOneAndUpdate(filter, { ...update, $inc: { version: 1 } }, { returnDocument: "after" });
  if (!result) throw new ArticleConflictError();
  return serialize(result);
}

/* -------------------------------------------------------------- doctors -- */

export async function listReviewQueue(providerId: string): Promise<ArticleSummary[]> {
  const all = await listArticles();
  return all.filter((article) => article.reviewerId === providerId && article.status === "in_review");
}

export async function listReviewedBy(providerId: string): Promise<ArticleSummary[]> {
  const all = await listArticles();
  return all.filter((article) => article.approval?.providerId === providerId);
}

/* -------------------------------------------------------------- public -- */

/** Published articles, newest first — only the approved, frozen copies. */
/** True once at least one article is published — the menu shows Blog then. */
export async function hasLiveArticles(): Promise<boolean> {
  const db = await getDb();
  const doc = await db.collection<ArticleDoc>("articles").findOne({ live: { $ne: null } }, { projection: { _id: 1 } });
  return doc !== null;
}

export async function listLiveArticles(limit = 100): Promise<LiveArticle[]> {
  const db = await getDb();
  const docs = await db
    .collection<ArticleDoc>("articles")
    .find({ live: { $ne: null } }, { projection: { live: 1 } })
    .sort({ "live.publishedAt": -1 })
    .limit(limit)
    .toArray();
  return docs.flatMap((doc) => (doc.live ? [serializeLive(doc.live)] : []));
}

export async function getLiveArticle(slug: string): Promise<LiveArticle | null> {
  if (!/^[a-z0-9-]{1,80}$/.test(slug)) return null;
  const db = await getDb();
  const doc = await db
    .collection<ArticleDoc>("articles")
    .findOne({ "live.slug": slug }, { projection: { live: 1 } });
  return doc?.live ? serializeLive(doc.live) : null;
}

/* ------------------------------------------------- internal-link targets -- */

/** Words in an article that should link to each service on /services. */
const SERVICE_PHRASES: Record<string, string[]> = {
  "Pregnancy Testing": ["pregnancy test", "pregnancy testing"],
  Ultrasound: ["ultrasound", "sonogram"],
  "First-Trimester Care": ["first trimester", "first-trimester"],
  "Prenatal Care": ["prenatal care", "prenatal visit", "prenatal visits"],
  "Teen Pregnancy Support": ["teen pregnancy", "pregnant teen", "pregnant teens"],
  "Insurance & AHCCCS": ["AHCCCS", "WIC"],
};

const PAGE_TARGETS: LinkTarget[] = [
  { href: "/book", title: "Book an appointment", phrases: ["book an appointment", "schedule an appointment", "make an appointment", "book online", "schedule a visit"] },
  { href: "/self-pay", title: "Self Pay", phrases: ["self-pay", "self pay", "visit prices", "pricing", "cost of a visit"] },
  { href: "/insurance", title: "Insurance", phrases: ["insurance plans", "your insurance", "insurance coverage"] },
  { href: "/contact", title: "Our offices", phrases: ["our offices", "our office", "Maryvale", "Arrowhead", "Glendale office", "Phoenix office"] },
];

/**
 * Pages an article can suggest links to: services, providers, booking,
 * pricing, the offices, and other published articles (on their focus keyword
 * or title).
 */
export async function linkTargets(): Promise<LinkTarget[]> {
  await loadProviders();
  const targets: LinkTarget[] = services.map((service, index) => ({
    href: `/services#service-${index + 1}`,
    title: service.title,
    phrases: SERVICE_PHRASES[service.title] ?? [service.title],
  }));
  for (const provider of getAllProviders().filter((item) => item.active)) {
    const plain = provider.name.replace(/,.*$/, "").trim();
    const last = plain.split(/\s+/).at(-1) ?? plain;
    const phrases = [plain, plain.replace(/^Dr\.?\s+/i, "")];
    if (/^Dr\.?\s/i.test(plain)) phrases.push(`Dr. ${last}`);
    targets.push({ href: `/about#provider-${provider.id}`, title: provider.name, phrases });
  }
  targets.push(...PAGE_TARGETS);
  for (const article of await listLiveArticles()) {
    const phrases = [article.focusKeyword, article.title].filter(Boolean);
    targets.push({ href: `/blog/${article.slug}`, title: article.title, phrases });
  }
  return targets;
}

/** Every article's address — what the editor checks links against. */
export async function articleSlugs(): Promise<string[]> {
  return otherSlugs(await articles());
}
