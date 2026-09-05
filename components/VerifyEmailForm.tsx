"use client";

import { useEffect, useState } from "react";
import { authClient } from "@/lib/auth-client";
import { authErrorMessage } from "@/lib/auth-utils";
import { Turnstile } from "@/components/Turnstile";

export function VerifyEmailForm({ email, siteKey, alreadySent, onVerified, onBack }: {
  email: string;
  siteKey: string | null;
  alreadySent: boolean;
  onVerified: () => void;
  onBack?: () => void;
}) {
  const [code, setCode] = useState("");
  const [token, setToken] = useState("");
  const [challenge, setChallenge] = useState(0);
  const [pending, setPending] = useState(false);
  const [cooldown, setCooldown] = useState(alreadySent ? 60 : 0);
  const [notice, setNotice] = useState(alreadySent ? "注册请求已受理。请检查收件箱和垃圾邮件；如果邮箱已注册，请返回登录。" : "请先完成人机验证，再发送邮箱验证码。");
  const [error, setError] = useState("");
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  async function send() {
    if (!token || pending || cooldown > 0) return;
    setPending(true); setError("");
    try {
      const result = await authClient.emailOtp.sendVerificationOtp({ email, type: "email-verification" }, { headers: { "x-captcha-response": token } });
      if (result.error) setError(authErrorMessage(result.error.message, result.error.status, result.error.code));
      else { setNotice("若该邮箱已注册，验证码将发送到收件箱；之前的验证码已失效。"); setCooldown(60); }
    } catch { setError("网络连接失败，请稍后重试。"); }
    finally { setPending(false); setToken(""); setChallenge((value) => value + 1); }
  }

  async function verify(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setPending(true); setError("");
    try {
      const result = await authClient.emailOtp.verifyEmail({ email, otp: code });
      if (result.error) setError(authErrorMessage(result.error.message, result.error.status, result.error.code));
      else onVerified();
    } catch { setError("网络连接失败，请稍后重试。"); }
    finally { setPending(false); }
  }

  return <div className="space-y-5">
    <div><h1 className="text-2xl font-black">验证你的邮箱</h1><p className="mt-3 break-all text-sm text-muted-foreground">{email}</p><p className="mt-2 text-sm leading-6 text-muted-foreground">验证后才能使用评测额度。验证码 5 分钟内有效，最多可尝试 5 次。</p></div>
    <p role="status" className="text-sm leading-6">{notice}</p>
    <form onSubmit={verify} className="space-y-4">
      <label className="block text-sm font-semibold">邮箱验证码<input aria-label="邮箱验证码" value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" minLength={6} maxLength={6} required className="auth-input mt-2 pl-4 text-lg tracking-[0.35em]" placeholder="6 位数字" /></label>
      <button disabled={pending || code.length !== 6} className="button-primary h-12 w-full rounded-xl text-sm disabled:opacity-50">{pending ? "请稍候…" : "验证邮箱"}</button>
    </form>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {siteKey ? <Turnstile key={challenge} siteKey={siteKey} onToken={setToken} /> : <p role="alert" className="text-sm text-destructive">邮箱验证服务暂不可用，请稍后再试。</p>}
    <button type="button" onClick={send} disabled={!siteKey || !token || pending || cooldown > 0} className="h-10 w-full rounded-xl border text-sm font-semibold disabled:opacity-50">{cooldown > 0 ? `${cooldown} 秒后可重新发送` : "发送 / 重新发送验证码"}</button>
    {onBack && <button type="button" onClick={onBack} disabled={pending} className="text-sm text-muted-foreground hover:text-foreground">返回登录 / 修改邮箱</button>}
  </div>;
}
