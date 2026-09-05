import "dotenv/config";
import nodemailer from "nodemailer";
import { getRegistrationConfig } from "../lib/registration-config";

async function main() {
  const config = getRegistrationConfig({ ...process.env, NODE_ENV: "production" });
  if (!config) {
    console.error("[registration] 配置缺失或无效：需要正式 Turnstile site/secret key、SMTP_HOST/PORT/USER/PASS、MAIL_FROM。详见 docs/registration-verification.md。");
    process.exitCode = 1;
    return;
  }
  const transport = nodemailer.createTransport({
    host: config.smtpHost, port: config.smtpPort, secure: config.smtpPort === 465,
    requireTLS: true, tls: { minVersion: "TLSv1.2", rejectUnauthorized: true },
    auth: { user: config.smtpUser, pass: config.smtpPass },
    connectionTimeout: 10_000, greetingTimeout: 10_000, socketTimeout: 15_000,
  });
  try {
    await transport.verify();
    console.log("[registration] 正式配置存在，SMTP TLS/鉴权通过。未发送邮件；真实 Turnstile 和收件箱到达仍需发布前浏览器验收。");
  } catch {
    console.error("[registration] SMTP TLS/鉴权失败，请在邮件服务控制台核对配置（错误详情已隐藏）。");
    process.exitCode = 1;
  } finally { transport.close(); }
}

void main().catch(() => { console.error("[registration] 配置检查失败。"); process.exitCode = 1; });
