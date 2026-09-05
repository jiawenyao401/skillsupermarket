import test, { type TestContext } from "node:test";
import assert from "node:assert/strict";
import { betterAuth } from "better-auth";
import { memoryAdapter } from "better-auth/adapters/memory";
import { APIError } from "better-auth/api";
import { registrationProtection } from "../lib/auth-protection";
import { getRegistrationConfig, type RegistrationConfig } from "../lib/registration-config";
import { assertVerifiedEmail, EmailVerificationRequiredError } from "../lib/email-verification";

const config: RegistrationConfig = {
  siteKey: "test-site", secretKey: "test-secret", smtpHost: "smtp.example.com", smtpPort: 465,
  smtpUser: "test", smtpPass: "test", mailFrom: "sender@example.com",
};
const credentials = { email: "member@example.com", password: "test-password-12345", name: "Member" };

function fixture(t: TestContext, overrides: { unavailable?: boolean; deliveryFails?: boolean; limited?: boolean; providerFails?: boolean } = {}) {
  const tables: Record<string, Record<string, unknown>[]> = { user: [], account: [], session: [], verification: [] };
  const sent: { email: string; otp: string }[] = [];
  const consumedTokens = new Set<string>();
  let requestId = 0;
  let reservations = 0;
  t.mock.method(globalThis, "fetch", async (input: string | URL | Request, init: RequestInit) => {
    assert.equal(String(input), "https://challenges.cloudflare.com/turnstile/v0/siteverify");
    if (overrides.providerFails) throw new Error("provider unavailable");
    const data = JSON.parse(String(init.body));
    const token = data.response as string;
    const success = token.startsWith("valid-") && !consumedTokens.has(token);
    consumedTokens.add(token);
    return Response.json({ success, action: token.includes("wrong-action") ? "other" : "registration", hostname: token.includes("wrong-host") ? "attacker.example" : "localhost" });
  });
  const auth = betterAuth({
    ...registrationProtection({
      config: overrides.unavailable ? null : config,
      appURL: "http://localhost:3000",
      reserveEmail: async () => {
        reservations++;
        if (overrides.limited) throw new APIError("TOO_MANY_REQUESTS", { code: "EMAIL_RATE_LIMITED", message: "limited" });
      },
      sendCode: async (email, otp) => {
        if (overrides.deliveryFails) throw new APIError("SERVICE_UNAVAILABLE", { code: "EMAIL_DELIVERY_FAILED", message: "delivery failed" });
        sent.push({ email, otp });
      },
    }),
    baseURL: "http://localhost:3000", secret: "test-only-auth-secret-at-least-32-characters",
    database: memoryAdapter(tables),
    trustedOrigins: ["http://localhost:3000"],
    verification: { storeIdentifier: "hashed" },
    rateLimit: { enabled: false },
    logger: { disabled: true },
  });
  function request(path: string, body: Record<string, unknown>, token?: string) {
    requestId++;
    const headers: Record<string, string> = { "content-type": "application/json", origin: "http://localhost:3000" };
    if (token !== undefined) headers["x-captcha-response"] = token;
    return auth.handler(new Request(`http://localhost:3000/api/auth${path}`, { method: "POST", headers, body: JSON.stringify(body) }));
  }
  return { context: auth.$context, tables, sent, request, reservations: () => reservations, signup: (extra = {}) => request("/sign-up/email", { ...credentials, ...extra }, `valid-${requestId}`) };
}

test("registration requires a valid single-use CAPTCHA bound to this host and action", async (t) => {
  const f = fixture(t);
  for (const token of [undefined, "invalid", "valid-wrong-host", "valid-wrong-action"]) {
    const response = await f.request("/sign-up/email", credentials, token);
    assert.ok(response.status >= 400);
  }
  assert.equal(f.tables.user.length, 0);
  assert.equal(f.sent.length, 0);
  const ok = await f.request("/sign-up/email", credentials, "valid-once");
  assert.equal(ok.status, 200);
  const replay = await f.request("/sign-up/email", { ...credentials, email: "other@example.com" }, "valid-once");
  assert.equal(replay.status, 403);
  assert.equal(f.tables.user.length, 1);
});

