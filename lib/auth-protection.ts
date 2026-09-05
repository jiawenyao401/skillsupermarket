import { createHash, timingSafeEqual } from "node:crypto";
import type { BetterAuthOptions, Where } from "better-auth";
import { APIError, createAuthMiddleware, createAuthEndpoint } from "better-auth/api";
import { parseUserOutput } from "better-auth/db";
import { captcha, emailOTP } from "better-auth/plugins";
import { z } from "zod";
import type { RegistrationConfig } from "./registration-config";

export const AUTH_CAPTCHA_ACTION = "registration";
export const EMAIL_OTP_SECONDS = 300;
const sendPaths = ["/sign-up/email", "/email-otp/send-verification-otp"];

export function registrationProtection(options: {
  config: RegistrationConfig | null;
  appURL: string;
  reserveEmail: (email: string) => Promise<void>;
  sendCode: (email: string, otp: string) => Promise<void>;
}) {
  const otpPlugin = emailOTP({
    otpLength: 6, expiresIn: EMAIL_OTP_SECONDS, allowedAttempts: 5,
    storeOTP: "hashed", disableSignUp: true,
    // The public sender below awaits SMTP directly: the library's default
    // background-task wrapper swallows delivery failures.
    async sendVerificationOTP() { throw new Error("Unsupported email flow"); },
  });
  const emailBody = z.object({ email: z.string().trim().toLowerCase().email().max(254), type: z.literal("email-verification") });
  const sendEndpoint = createAuthEndpoint("/email-otp/send-verification-otp", {
    method: "POST", body: emailBody,
  }, async (ctx) => {
    const email = ctx.body.email;
    const account = await ctx.context.internalAdapter.findUserByEmail(email);
    if (!account || account.user.emailVerified) return ctx.json({ success: true });
    // Only an actual send rotates a code. A duplicate sign-up must not
    // invalidate the owner's pending verification without sending a new one.
    await ctx.context.internalAdapter.deleteVerificationByIdentifier(`email-verification-otp-${email}`);
    const otp = await otpPlugin.endpoints.createVerificationOTP({ body: { email, type: "email-verification" }, context: ctx.context });
    try { await options.sendCode(email, otp); }
    catch (error) {
      await ctx.context.internalAdapter.deleteVerificationByIdentifier(`email-verification-otp-${email}`);
      throw error;
    }
    return ctx.json({ success: true });
  });
  const verifyEndpoint = createAuthEndpoint("/email-otp/verify-email", {
    method: "POST", body: z.object({ email: emailBody.shape.email, otp: z.string().regex(/^\d{6}$/) }),
  }, async (ctx) => {
    const { email, otp } = ctx.body;
    const provided = createHash("sha256").update(otp).digest("base64url");
    // The library's consume-then-recreate on a wrong attempt can resurrect an
    // old OTP after a concurrent resend. Instead update the SAME row by CAS;
    // deletion/rotation wins and no wrong attempt ever recreates a record.
    for (let retry = 0; retry < 6; retry++) {
      const row = await ctx.context.internalAdapter.findVerificationValue(`email-verification-otp-${email}`);
      if (!row) break;
      if (row.expiresAt <= new Date()) throw new APIError("BAD_REQUEST", { code: "OTP_EXPIRED", message: "验证码已过期" });
      const match = /^([A-Za-z0-9_-]{43}):(\d+)$/.exec(row.value);
      if (!match) break;
      const attempts = Number(match[2]);
      if (attempts >= 5) throw new APIError("FORBIDDEN", { code: "TOO_MANY_ATTEMPTS", message: "验证码尝试次数过多" });
      const where: Where[] = [{ field: "id", value: row.id }, { field: "value", value: row.value }, { field: "expiresAt", operator: "gt", value: new Date() }];
      if (!timingSafeEqual(Buffer.from(provided), Buffer.from(match[1]))) {
        const changed = await ctx.context.adapter.updateMany({ model: "verification", where, update: { value: `${match[1]}:${attempts + 1}` } });
        if (!changed) continue;
        break;
      }
      const consumed = await ctx.context.adapter.consumeOne({ model: "verification", where });
      if (!consumed) continue;
      const account = await ctx.context.internalAdapter.findUserByEmail(email);
      if (!account) break;
      const updated = await ctx.context.internalAdapter.updateUser(account.user.id, { emailVerified: true });
      // No auto-login or cookie cache: verified users log in with their password;
      // existing sessions read the updated user from the database on navigation.
      return ctx.json({ status: true, token: null, user: parseUserOutput(ctx.context.options, updated) });
    }
    throw new APIError("BAD_REQUEST", { code: "INVALID_OTP", message: "验证码不正确或已失效" });
  });
  return {
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: true,
      autoSignIn: false,
      minPasswordLength: 10,
      maxPasswordLength: 128,
      revokeSessionsOnPasswordReset: true,
    },
    emailVerification: {
      sendOnSignUp: false,
      sendOnSignIn: false,
      autoSignInAfterVerification: false,
    },
    // Only email ownership verification is exposed. Adding the OTP plugin
    // must not accidentally open passwordless registration or reset routes.
    disabledPaths: [
      "/sign-in/email-otp", "/email-otp/check-verification-otp",
      "/email-otp/request-password-reset", "/email-otp/reset-password",
      "/forget-password/email-otp", "/email-otp/request-email-change",
      "/email-otp/change-email", "/send-verification-email", "/verify-email",
    ],
    hooks: {
      before: createAuthMiddleware(async (ctx) => {
        if (!sendPaths.includes(ctx.path)) return;
        if (!options.config) throw new APIError("SERVICE_UNAVAILABLE", { code: "VERIFICATION_UNAVAILABLE", message: "注册验证服务暂不可用，请稍后再试" });
        if (ctx.path !== "/sign-up/email" && ctx.body?.type !== "email-verification") {
          throw new APIError("BAD_REQUEST", { code: "INVALID_OTP_TYPE", message: "仅支持邮箱验证" });
        }
        const email = z.string().trim().toLowerCase().email().max(254).safeParse(ctx.body?.email);
        if (!email.success) throw new APIError("BAD_REQUEST", { code: "INVALID_EMAIL", message: "请输入有效邮箱" });
        await options.reserveEmail(email.data);
      }),
      after: createAuthMiddleware(async (ctx) => {
        if (ctx.path !== "/sign-up/email") return;
        const returned = ctx.context.returned as { user?: { id: string; email: string } } | undefined;
        if (!returned?.user) return;
        const account = await ctx.context.internalAdapter.findUserByEmail(returned.user.email);
        // A duplicate sign-up returns a synthetic user for anti-enumeration.
        if (!account || account.user.id !== returned.user.id) return;
        await sendEndpoint({ body: { email: returned.user.email, type: "email-verification" }, context: ctx.context });
      }),
    },
    plugins: [
      {
        id: "registration-readiness",
        async onRequest(request) {
          const path = new URL(request.url).pathname.replace(/^\/api\/auth/, "").replace(/\/+$/, "");
          if (!options.config && sendPaths.includes(path)) return { response: Response.json({
            code: "VERIFICATION_UNAVAILABLE", message: "注册验证服务暂不可用，请稍后再试",
          }, { status: 503, headers: { "Cache-Control": "no-store" } }) };
        },
      },
      captcha({
        provider: "cloudflare-turnstile",
        secretKey: options.config?.secretKey ?? "",
        endpoints: sendPaths,
        expectedAction: AUTH_CAPTCHA_ACTION,
        allowedHostnames: [new URL(options.appURL).hostname],
      }),
      { ...otpPlugin, endpoints: { ...otpPlugin.endpoints, sendVerificationOTP: sendEndpoint, verifyEmailOTP: verifyEndpoint } },
    ],
  } satisfies BetterAuthOptions;
}
