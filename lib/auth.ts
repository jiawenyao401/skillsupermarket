import "server-only";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { db } from "@/lib/db";
import * as schema from "@/lib/schema";
import { registrationProtection } from "@/lib/auth-protection";
import { getRegistrationConfig } from "@/lib/registration-config";
import { reserveVerificationEmail } from "@/lib/auth-email-limit";
import { sendEmailVerificationCode } from "@/lib/verification-mail";

const productionURL = "https://skillsupermarket.com";
const appURL = process.env.BETTER_AUTH_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? productionURL;
const protection = registrationProtection({ config: getRegistrationConfig(), appURL, reserveEmail: reserveVerificationEmail, sendCode: sendEmailVerificationCode });

export const auth = betterAuth({
  ...protection,
  appName: "Skill Supermarket",
  baseURL: appURL,
  secret: process.env.BETTER_AUTH_SECRET,
  database: drizzleAdapter(db, {
    provider: "pg",
    schema,
  }),
  user: {
    additionalFields: {
      // Authorization is always re-checked against PostgreSQL. The field is
      // not client-writable or returned in public auth payloads.
      role: {
        type: "string",
        required: true,
        defaultValue: "user",
        input: false,
        returned: false,
      },
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 30,
    updateAge: 60 * 60 * 24,
    freshAge: 60 * 60 * 24,
  },
  account: {
    accountLinking: { enabled: false },
  },
  verification: {
    storeIdentifier: "hashed",
  },
  trustedOrigins: [productionURL, "https://www.skillsupermarket.com", "http://localhost:3000"],
  rateLimit: {
    enabled: true,
    storage: "database",
    modelName: "rateLimit",
    window: 60,
    max: 60,
    customRules: {
      "/sign-in/email": { window: 60, max: 5 },
      "/sign-up/email": { window: 60 * 10, max: 5 },
      "/email-otp/send-verification-otp": { window: 60 * 10, max: 5 },
      "/email-otp/verify-email": { window: 60 * 10, max: 10 },
    },
  },
  advanced: {
    cookiePrefix: "skill-market",
    useSecureCookies: process.env.NODE_ENV === "production",
    defaultCookieAttributes: {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
    },
    ipAddress: {
      ipAddressHeaders: ["x-real-ip", "x-forwarded-for"],
    },
  },
  plugins: [...protection.plugins, nextCookies()],
});

export type AuthSession = typeof auth.$Infer.Session;