test("sign-up ignores forged emailVerified and issues no session until verified login", async (t) => {
  const f = fixture(t);
  const signup = await f.signup({ emailVerified: true });
  assert.equal(signup.status, 200);
  assert.equal((await signup.json()).token, null);
  assert.equal(f.tables.user[0].emailVerified, false);
  assert.equal(f.tables.session.length, 0);
  assert.equal(f.sent.length, 1);
  assert.match(f.sent[0].otp, /^\d{6}$/);
  const stored = JSON.stringify(f.tables.verification);
  assert.ok(!stored.includes(f.sent[0].otp));
  assert.ok(!stored.includes(credentials.email));
  assert.throws(() => assertVerifiedEmail(f.tables.user[0]), EmailVerificationRequiredError);
  const login = await f.request("/sign-in/email", credentials);
  assert.equal(login.status, 403);
  assert.equal((await login.json()).code, "EMAIL_NOT_VERIFIED");
  assert.equal(f.sent.length, 1, "login does not send mail without CAPTCHA");
  const verify = await f.request("/email-otp/verify-email", { email: credentials.email, otp: f.sent[0].otp });
  assert.equal(verify.status, 200);
  assert.doesNotThrow(() => assertVerifiedEmail(f.tables.user[0]));
  const verifiedLogin = await f.request("/sign-in/email", credentials);
  assert.equal(verifiedLogin.status, 200);
  assert.ok(verifiedLogin.headers.get("set-cookie"));
  const replay = await f.request("/email-otp/verify-email", { email: credentials.email, otp: f.sent[0].otp });
  assert.equal(replay.status, 400);
});

test("five wrong codes lock out the correct OTP, and expired codes fail", async (t) => {
  const f = fixture(t);
  await f.signup();
  const otp = f.sent[0].otp;
  const wrong = otp === "000000" ? "111111" : "000000";
  for (let i = 0; i < 5; i++) assert.equal((await f.request("/email-otp/verify-email", { email: credentials.email, otp: wrong })).status, 400);
  assert.equal((await f.request("/email-otp/verify-email", { email: credentials.email, otp })).status, 403);
  await f.request("/email-otp/send-verification-otp", { email: credentials.email, type: "email-verification" }, "valid-resend");
  for (const row of f.tables.verification) row.expiresAt = new Date(Date.now() - 1000);
  assert.equal((await f.request("/email-otp/verify-email", { email: credentials.email, otp: f.sent.at(-1)!.otp })).status, 400);
  assert.equal(f.tables.user[0].emailVerified, false);
});

test("resending invalidates the previous code and requires a new CAPTCHA", async (t) => {
  const f = fixture(t);
  await f.signup();
  const oldCode = f.sent[0].otp;
  const body = { email: credentials.email, type: "email-verification" };
  assert.equal((await f.request("/email-otp/send-verification-otp", body)).status, 400);
  assert.equal(f.sent.length, 1);
  assert.equal((await f.request("/email-otp/send-verification-otp", body, "valid-new")).status, 200);
  assert.equal(f.sent.length, 2);
  assert.equal(f.tables.verification.length, 1);
  if (oldCode !== f.sent[1].otp) assert.equal((await f.request("/email-otp/verify-email", { email: credentials.email, otp: oldCode })).status, 400);
  assert.equal((await f.request("/email-otp/verify-email", { email: credentials.email, otp: f.sent[1].otp })).status, 200);
});

test("duplicate sign-up cannot invalidate the owner's pending verification", async (t) => {
  const f = fixture(t);
  await f.signup();
  const original = f.sent[0].otp;
  assert.equal((await f.signup()).status, 200);
  assert.equal(f.sent.length, 1);
  assert.equal((await f.request("/email-otp/verify-email", { email: credentials.email, otp: original })).status, 200);
});

test("a wrong attempt racing a resend cannot recreate the old OTP", async (t) => {
  const f = fixture(t);
  await f.signup();
  const oldCode = f.sent[0].otp;
  const context = await f.context;
  const update = context.adapter.updateMany.bind(context.adapter);
  let release!: () => void;
  let entered!: () => void;
  const paused = new Promise<void>((resolve) => { entered = resolve; });
  const resume = new Promise<void>((resolve) => { release = resolve; });
  let first = true;
  t.mock.method(context.adapter, "updateMany", async (data: Parameters<typeof update>[0]) => {
    if (data.model === "verification" && first) { first = false; entered(); await resume; }
    return update(data);
  });
  const wrong = f.request("/email-otp/verify-email", { email: credentials.email, otp: oldCode === "000000" ? "111111" : "000000" });
  await paused;
  try {
    for (let i = 0; i < 10 && f.sent.at(-1)!.otp === oldCode; i++) {
      assert.equal((await f.request("/email-otp/send-verification-otp", { email: credentials.email, type: "email-verification" }, `valid-race-${i}`)).status, 200);
    }
    assert.notEqual(f.sent.at(-1)!.otp, oldCode);
  } finally { release(); }
  assert.equal((await wrong).status, 400);
  assert.equal((await f.request("/email-otp/verify-email", { email: credentials.email, otp: oldCode })).status, 400);
  assert.equal((await f.request("/email-otp/verify-email", { email: credentials.email, otp: f.sent.at(-1)!.otp })).status, 200);
});

