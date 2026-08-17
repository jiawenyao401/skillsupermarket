"use client";

import { useState } from "react";
import { ArrowRight, Eye, EyeOff, Loader2, LockKeyhole, Mail, UserRound } from "lucide-react";
import { authClient } from "@/lib/auth-client";

type Mode = "login" | "register";

function authErrorMessage(message?: string, status?: number) {
  if (status === 429) return "尝试次数过多，请稍后再试";
  const normalized = message?.toLowerCase() ?? "";
  if (normalized.includes("invalid email or password") || normalized.includes("invalid credentials")) return "邮箱或密码不正确";
  if (normalized.includes("already exists") || normalized.includes("already in use")) return "该邮箱已注册，请直接登录";
  if (normalized.includes("password")) return "密码不符合要求，请使用 10–128 个字符";
  return "操作未完成，请稍后重试";
}

export function AuthForm({ initialMode, returnTo }: { initialMode: Mode; returnTo: string }) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const [showPassword, setShowPassword] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim().toLowerCase();
    const password = String(form.get("password") ?? "");
    const name = String(form.get("name") ?? "").trim();
    setPending(true);
    setError(null);

    const result = mode === "register"
      ? await authClient.signUp.email({ email, password, name })
      : await authClient.signIn.email({ email, password, rememberMe: true });

    if (result.error) {
      setError(authErrorMessage(result.error.message, result.error.status));
      setPending(false);
      return;
    }

    // Cross the authentication boundary with a full navigation. This makes
    // the freshly written HttpOnly session cookie available to Proxy and the
    // protected Server Component in the same request.
    window.location.replace(new URL(returnTo, window.location.origin).href);
  }

  return (
    <div className="w-full max-w-md rounded-[2rem] border bg-card p-6 shadow-2xl shadow-black/[0.06] sm:p-8">
      <div className="grid grid-cols-2 rounded-full bg-muted p-1" role="tablist" aria-label="账号操作">
        {(["login", "register"] as const).map((item) => (
          <button
            key={item}
            type="button"
            role="tab"
            aria-selected={mode === item}
            className={`h-10 rounded-full text-sm font-bold transition ${mode === item ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}
            onClick={() => { setMode(item); setError(null); }}
          >
            {item === "login" ? "登录" : "注册"}
          </button>
        ))}
      </div>

      <div className="mt-7">
        <h1 className="text-2xl font-black tracking-[-0.035em]">{mode === "login" ? "欢迎回来" : "创建你的账号"}</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          {mode === "login" ? "登录后即可提交 Skill 深度评测。" : "注册后自动登录，每周可免费启动 10 次新评测。"}
        </p>
      </div>

      <form onSubmit={submit} className="mt-7 space-y-4">
        {mode === "register" && (
          <label className="block text-sm font-semibold">
            昵称
            <span className="relative mt-2 block">
              <UserRound className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input name="name" autoComplete="name" minLength={2} maxLength={50} required className="auth-input" placeholder="怎么称呼你" />
            </span>
          </label>
        )}
        <label className="block text-sm font-semibold">
          邮箱
          <span className="relative mt-2 block">
            <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input name="email" type="email" inputMode="email" autoComplete="email" maxLength={254} required className="auth-input" placeholder="name@example.com" />
          </span>
        </label>
        <label className="block text-sm font-semibold">
          密码
          <span className="relative mt-2 block">
            <LockKeyhole className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input name="password" type={showPassword ? "text" : "password"} autoComplete={mode === "login" ? "current-password" : "new-password"} minLength={10} maxLength={128} required className="auth-input pr-12" placeholder="至少 10 个字符" />
            <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground hover:text-foreground" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "隐藏密码" : "显示密码"}>
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </span>
        </label>

        {error && <div role="alert" className="rounded-xl border border-destructive/25 bg-destructive/[0.07] px-3.5 py-3 text-sm text-destructive">{error}</div>}

        <button type="submit" disabled={pending} className="button-primary h-12 w-full rounded-xl text-sm disabled:cursor-not-allowed disabled:opacity-60">
          {pending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> 请稍候</> : <>{mode === "login" ? "登录并继续" : "注册并开始评测"}<ArrowRight className="ml-2 h-4 w-4" /></>}
        </button>
      </form>

      <p className="mt-5 text-center text-xs leading-5 text-muted-foreground">
        密码只以安全哈希保存；登录会话可随时退出并立即撤销。
      </p>
    </div>
  );
}
