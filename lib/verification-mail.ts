import "server-only";
import nodemailer from "nodemailer";
import { APIError } from "better-auth/api";
import { getRegistrationConfig } from "@/lib/registration-config";

let transport: ReturnType<typeof nodemailer.createTransport> | undefined;

export async function sendEmailVerificationCode(email: string, otp: string): Promise<void> {
  const config = getRegistrationConfig();
  if (!config) throw new APIError("SERVICE_UNAVAILABLE", { code: "VERIFICATION_UNAVAILABLE", message: "邮箱验证服务暂不可用，请稍后再试" });
  transport ??= nodemailer.createTransport({
    host: config.smtpHost,
    port: config.smtpPort,
    secure: config.smtpPort === 465,
    requireTLS: true,
    auth: { user: config.smtpUser, pass: config.smtpPass },
    tls: { minVersion: "TLSv1.2", rejectUnauthorized: true },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
    disableFileAccess: true,
    disableUrlAccess: true,
  });
  try {
    const result = await transport.sendMail({
      from: { name: "Skill Supermarket", address: config.mailFrom },
      to: { address: email, name: "" },
      subject: "Skill Supermarket 邮箱验证码",
      text: `你的邮箱验证码是：${otp}\n\n验证码 5 分钟内有效，仅可使用一次。验证邮箱后才能使用免费评测额度。\n\n如果不是你发起的操作，请忽略本邮件，不要向他人提供验证码。\nhttps://skillsupermarket.com`,
    });
    if (result.accepted.length !== 1) throw new Error("recipient_rejected");
  } catch {
    // SMTP errors can contain credentials and recipient addresses.
    console.error("[auth] verification_email_delivery_failed");
    throw new APIError("SERVICE_UNAVAILABLE", { code: "EMAIL_DELIVERY_FAILED", message: "验证码发送失败，请稍后重新发送" });
  }
}
