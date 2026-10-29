/**
 * Loads a folder written by `npm run backup` into a database.
 *
 *   npm run restore -- backups/arizona-2026-10-06T10-00-00 --db arizona_restore
 *   npm run restore -- <folder> --db arizona --replace     (overwrite a database)
 *
 * Refuses to write into a database that already has data unless --replace is
 * given, and then asks you to type the database name to confirm. Indexes are
 * not in the backup; the app recreates them on first start (ensureIndexes).
 */
import "./load-env.mjs";
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline/promises";
import { BSON, MongoClient } from "mongodb";

function arg(name) {
  const index = process.argv.indexOf(`--${name}`);
  return index !== -1 ? process.argv[index + 1] : undefined;
}

const folder = process.argv[2] && !process.argv[2].startsWith("--") ? path.resolve(process.argv[2]) : null;
const target = arg("db");
const replace = process.argv.includes("--replace");
const uri = process.env.MONGODB_URI;

if (!folder || !fs.existsSync(path.join(folder, "manifest.json"))) {
  console.error("Give the backup folder (the one with manifest.json) as the first argument.");
  process.exit(1);
}
if (!target) {
  console.error("Give the database to restore into: --db <name>.");
  process.exit(1);
}
if (!uri) {
  console.error("MONGODB_URI is not set.");
  process.exit(1);
}

const manifest = JSON.parse(fs.readFileSync(path.join(folder, "manifest.json"), "utf8"));
const client = new MongoClient(uri, { serverSelectionTimeoutMS: 8000 });
try {
  await client.connect();
  const db = client.db(target);
  const existing = (await db.listCollections({}, { nameOnly: true }).toArray()).map((item) => item.name);
  if (existing.length && !replace) {
    console.error(`${target} already has data. Restore into an empty database, or add --replace.`);
    process.exit(1);
  }
  if (existing.length && replace) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const answer = await rl.question(`This deletes everything in "${target}". Type the name to continue: `);
    rl.close();
    if (answer.trim() !== target) {
      console.error("Not confirmed — nothing changed.");
      process.exit(1);
    }
    await db.dropDatabase();
  }

  for (const [name, expected] of Object.entries(manifest.collections)) {
    const docs = BSON.EJSON.parse(fs.readFileSync(path.join(folder, `${name}.json`), "utf8"), { relaxed: false });
    for (let i = 0; i < docs.length; i += 1000) {
      await db.collection(name).insertMany(docs.slice(i, i + 1000), { ordered: false });
    }
    const count = await db.collection(name).countDocuments();
    console.log(`  ${name.padEnd(28)} ${count}${count === expected ? "" : `  (expected ${expected})`}`);
  }
  console.log(`\nRestored ${manifest.database} (${manifest.createdAt}) into ${target}.`);
} finally {
  await client.close();
}
