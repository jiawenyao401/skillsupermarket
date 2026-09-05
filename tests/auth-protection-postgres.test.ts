import test from "node:test";
import assert from "node:assert/strict";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { eq, sql } from "drizzle-orm";
import { registrationProtection } from "../lib/auth-protection";
import { EmailVerificationRequiredError } from "../lib/email-verification";

// Deliberately opt-in and local-only. Never use the project's DATABASE_URL for
// this mutating test. Initialize the empty database with the current schema
// (db:push); historical migrations assume the initial product tables exist.
const testURL = process.env.AUTH_TEST_DATABASE_URL;
if (!testURL) throw new Error("AUTH_TEST_DATABASE_URL must point to a disposable local test database");
const parsed = new URL(testURL);
if (!["127.0.0.1", "localhost"].includes(parsed.hostname) || parsed.pathname !== "/skillsupermarket_auth_test") {
  throw new Error("Only a local skillsupermarket_auth_test database is allowed");
}
process.env.DATABASE_URL = testURL;
process.env.BETTER_AUTH_SECRET = "isolated-auth-test-secret-at-least-32-characters";
process.env.ABUSE_HASH_SECRET = "isolated-email-throttle-secret";

test("PostgreSQL registration limits, OTP consumption and quota gate", async (t) => {
  const { db, schema } = await import("../lib/db");
  const { reserveVerificationEmail } = await import("../lib/auth-email-limit");
  const { reserveQuotaAndCreateJob, getQuotaSnapshot } = await import("../lib/quota");
  t.after(async () => {
    const connection = (globalThis as unknown as { client?: { end: () => Promise<void> } }).client;
    await connection?.end();
  });
  assert.equal((await db.select().from(schema.user)).length, 0, "test database must be empty");
  assert.equal((await db.select().from(schema.rateLimit)).length, 0);
  assert.equal((await db.select().from(schema.evaluationQuotaUsage)).length, 0);

  await t.test("concurrent requests share atomic email limits, failures roll back", async () => {
    const results = await Promise.allSettled(Array.from({ length: 20 }, (_, i) => reserveVerificationEmail(i % 2 ? " Rate@Test.example " : "rate@test.example")));
    assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
    let rows = await db.select().from(schema.rateLimit);
    assert.equal(rows.length, 2);
    assert.ok(rows.every((r) => r.count === 1 && !r.key.includes("test.example")));
    for (let i = 1; i < 5; i++) {
      await db.update(schema.rateLimit).set({ lastRequest: Date.now() - 61_000 }).where(sql`key LIKE 'verification-email:60000:%'`);
      await reserveVerificationEmail("rate@test.example");
    }
    await db.update(schema.rateLimit).set({ lastRequest: Date.now() - 61_000 }).where(sql`key LIKE 'verification-email:60000:%'`);
    rows = await db.select().from(schema.rateLimit);
    await assert.rejects(reserveVerificationEmail("rate@test.example"), (e: unknown) => (e as { status?: string }).status === "TOO_MANY_REQUESTS");
    assert.deepEqual(await db.select().from(schema.rateLimit), rows, "hour limit failure rolls back minute reservation");
    await db.update(schema.rateLimit).set({ lastRequest: Date.now() - 3_601_000 });
    await reserveVerificationEmail("rate@test.example");
    assert.ok((await db.select().from(schema.rateLimit)).every((r) => r.count === 1));
  });

  await t.test("real adapter keeps unverified users from spending, and consumes a code once", async () => {
    const sent: string[] = [];
    t.mock.method(globalThis, "fetch", async () => Response.json({ success: true, action: "registration", hostname: "localhost" }));
    const auth = betterAuth({
      ...registrationProtection({
        config: { siteKey: "test", secretKey: "test", smtpHost: "smtp.example.invalid", smtpPort: 465, smtpUser: "test", smtpPass: "test", mailFrom: "sender@example.invalid" },
        appURL: "http://localhost:3000", reserveEmail: reserveVerificationEmail,
        sendCode: async (_email, otp) => { sent.push(otp); },
      }),
      baseURL: "http://localhost:3000", secret: process.env.BETTER_AUTH_SECRET,
      database: drizzleAdapter(db, { provider: "pg", schema }),
      verification: { storeIdentifier: "hashed" }, rateLimit: { enabled: false }, logger: { disabled: true },
    });
    const credentials = { email: "pg-member@example.invalid", password: "test-password-12345", name: "PG Test" };
    const request = (path: string, body: Record<string, unknown>) => auth.handler(new Request(`http://localhost:3000/api/auth${path}`, {
      method: "POST", headers: { "Content-Type": "application/json", "x-captcha-response": "test", origin: "http://localhost:3000" }, body: JSON.stringify(body),
    }));
    assert.equal((await request("/sign-up/email", credentials)).status, 200);
    const [member] = await db.select().from(schema.user).where(eq(schema.user.email, credentials.email));
    const [skill] = await db.insert(schema.skills).values({ name: "Isolated test", slug: "isolated-auth-test", type: "claude-skill" }).returning();
    const input = { userId: member.id, skillId: skill.id, networkKey: "test-only-network" };
    assert.equal(member.emailVerified, false);
    assert.equal((await getQuotaSnapshot(member.id)).remaining, 0);
    await assert.rejects(reserveQuotaAndCreateJob(input), EmailVerificationRequiredError);
    assert.equal((await db.select().from(schema.evaluationJobs)).length, 0);
    assert.equal((await db.select().from(schema.evaluationQuotaUsage)).length, 0);
    const stored = JSON.stringify(await db.select().from(schema.verification));
    assert.ok(!stored.includes(sent[0]) && !stored.includes(credentials.email));
    const wrong = sent[0] === "000000" ? "111111" : "000000";
    const errors = await Promise.all(Array.from({ length: 3 }, () => request("/email-otp/verify-email", { email: credentials.email, otp: wrong })));
    assert.ok(errors.every((r) => r.status === 400));
    const [codeRow] = await db.select().from(schema.verification);
    assert.match(codeRow.value, /:3$/, "concurrent wrong attempts must not lose increments");
    const responses = await Promise.all(Array.from({ length: 10 }, () => request("/email-otp/verify-email", { email: credentials.email, otp: sent[0] })));
    assert.equal(responses.filter((r) => r.status === 200).length, 1);
    assert.equal((await request("/sign-in/email", credentials)).status, 200);
    const reserved = await reserveQuotaAndCreateJob(input);
    assert.equal(reserved.quota.used, 1);
    assert.equal((await getQuotaSnapshot(member.id)).remaining, 9);
    assert.equal((await db.select().from(schema.evaluationJobs)).length, 1);
  });
});
