/**
 * The AI article writer: topics, drafts, the daily run and what it cost.
 *
 * A draft is written by Claude (an economical model by default), assembled by
 * lib/article-ai.ts, saved as an ordinary article and — when a reviewing
 * doctor is chosen — sent straight to that doctor's review queue. Nothing the
 * writer makes is ever public: publishing still needs the doctor's approval
 * and an admin's click (lib/articles-repo.ts).
 *
 * The writer reads public site content only — services, offices, published
 * article titles. Never bookings, patients or users.
 */
import Anthropic from "@anthropic-ai/sdk";
import { MongoServerError, ObjectId } from "mongodb";
import {
  assembleArticle,
  cleanTopicInput,
  DEFAULT_ARTICLE_MODEL,
  DEFAULT_TOPICS,
  estimateCost,
  findDuplicate,
  OUTPUT_SCHEMA,
  parseWriterOutput,
  SYSTEM_PROMPT,
  TopicError,
  topicKey,
  userPrompt,
  WriterError,
  type Topic,
  type TopicInput,
  type TopicStatus,
  type WriterContext,
} from "./article-ai";
import type { Article } from "./articles";
import { articleAction, articleSlugs, createArticle, linkTargets, listArticles, listReviewers } from "./articles-repo";
import { ensureIndexes, getDb } from "./db";
import type { Admin } from "./models";
import { loadSiteContent } from "./repo";
import { arizonaTodayIso } from "./scheduling";
import { getOffices } from "./site-content";
import { services, site } from "./site";

type TopicDoc = TopicInput & {
  _id: ObjectId;
  key: string;
  status: TopicStatus;
  attempts: number;
  lastError: string | null;
  articleId: string | null;
  lockedAt: Date | null;
  createdAt: Date;
  usedAt: Date | null;
  source: "starter" | "admin";
};

export type Generation = {
  id: string;
  at: string;
  trigger: "manual" | "daily";
  by: string;
  topic: string;
  model: string;
  status: "ok" | "failed";
  error: string | null;
  articleId: string | null;
  inputTokens: number;
  outputTokens: number;
  costUsd: number | null;
  sentTo: string | null;
};

type GenerationDoc = Omit<Generation, "id" | "at"> & { _id: ObjectId; at: Date; day: string; topicId: string | null };

export type Automation = {
  /** The daily draft runs only when this is on (and an API key is set). */
  enabled: boolean;
  /** The doctor daily drafts are sent to; none = drafts wait for an admin. */
  reviewerId: string | null;
  updatedAt: string | null;
  updatedBy: string | null;
};

type AutomationDoc = { _id: string; enabled: boolean; reviewerId: string | null; topicsSeeded?: boolean; updatedAt?: Date; updatedBy?: string };

const AUTOMATION_DOC = "articleAutomation";
/** A topic stuck "generating" this long (a crashed run) can be picked again. */
const STALE_LOCK_MS = 10 * 60_000;
/** Topics that failed this often are left for an admin to look at. */
const MAX_ATTEMPTS = 3;
/** Clicks of "Generate with AI" per day — a guard against runaway spending. */
export const DAILY_MANUAL_LIMIT = 10;

/** Who the history names when the daily run writes a draft. */
export const DAILY_WRITER: Admin = {
  id: "system:article-writer",
  email: "",
  name: "AI article writer (daily)",
  createdAt: "",
  lastLoginAt: null,
  role: "admin",
  providerId: null,
};

export class WriterUnavailableError extends Error {
  constructor(message = "The AI writer isn't set up: ANTHROPIC_API_KEY is missing on the server") {
    super(message);
    this.name = "WriterUnavailableError";
  }
}

export class WriterLimitError extends Error {
  constructor() {
    super(`The AI writer has made ${DAILY_MANUAL_LIMIT} drafts today — try again tomorrow`);
    this.name = "WriterLimitError";
  }
}

export const articleModel = () => process.env.ARTICLE_AI_MODEL?.trim() || DEFAULT_ARTICLE_MODEL;
export const writerConfigured = () => Boolean(process.env.ANTHROPIC_API_KEY?.trim());

async function db() {
  await ensureIndexes();
  const database = await getDb();
  return {
    topics: database.collection<TopicDoc>("article_topics"),
    generations: database.collection<GenerationDoc>("article_generations"),
    settings: database.collection<AutomationDoc>("settings"),
    dailyRuns: database.collection<{ _id: string; at: Date }>("article_daily_runs"),
  };
}

