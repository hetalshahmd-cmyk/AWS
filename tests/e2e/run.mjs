/**
 * End-to-end tests against a real server and a throwaway database.
 *
 *   npm run test:e2e               build, seed, start, test, clean up
 *   npm run test:e2e -- --no-build  reuse the last `next build`
 *   npm run test:e2e -- --keep      leave the test database for a look afterwards
 *
 * Safety: refuses to run unless MONGODB_URI points at this machine, and only
 * ever touches the "arizona_e2e" database (dropped before and after). Mail
 * goes to a local fake SMTP server; Meta's server events are switched off.
 */
import "../../scripts/load-env.mjs";
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { MongoClient } from "mongodb";
import { client, reporter, sleep } from "./lib.mjs";
import * as browser from "./browser.mjs";
import * as doctors from "./doctors.mjs";
import * as schedule from "./schedule.mjs";
import * as security from "./security.mjs";
import * as siteContent from "./site.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const DB = "arizona_e2e";
const PORT = Number(process.env.E2E_PORT ?? 3111);
const SMTP_PORT = Number(process.env.E2E_SMTP_PORT ?? 2526);
const BASE = `http://localhost:${PORT}`;
const ADMIN = { email: "admin@e2e.test", password: "E2e-admin-pass-1" };
const DOCTOR = { email: "denton@arizonawomen.com", password: "E2e-doctor-pass-1" };
const NEXT_BIN = path.join(root, "node_modules", "next", "dist", "bin", "next");

const uri = process.env.MONGODB_URI ?? "";
const host = (() => {
  try {
    return new URL(uri).hostname;
  } catch {
    return "";
  }
})();
if (!["localhost", "127.0.0.1", "::1", "mongo"].includes(host)) {
  console.error(`Refusing to run: MONGODB_URI must point at this machine (got "${host || "nothing"}").`);
  process.exit(1);
}
if (!process.env.SESSION_SECRET) {
  console.error("SESSION_SECRET is not set.");
  process.exit(1);
}

const run = (args, env = {}) => {
  const result = spawnSync(process.execPath, args, { cwd: root, stdio: "inherit", env: { ...process.env, ...env } });
  if (result.status !== 0) throw new Error(`failed: node ${args.join(" ")}`);
};
const waitForPort = async (port) => {
  for (let i = 0; i < 120; i += 1) {
    const open = await new Promise((resolve) => {
      const socket = net.connect(port, "127.0.0.1", () => {
        socket.end();
        resolve(true);
      });
      socket.on("error", () => resolve(false));
    });
    if (open) return;
    await sleep(500);
  }
  throw new Error(`nothing listening on ${port}`);
};
const dropDb = async () => {
  const mongo = await MongoClient.connect(uri);
  await mongo.db(DB).dropDatabase();
  await mongo.close();
};

const mailDir = fs.mkdtempSync(path.join(os.tmpdir(), "awsp-mail-"));
let server;
let sink;
let mongo;
const { check, results } = reporter();

try {
  if (!process.argv.includes("--no-build")) run([NEXT_BIN, "build"]);

  await dropDb();
  const seedEnv = { MONGODB_DB: DB };
  run(["scripts/seed.mjs", "--email", ADMIN.email, "--password", ADMIN.password, "--name", "E2E Admin", "--doctors", "--doctor-password", DOCTOR.password], seedEnv);
  run(["scripts/seed-demo.mjs"], seedEnv);

  sink = spawn(process.execPath, [path.join(root, "tests/e2e/smtp-sink.mjs"), mailDir, String(SMTP_PORT)], { stdio: "ignore" });
  server = spawn(process.execPath, [NEXT_BIN, "start", "-p", String(PORT)], {
    cwd: root,
    stdio: ["ignore", "ignore", "inherit"],
    env: {
      ...process.env,
      MONGODB_DB: DB,
      SMTP_HOST: "127.0.0.1",
      SMTP_PORT: String(SMTP_PORT),
      SMTP_SECURE: "false",
      SMTP_USER: "sink@example.com",
      SMTP_PASS: "sinkpass",
      SMTP_FROM: "Arizona Women Specialists <info@example.com>",
      META_CAPI_ACCESS_TOKEN: "disabled-for-test",
      HEALTH_KEY: "",
      TRUST_PROXY_HEADERS: "1",
    },
  });
  await waitForPort(SMTP_PORT);
  await waitForPort(PORT);

  mongo = await MongoClient.connect(uri);
  const ctx = { call: client(BASE), check, base: BASE, db: mongo.db(DB), mailDir, admin: ADMIN, doctor: DOCTOR, root };
  // Order matters: Doctors & Settings changes the admin's password, so it runs last.
  for (const suite of [schedule, security, browser, siteContent, doctors]) await suite.run(ctx);
} catch (error) {
  check(`run finished without crashing`, false, error instanceof Error ? error.stack ?? error.message : String(error));
} finally {
  await mongo?.close().catch(() => undefined);
  server?.kill();
  sink?.kill();
  await sleep(500);
  if (!process.argv.includes("--keep")) await dropDb().catch(() => undefined);
  fs.rmSync(mailDir, { recursive: true, force: true });
}

const failed = results.filter((result) => !result.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length) console.log(`Failed:\n  - ${failed.map((result) => result.name).join("\n  - ")}`);
process.exit(failed.length ? 1 : 0);
