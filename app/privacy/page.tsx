import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "隐私说明",
  description: "Skill Supermarket 的账户、评测与隐私友好型站内统计说明。",
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPage() {
  return (
    <article className="mx-auto max-w-3xl rounded-[2rem] border bg-card px-6 py-10 shadow-sm sm:px-10 sm:py-14">
      <div className="section-eyebrow">Privacy</div>
      <h1 className="mt-3 text-4xl font-black tracking-[-0.05em]">隐私说明</h1>
      <p className="mt-4 text-sm text-muted-foreground">更新日期：2026-08-18</p>

      <div className="mt-9 space-y-8 text-[15px] leading-7 text-foreground/80">
        <section>
          <h2 className="text-xl font-extrabold text-foreground">账户与评测数据</h2>
          <p className="mt-3">注册和登录需要保存用于识别账户的必要信息。评测任务会保存提交的公开项目来源、任务状态、额度消耗和生成的报告，用于提供个人历史、公开案例和服务运营。我们不会在公开页面展示用户邮箱。</p>
        </section>
        <section>
          <h2 className="text-xl font-extrabold text-foreground">站内访问统计</h2>
          <p className="mt-3">本站使用自建的最小化统计，只按日期、页面和粗粒度来源汇总页面浏览与“开始评测”点击。数据库不保存访问者 IP、完整来源网址、User-Agent、广告标识或跨天访客 ID，也不使用统计 Cookie。浏览器开启 Do Not Track 或 Global Privacy Control 时，前端不会发送统计事件。</p>
        </section>
        <section>
          <h2 className="text-xl font-extrabold text-foreground">公开来源与第三方链接</h2>
          <p className="mt-3">项目索引和报告使用公开 GitHub、npm、PyPI 等来源。访问第三方网站时适用其各自的隐私政策。报告中的自动化结论用于初筛，不替代项目方承诺或专业安全审计。</p>
        </section>
        <section>
          <h2 className="text-xl font-extrabold text-foreground">问题与删除请求</h2>
          <p className="mt-3">如需反馈项目归属、申请更正公开信息或处理账户数据，请通过项目的 <a href="https://github.com/jiawenyao401/skillsupermarket/issues" target="_blank" rel="noreferrer" className="font-semibold text-primary underline underline-offset-4">GitHub Issues</a> 联系。安全问题请避免在公开 Issue 中披露敏感细节。</p>
        </section>
      </div>

      <div className="mt-10 border-t pt-6">
        <Link href="/" className="text-sm font-semibold text-primary hover:underline">返回首页</Link>
      </div>
    </article>
  );
}