/* -------------------------------------------------------------- settings -- */

export async function getAutomation(): Promise<Automation> {
  const { settings } = await db();
  const doc = await settings.findOne({ _id: AUTOMATION_DOC });
  return {
    enabled: doc?.enabled ?? false,
    reviewerId: doc?.reviewerId ?? null,
    updatedAt: doc?.updatedAt?.toISOString() ?? null,
    updatedBy: doc?.updatedBy ?? null,
  };
}

export async function saveAutomation(input: { enabled?: unknown; reviewerId?: unknown }, staff: Admin): Promise<Automation> {
  const reviewers = await listReviewers();
  const reviewerId = input.reviewerId === null || input.reviewerId === "" ? null : String(input.reviewerId ?? "");
  if (reviewerId && !reviewers.some((reviewer) => reviewer.providerId === reviewerId)) {
    throw new TopicError("Choose a doctor with a sign-in");
  }
  const { settings } = await db();
  await settings.updateOne(
    { _id: AUTOMATION_DOC },
    { $set: { enabled: input.enabled === true, reviewerId, updatedAt: new Date(), updatedBy: staff.name } },
    { upsert: true },
  );
  return getAutomation();
}

/* ---------------------------------------------------------------- topics -- */

function serializeTopic(doc: TopicDoc): Topic {
  return {
    id: doc._id.toString(),
    title: doc.title,
    focusKeyword: doc.focusKeyword,
    category: doc.category,
    location: doc.location,
    notes: doc.notes,
    status: doc.status,
    attempts: doc.attempts,
    lastError: doc.lastError,
    articleId: doc.articleId,
    createdAt: doc.createdAt.toISOString(),
    usedAt: doc.usedAt?.toISOString() ?? null,
  };
}

let topicsSeeded = false;

/** Writes the starting topics once, on a database that has never had them. */
async function seedTopics(): Promise<void> {
  if (topicsSeeded) return;
  const { topics, settings } = await db();
  if (await settings.countDocuments({ _id: AUTOMATION_DOC, topicsSeeded: true }, { limit: 1 })) {
    topicsSeeded = true;
    return;
  }
  // Marks the database first, so two first requests at once seed only once.
  const marked = await settings
    .updateOne(
      { _id: AUTOMATION_DOC, topicsSeeded: { $ne: true } },
      { $set: { topicsSeeded: true }, $setOnInsert: { enabled: false, reviewerId: null } },
      { upsert: true },
    )
    .catch((error: unknown) => {
      if (error instanceof MongoServerError && error.code === 11000) return null;
      throw error;
    });
  topicsSeeded = true;
  if (!marked || (marked.modifiedCount === 0 && marked.upsertedCount === 0)) return;
  const base = Date.now();
  const docs: TopicDoc[] = DEFAULT_TOPICS.map((topic, index) => ({
    _id: new ObjectId(),
    ...topic,
    notes: "",
    key: topicKey(topic.focusKeyword),
    status: "queued",
    attempts: 0,
    lastError: null,
    articleId: null,
    lockedAt: null,
    // Keeps the starting order: oldest first is written first.
    createdAt: new Date(base + index),
    usedAt: null,
    source: "starter",
  }));
  await topics.insertMany(docs, { ordered: false }).catch(() => undefined);
}

const STATUS_ORDER: Record<TopicStatus, number> = { generating: 0, queued: 1, used: 2, skipped: 3 };

export async function listTopics(): Promise<Topic[]> {
  await seedTopics();
  const { topics } = await db();
  const docs = await topics.find().sort({ createdAt: 1 }).toArray();
  return docs.map(serializeTopic).sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]);
}

/** What a new topic must not repeat: other topics and existing articles. */
async function duplicateOf(focusKeyword: string, exceptTopicId?: ObjectId): Promise<string | null> {
  const { topics } = await db();
  const [topicDocs, articles] = await Promise.all([
    topics.find(exceptTopicId ? { _id: { $ne: exceptTopicId } } : {}, { projection: { title: 1, focusKeyword: 1 } }).toArray(),
    listArticles(),
  ]);
  return findDuplicate(focusKeyword, [
    ...topicDocs.map((topic) => ({ label: `the topic "${topic.title}"`, phrase: topic.focusKeyword })),
    ...articles.flatMap((article) => [
      { label: `the article "${article.title}"`, phrase: article.focusKeyword },
      { label: `the article "${article.title}"`, phrase: article.title },
    ]),
  ]);
}