test("concurrent wrong attempts exhaust the same five-attempt budget", async (t) => {
  const f = fixture(t);
  await f.signup();
  const otp = f.sent[0].otp;
  const wrong = otp === "000000" ? "111111" : "000000";
  const responses = await Promise.all(Array.from({ length: 20 }, () => f.request("/email-otp/verify-email", { email: credentials.email, otp: wrong })));
  assert.ok(responses.every((r) => r.status >= 400));
  assert.equal((await f.request("/email-otp/verify-email", { email: credentials.email, otp })).status, 403);
});

test("OTP cannot verify a different mailbox or be consumed concurrently twice", async (t) => {
  const f = fixture(t);
  await f.signup();
  assert.equal((await f.request("/email-otp/verify-email", { email: "other@example.com", otp: f.sent[0].otp })).status, 400);
  const responses = await Promise.all([1, 2].map(() => f.request("/email-otp/verify-email", { email: credentials.email, otp: f.sent[0].otp })));
  assert.equal(responses.filter((response) => response.status === 200).length, 1);
});

test("missing service configuration fails closed before creating users or sending mail", async (t) => {
  const f = fixture(t, { unavailable: true });
  assert.equal((await f.signup()).status, 503);
  assert.equal(f.tables.user.length, 0);
  assert.equal(f.sent.length, 0);
});

test("CAPTCHA provider failure never creates an account", async (t) => {
  const f = fixture(t, { providerFails: true });
  assert.ok((await f.signup()).status >= 400);
  assert.equal(f.tables.user.length, 0);
  assert.equal(f.sent.length, 0);
});

test("email throttle runs before account/OTP mutation", async (t) => {
  const f = fixture(t, { limited: true });
  assert.equal((await f.signup()).status, 429);
  assert.equal(f.reservations(), 1);
  assert.equal(f.tables.user.length, 0);
  assert.equal(f.tables.verification.length, 0);
  assert.equal(f.sent.length, 0);
});

test("delivery failure is surfaced and cannot create usable sessions or live codes", async (t) => {
  const f = fixture(t, { deliveryFails: true });
  assert.equal((await f.signup()).status, 503);
  assert.equal(f.tables.session.length, 0);
  assert.equal(f.tables.verification.length, 0);
  assert.ok(f.tables.user.every((user) => user.emailVerified === false));
});

test("unused OTP sign-in/reset/check routes and alternate mail types cannot bypass verification", async (t) => {
  const f = fixture(t);
  for (const path of ["/sign-in/email-otp", "/email-otp/check-verification-otp", "/send-verification-email", "/email-otp/request-password-reset", "/forget-password/email-otp"]) {
    assert.equal((await f.request(path, { ...credentials, otp: "123456", type: "sign-in" })).status, 404);
  }
  assert.equal((await f.request("/email-otp/send-verification-otp", { email: credentials.email, type: "sign-in" }, "valid-other-type")).status, 400);
  assert.equal(f.sent.length, 0);
});

test("verification gate treats legacy/missing verification as untrusted", () => {
  for (const value of [undefined, null, {}, { emailVerified: false }]) assert.throws(() => assertVerifiedEmail(value), EmailVerificationRequiredError);
  assert.doesNotThrow(() => assertVerifiedEmail({ emailVerified: true }));
});

test("registration configuration requires TLS SMTP and rejects public test keys in production", () => {
  const env: NodeJS.ProcessEnv = { TURNSTILE_SITE_KEY: "site", TURNSTILE_SECRET_KEY: "secret", SMTP_HOST: "smtp.example.com", SMTP_PORT: "465", SMTP_USER: "user", SMTP_PASS: "pass", MAIL_FROM: "sender@example.com", NODE_ENV: "production" };
  assert.ok(getRegistrationConfig(env));
  assert.ok(getRegistrationConfig({ ...env, SMTP_PORT: "587" }));
  for (const key of Object.keys(env).filter((key) => key !== "NODE_ENV")) assert.equal(getRegistrationConfig({ ...env, [key]: "" }), null);
  assert.equal(getRegistrationConfig({ ...env, SMTP_PORT: "25" }), null);
  assert.equal(getRegistrationConfig({ ...env, TURNSTILE_SITE_KEY: "1x00000000000000000000AA" }), null);
});
