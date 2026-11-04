/** Preview deployments stay away from real patients:  npm test */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { databaseProblem, isPreviewDeploy, mailAllowed } from "@/lib/deploy-env";

const preview = { VERCEL_ENV: "preview" };

describe("deployment kind", () => {
  it("only Vercel previews and `vercel dev` count as previews", () => {
    assert.equal(isPreviewDeploy({ VERCEL_ENV: "production" }), false);
    assert.equal(isPreviewDeploy({}), false);
    assert.equal(isPreviewDeploy(preview), true);
    assert.equal(isPreviewDeploy({ VERCEL_ENV: "development" }), true);
  });
});

describe("database guard", () => {
  it("leaves production and local machines alone", () => {
    assert.equal(databaseProblem({ VERCEL_ENV: "production", MONGODB_DB: "arizona" }), null);
    assert.equal(databaseProblem({ MONGODB_DB: "arizona" }), null);
  });
  for (const name of ["arizona", "", "staging_arizona", "arizonastaging", "arizona_staging_old"]) {
    it(`refuses a preview on "${name}"`, () => {
      assert.match(databaseProblem({ ...preview, MONGODB_DB: name, STAGING_DATABASE_CONFIRMED: "1" }) ?? "", /staging database/);
    });
  }
  it("needs the staging confirmation too", () => {
    assert.match(databaseProblem({ ...preview, MONGODB_DB: "arizona_staging" }) ?? "", /STAGING_DATABASE_CONFIRMED/);
    assert.equal(databaseProblem({ ...preview, MONGODB_DB: "arizona_staging", STAGING_DATABASE_CONFIRMED: "1" }), null);
    assert.equal(databaseProblem({ ...preview, MONGODB_DB: "arizona-preview", STAGING_DATABASE_CONFIRMED: "1" }), null);
  });
});

describe("mail guard", () => {
  it("production and local machines send normally", () => {
    assert.equal(mailAllowed("patient@example.com", { VERCEL_ENV: "production" }), true);
    assert.equal(mailAllowed("patient@example.com", {}), true);
  });
  it("a preview sends nothing by default", () => assert.equal(mailAllowed("patient@example.com", preview), false));
  it("a preview sends only to listed staff test inboxes", () => {
    const env = { ...preview, PREVIEW_MAIL_ALLOWLIST: " QA@clinic.test , dev@clinic.test" };
    assert.equal(mailAllowed("qa@clinic.test", env), true);
    assert.equal(mailAllowed("patient@example.com", env), false);
  });
});