export async function addTopic(input: unknown): Promise<Topic> {
  await seedTopics();
  const clean = cleanTopicInput(input);
  const duplicate = await duplicateOf(clean.focusKeyword);
  if (duplicate) throw new TopicError(`That is the same topic as ${duplicate}`);
  const { topics } = await db();
  const doc: TopicDoc = {
    _id: new ObjectId(),
    ...clean,
    key: topicKey(clean.focusKeyword),
    status: "queued",
    attempts: 0,
    lastError: null,
    articleId: null,
    lockedAt: null,
    createdAt: new Date(),
    usedAt: null,
    source: "admin",
  };
  try {
    await topics.insertOne(doc);
  } catch (error) {
    if (error instanceof MongoServerError && error.code === 11000) throw new TopicError("That focus keyword is already on the list");
    throw error;
  }
  return serializeTopic(doc);
}

/** Skip a topic, or put it back in the queue (which also clears its failures). */
export async function setTopicStatus(id: string, status: "queued" | "skipped"): Promise<Topic | null> {
  if (!ObjectId.isValid(id)) return null;
  const { topics } = await db();
  const doc = await topics.findOneAndUpdate(
    { _id: new ObjectId(id), status: { $in: ["queued", "skipped"] } },
    { $set: { status, ...(status === "queued" ? { attempts: 0, lastError: null } : {}) } },
    { returnDocument: "after" },
  );
  return doc ? serializeTopic(doc) : null;
}

export async function deleteTopic(id: string): Promise<boolean> {
  if (!ObjectId.isValid(id)) return false;
  const { topics } = await db();
  const result = await topics.deleteOne({ _id: new ObjectId(id), status: { $ne: "generating" } });
  return result.deletedCount === 1;
}

/** Takes a topic for writing so two runs never write the same one. */
async function claimTopic(topicId: string | null): Promise<TopicDoc | null> {
  const { topics } = await db();
  const now = new Date();
  const available = {
    $or: [{ status: "queued" as const }, { status: "generating" as const, lockedAt: { $lt: new Date(now.getTime() - STALE_LOCK_MS) } }],
  };
  const filter = topicId
    ? { _id: ObjectId.isValid(topicId) ? new ObjectId(topicId) : new ObjectId("000000000000000000000000"), ...available }
    : { ...available, attempts: { $lt: MAX_ATTEMPTS } };
  return topics.findOneAndUpdate(
    filter,
    { $set: { status: "generating", lockedAt: now } },
    { sort: { createdAt: 1 }, returnDocument: "after" },
  );
}

/* ---------------------------------------------------------- the writing -- */

/** Asks Claude for the article. Returns the checked answer and what it used. */
async function askClaude(context: WriterContext, model: string) {
  // Reads ANTHROPIC_API_KEY (and ANTHROPIC_BASE_URL, used by the tests).
  const client = new Anthropic({ timeout: 4 * 60_000, maxRetries: 2 });
  const response = await client.messages.create({
    model,
    max_tokens: 16000,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userPrompt(context) }],
    output_config: { effort: "medium", format: { type: "json_schema", schema: OUTPUT_SCHEMA } },
  });
  const usage = { inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens };
  if (response.stop_reason === "refusal") throw Object.assign(new WriterError("The AI declined to write about this topic"), { usage });
  if (response.stop_reason === "max_tokens") throw Object.assign(new WriterError("The AI's answer was cut off — try again"), { usage });
  const text = response.content.flatMap((block) => (block.type === "text" ? [block.text] : [])).join("");
  try {
    return { output: parseWriterOutput(text), usage };
  } catch (error) {
    throw Object.assign(error as Error, { usage });
  }
}

const errorMessage = (error: unknown) =>
  error instanceof WriterError || error instanceof TopicError
    ? error.message
    : error instanceof Anthropic.APIError
      ? `The AI service answered ${error.status ?? "with an error"} — try again later`
      : "Something went wrong while writing";

