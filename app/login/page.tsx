import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { BadgeCheck, DatabaseZap, ShieldCheck } from "lucide-react";
import { AuthForm } from "@/components/AuthForm";
import { getCurrentSession } from "@/lib/auth-session";
import { initialAuthMode, safeReturnTo, emailVerificationDestination } from "@/lib/auth-utils";
import { getRegistrationConfig } from "@/lib/registration-config";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "登录或注册",
  description: "登录 Skill Supermarket，管理评测额度与历史报告。",
  robots: { index: false, follow: false },
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string | string[]; returnTo?: string | string[] }>;
}) {
  const params = await searchParams;
  const requestedReturnTo = Array.isArray(params.returnTo) ? params.returnTo[0] : params.returnTo;
  const returnTo = safeReturnTo(requestedReturnTo);
  const session = await getCurrentSession();
  if (session) redirect(session.user.emailVerified ? returnTo : emailVerificationDestination(returnTo));

  return (
    <div className="mx-auto grid min-h-[calc(100vh-13rem)] max-w-5xl items-center gap-10 py-6 lg:grid-cols-[1fr_28rem]">
      <section className="max-w-xl">
        <div className="section-eyebrow">Members only evaluation</div>
        <h1 className="mt-3 text-balance text-4xl font-black tracking-[-0.055em] sm:text-6xl">
          可信评测，从可信用户开始
        </h1>
        <p className="mt-5 max-w-lg text-base leading-8 text-muted-foreground">
          Skill 浏览与案例保持开放；免费账号每周可启动 10 次新评测，缓存报告与历史查看不扣额度。每次评测都有明确归属。
        </p>
        <div className="mt-8 grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
          {[
            [ShieldCheck, "服务端鉴权", "页面和接口双重验证"],
            [DatabaseZap, "持久会话", "退出后立即失效"],
            [BadgeCheck, "每周 10 次", "周一自动恢复免费额度"],
          ].map(([Icon, title, detail]) => (
            <div key={String(title)} className="flex items-center gap-3 rounded-2xl border bg-card/75 p-3.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary"><Icon className="h-4 w-4" /></span>
              <div><div className="text-sm font-bold">{String(title)}</div><div className="mt-0.5 text-xs text-muted-foreground">{String(detail)}</div></div>
            </div>
          ))}
        </div>
      </section>
      <AuthForm initialMode={initialAuthMode(params.mode, params.returnTo)} returnTo={returnTo} siteKey={getRegistrationConfig()?.siteKey ?? null} />
    </div>
  );
}
