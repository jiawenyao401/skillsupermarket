import { z } from "zod";

const configSchema = z.object({
  siteKey: z.string().trim().min(1),
  secretKey: z.string().trim().min(1),
  smtpHost: z.string().trim().min(1).refine((value) => !/[\s/]/.test(value)),
  smtpPort: z.coerce.number().int().refine((value) => value === 465 || value === 587),
  smtpUser: z.string().min(1),
  smtpPass: z.string().min(1),
  mailFrom: z.string().email(),
});

export type RegistrationConfig = z.infer<typeof configSchema>;

export function getRegistrationConfig(env: NodeJS.ProcessEnv = process.env): RegistrationConfig | null {
  const result = configSchema.safeParse({
    siteKey: env.TURNSTILE_SITE_KEY,
    secretKey: env.TURNSTILE_SECRET_KEY,
    smtpHost: env.SMTP_HOST,
    smtpPort: env.SMTP_PORT,
    smtpUser: env.SMTP_USER,
    smtpPass: env.SMTP_PASS,
    mailFrom: env.MAIL_FROM,
  });
  if (!result.success) return null;
  // Cloudflare's public test keys must never enable registration in production.
  if (env.NODE_ENV === "production" && [result.data.siteKey, result.data.secretKey].some((key) => /^[123]x0+/.test(key))) return null;
  return result.data;
}