export type GenerateRequest = {
  trigger: "manual" | "daily";
  staff: Admin;
  /** A topic from the list; none = the next one in the queue. */
  topicId?: string | null;
  /** Or a one-off topic typed in by an admin (added to the list as used). */
  customTopic?: unknown;
  /** Send the draft to this doctor's review queue; none = leave it as a draft. */
  reviewerId?: string | null;
};

export type GenerateResult = { article: Article; generation: Generation; sentTo: string | null; warning: string | null };

/**
 * Writes one draft. Throws WriterUnavailableError (no API key), WriterLimitError
 * (too many today), TopicError (no topic, duplicate) or WriterError (bad answer).
 */
export async function generateArticle(request: GenerateRequest): Promise<GenerateResult> {
  if (!writerConfigured()) throw new WriterUnavailableError();
  await seedTopics();
  const { topics, generations } = await db();
  const day = arizonaTodayIso();
  if (request.trigger === "manual") {
    const today = await generations.countDocuments({ day, trigger: "manual" });
    if (today >= DAILY_MANUAL_LIMIT) throw new WriterLimitError();
  }

  // The reviewer is checked before any money is spent.
  const reviewers = await listReviewers();
  const reviewer = request.reviewerId ? reviewers.find((item) => item.providerId === request.reviewerId) : null;
  if (request.reviewerId && !reviewer) throw new TopicError("Choose a doctor with a sign-in to review it");

  let topic: TopicDoc | null;
  if (request.customTopic) {
    const clean = cleanTopicInput(request.customTopic);
    const duplicate = await duplicateOf(clean.focusKeyword);
    if (duplicate) throw new TopicError(`That is the same topic as ${duplicate}`);
    topic = {
      _id: new ObjectId(),
      ...clean,
      key: topicKey(clean.focusKeyword),
      status: "generating",
      attempts: 0,
      lastError: null,
      articleId: null,
      lockedAt: new Date(),
      createdAt: new Date(),
      usedAt: null,
      source: "admin",
    };
    try {
      await topics.insertOne(topic);
    } catch (error) {
      if (error instanceof MongoServerError && error.code === 11000) throw new TopicError("That focus keyword is already on the list");
      throw error;
    }
  } else {
    topic = await claimTopic(request.topicId ?? null);
    if (!topic) {
      throw new TopicError(request.topicId ? "That topic isn't waiting in the queue" : "No topics are waiting — add some under Topics");
    }
  }

  const model = articleModel();
  const started = Date.now();
  let usage = { inputTokens: 0, outputTokens: 0 };
  const log = async (fields: Partial<GenerationDoc>): Promise<Generation> => {
    const doc: GenerationDoc = {
      _id: new ObjectId(),
      at: new Date(),
      day,
      trigger: request.trigger,
      by: request.staff.name,
      topic: topic.title,
      topicId: topic._id.toString(),
      model,
      status: "ok",
      error: null,
      articleId: null,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      costUsd: estimateCost(model, usage.inputTokens, usage.outputTokens),
      sentTo: null,
      ...fields,
    };
    await generations.insertOne(doc);
    return serializeGeneration(doc);
  };

  try {
    // Already covered by an article written since the topic was added?
    const covered = await duplicateOf(topic.focusKeyword, topic._id);
    if (covered?.startsWith("the article")) throw new TopicError(`Already covered by ${covered}`);

    await loadSiteContent().catch(() => undefined);
    const [targets, slugs, existing] = await Promise.all([linkTargets(), articleSlugs(), listArticles()]);
    const context: WriterContext = {
      topic,
      practiceName: site.name,
      offices: getOffices().map((office) => ({ name: office.name, area: office.area, city: office.address[1] ?? "" })),
      services: services.map((service) => ({ title: service.title, body: service.body })),
      targets,
      existing: existing.map((article) => ({ title: article.title, focusKeyword: article.focusKeyword })),
    };

    const answer = await askClaude(context, model);
    usage = answer.usage;
    const content = assembleArticle(answer.output, { topic, targets, articleSlugs: slugs, takenSlugs: slugs });
    let article = await createArticle(content, request.staff, {
      origin: { type: "ai", model, topicId: topic._id.toString() },
      note: `AI draft (${model}) from the topic "${topic.title}" — check every medical statement against its references`,
    });

    let warning: string | null = null;
    if (reviewer) {
      try {
        article = (await articleAction(article.id, "submit", request.staff, { hash: article.hash, reviewerId: reviewer.providerId })) ?? article;
      } catch (error) {
        warning = `Saved as a draft, not sent for review: ${error instanceof Error ? error.message : "unknown reason"}`;
      }
    }
    const sentTo = article.status === "in_review" ? (reviewer?.name ?? null) : null;

    await topics.updateOne(
      { _id: topic._id },
      { $set: { status: "used", articleId: article.id, usedAt: new Date(), lockedAt: null, lastError: null } },
    );
    const generation = await log({ status: "ok", articleId: article.id, sentTo });
    console.info(`article writer: "${article.title}" in ${Math.round((Date.now() - started) / 1000)}s`);
    return { article, generation, sentTo, warning };
  } catch (error) {
    const usageFromError = (error as { usage?: typeof usage }).usage;
    if (usageFromError) usage = usageFromError;
    const message = errorMessage(error);
    if (!(error instanceof WriterError || error instanceof TopicError)) console.error("article writer failed", error);
    const duplicate = error instanceof TopicError && message.startsWith("Already covered");
    await topics.updateOne(
      { _id: topic._id },
      {
        $set: { status: duplicate ? "skipped" : "queued", lockedAt: null, lastError: message },
        ...(duplicate ? {} : { $inc: { attempts: 1 } }),
      },
    );
    await log({ status: "failed", error: message });
    throw error instanceof WriterError || error instanceof TopicError ? error : new WriterError(message);
  }
}

