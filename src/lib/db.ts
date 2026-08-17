import { MongoClient, type Db } from "mongodb";

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB ?? "arizona";

if (!uri) {
  throw new Error("MONGODB_URI is not set. Copy .env.example to .env.local and fill it in.");
}

// Next hot-reloads modules in dev; cache the client on globalThis so we don't
// open a new pool on every reload. In serverless the same instance is reused
// across warm invocations, which is why the pool is kept small.
const globalForMongo = globalThis as unknown as { _mongoClient?: Promise<MongoClient> };

const clientPromise =
  globalForMongo._mongoClient ??
  new MongoClient(uri, {
    // Atlas from a cold serverless instance needs more than a couple of seconds
    // to finish DNS (SRV), TLS and replica-set discovery.
    serverSelectionTimeoutMS: 20000,
    connectTimeoutMS: 20000,
    socketTimeoutMS: 45000,
    maxPoolSize: 10,
    retryWrites: true,
  })
    .connect()
    .catch((error: unknown) => {
      // Don't cache a rejected promise — the next request should retry.
      globalForMongo._mongoClient = undefined;
      throw describeConnectionError(error);
    });

if (process.env.NODE_ENV !== "production") globalForMongo._mongoClient = clientPromise;
else globalForMongo._mongoClient ??= clientPromise;

/** Turns Mongo's terse selection error into something actionable in the logs. */
function describeConnectionError(error: unknown): Error {
  const message = error instanceof Error ? error.message : String(error);
  const isSelection = /Server selection timed out|ReplicaSetNoPrimary|ENOTFOUND|ECONNREFUSED/i.test(
    message,
  );

  if (!isSelection) return error instanceof Error ? error : new Error(message);

  return new Error(
    `${message}\n` +
      "Could not reach MongoDB. On Atlas this is almost always Network Access: " +
      "the deployment's outbound IPs are not on the allowlist. Add 0.0.0.0/0 " +
      "(Atlas → Network Access → Add IP Address → Allow access from anywhere) " +
      "for serverless hosting, and check MONGODB_URI's user, password and that " +
      "any special characters in the password are percent-encoded.",
  );
}

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
      db.collection("users").createIndex({ email: 1 }, { unique: true }),
      db.collection("bookings").createIndex({ userId: 1, date: -1 }),
      db.collection("bookings").createIndex({ "patient.email": 1 }),
      db.collection("slots").createIndex({ date: 1, time: 1 }, { unique: true }),
      db.collection("slots").createIndex({ date: 1, active: 1 }),
      db.collection("bookings").createIndex({ createdAt: -1 }),
      db.collection("bookings").createIndex({ date: 1, time: 1 }),
      db.collection("plans").createIndex({ order: 1 }),
      db.collection("email_otps").createIndex({ email: 1 }, { unique: true }),
      // Mongo sweeps expired codes an hour after they lapse.
      db.collection("email_otps").createIndex({ expiresAt: 1 }, { expireAfterSeconds: 3600 }),
    ]);
  })().catch((error: unknown) => {
    // A failed index build shouldn't poison every later request.
    indexesReady = null;
    throw error;
  });

  return indexesReady;
}
