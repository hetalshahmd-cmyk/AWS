import { MongoClient, type Db } from "mongodb";

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB ?? "arizona";

if (!uri) {
  throw new Error("MONGODB_URI is not set. Copy .env.example to .env.local and fill it in.");
}

// Next hot-reloads modules in dev; cache the client on globalThis so we don't
// open a new pool on every reload.
const globalForMongo = globalThis as unknown as { _mongoClient?: Promise<MongoClient> };

const clientPromise =
  globalForMongo._mongoClient ??
  new MongoClient(uri, { serverSelectionTimeoutMS: 8000 }).connect();

if (process.env.NODE_ENV !== "production") globalForMongo._mongoClient = clientPromise;

export async function getDb(): Promise<Db> {
  const client = await clientPromise;
  return client.db(dbName);
}

let indexesReady: Promise<void> | null = null;

/** Called by the API routes before they touch a collection. Runs once. */
export function ensureIndexes(): Promise<void> {
  indexesReady ??= (async () => {
    const db = await getDb();
    await Promise.all([
      db.collection("admins").createIndex({ email: 1 }, { unique: true }),
      db.collection("slots").createIndex({ date: 1, time: 1 }, { unique: true }),
      db.collection("slots").createIndex({ date: 1, active: 1 }),
      db.collection("bookings").createIndex({ createdAt: -1 }),
      db.collection("bookings").createIndex({ date: 1, time: 1 }),
      db.collection("plans").createIndex({ order: 1 }),
    ]);
  })();
  return indexesReady;
}