/* ------------------------------------------------------- the daily run -- */

export type DailyResult =
  | { done: true; articleId: string; title: string; sentTo: string | null; warning: string | null }
  | { done: false; reason: string };

/**
 * One draft a day, called by the scheduler. Off unless switched on in the
 * admin panel; claims the day first, so a repeated call writes nothing more.
 */
export async function runDailyGeneration(): Promise<DailyResult> {
  const automation = await getAutomation();
  if (!automation.enabled) return { done: false, reason: "Daily drafts are switched off" };
  if (!writerConfigured()) return { done: false, reason: "ANTHROPIC_API_KEY is not set" };
  const { dailyRuns } = await db();
  const day = arizonaTodayIso();
  try {
    await dailyRuns.insertOne({ _id: day, at: new Date() });
  } catch (error) {
    if (error instanceof MongoServerError && error.code === 11000) return { done: false, reason: `Already ran for ${day}` };
    throw error;
  }
  // A doctor removed since the setting was saved: the draft waits for an admin.
  const reviewers = await listReviewers();
  const reviewerId = reviewers.some((reviewer) => reviewer.providerId === automation.reviewerId) ? automation.reviewerId : null;
  try {
    const result = await generateArticle({ trigger: "daily", staff: DAILY_WRITER, reviewerId });
    return { done: true, articleId: result.article.id, title: result.article.title, sentTo: result.sentTo, warning: result.warning };
  } catch (error) {
    return { done: false, reason: error instanceof Error ? error.message : "Writing failed" };
  }
}

/* ------------------------------------------------------------- the log -- */

function serializeGeneration(doc: GenerationDoc): Generation {
  return {
    id: doc._id.toString(),
    at: doc.at.toISOString(),
    trigger: doc.trigger,
    by: doc.by,
    topic: doc.topic,
    model: doc.model,
    status: doc.status,
    error: doc.error,
    articleId: doc.articleId,
    inputTokens: doc.inputTokens,
    outputTokens: doc.outputTokens,
    costUsd: doc.costUsd,
    sentTo: doc.sentTo,
  };
}

export async function listGenerations(limit = 15): Promise<Generation[]> {
  const { generations } = await db();
  const docs = await generations.find().sort({ at: -1 }).limit(limit).toArray();
  return docs.map(serializeGeneration);
}

/** What the writer has cost this calendar month (Arizona time), in US dollars. */
export async function monthUsage(): Promise<{ drafts: number; failed: number; costUsd: number }> {
  const { generations } = await db();
  const month = arizonaTodayIso().slice(0, 7);
  const docs = await generations
    .find({ day: { $gte: `${month}-01`, $lte: `${month}-31` } }, { projection: { status: 1, costUsd: 1 } })
    .toArray();
  return {
    drafts: docs.filter((doc) => doc.status === "ok").length,
    failed: docs.filter((doc) => doc.status === "failed").length,
    costUsd: docs.reduce((sum, doc) => sum + (doc.costUsd ?? 0), 0),
  };
}

