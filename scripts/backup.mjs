/**
 * Copies the whole database to a folder: one Extended-JSON file per
 * collection (check-in photos and provider photos too — GridFS is just two
 * collections), plus a manifest with document counts.
 *
 *   npm run backup                         → backups/<db>-<timestamp>/
 *   npm run backup -- --out D:/safe/place   → somewhere else
 *
 * The files hold patient health information. Keep them encrypted and off
 * shared drives; backups/ is git-ignored. This is a manual copy for moving
 * or keeping a snapshot — the production database should also have its
 * host's automatic backups switched on (see README → Backups).
 */
import "./load-env.mjs";
import fs from "node:fs";
import path from "node:path";
import { BSON, MongoClient } from "mongodb";

function arg(name) {
  const index = process.argv.indexOf(`--${name}`);
  return index !== -1 ? process.argv[index + 1] : undefined;
}

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB ?? "arizona";
if (!uri) {
  console.error("MONGODB_URI is not set.");
  process.exit(1);
}

const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const out = path.resolve(arg("out") ?? path.join("backups", `${dbName}-${stamp}`));
fs.mkdirSync(out, { recursive: true });

const client = new MongoClient(uri, { serverSelectionTimeoutMS: 8000 });
try {
  await client.connect();
  const db = client.db(dbName);
  const collections = (await db.listCollections({}, { nameOnly: true }).toArray())
    .map((item) => item.name)
    .filter((name) => !name.startsWith("system."))
    .sort();

  const manifest = { database: dbName, createdAt: new Date().toISOString(), collections: {} };
  for (const name of collections) {
    const file = path.join(out, `${name}.json`);
    const stream = fs.createWriteStream(file);
    let count = 0;
    stream.write("[\n");
    for await (const doc of db.collection(name).find()) {
      stream.write(`${count ? ",\n" : ""}${BSON.EJSON.stringify(doc, { relaxed: false })}`);
      count += 1;
    }
    stream.write("\n]\n");
    await new Promise((resolve, reject) => stream.end((error) => (error ? reject(error) : resolve())));
    manifest.collections[name] = count;
    console.log(`  ${name.padEnd(28)} ${count}`);
  }
  fs.writeFileSync(path.join(out, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`\nBackup of ${dbName} written to ${out}`);
  console.log("It contains patient health information — store it encrypted.");
} finally {
  await client.close();
}
