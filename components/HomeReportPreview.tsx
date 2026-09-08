import Link from "next/link";
import { getReportVersion } from "../lib/report-provenance";

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

export function HomeReportPreview({ example }: {
  example?: { slug: string; name: string; report: unknown; evaluatedAt: Date | null };
}) {
  if (!example) return null;
  const report = record(example.report);
  const headline = record(report?.summary)?.headline;
  const actions = record(report?.recommendation)?.nextActions;
  const action = Array.isArray(actions) ? actions.find((item) => typeof item === "string" && item.trim()) : undefined;
  const date = example.evaluatedAt;
  const validDate = date instanceof Date && Number.isFinite(date.getTime());

  return (
    <section aria-labelledby="home-report-preview-title" className="mx-auto mt-8 max-w-2xl rounded-2xl border bg-background/90 p-5 text-left [overflow-wrap:anywhere]">
      <h2 id="home-report-preview-title" className="font-bold">先看一份真实报告，无需注册</h2>
      <p className="mt-1 text-sm text-muted-foreground">看风险证据与改进建议，再决定是否评测自己的项目。</p>
      <div className="mt-4 border-l-2 border-primary pl-4 text-sm leading-6">
        <p className="font-semibold">{example.name}</p>
        {typeof headline === "string" && headline.trim() && <p className="mt-1">报告结论：{headline}</p>}
        {action && <p className="mt-2">建议先做：{action}</p>}
        <p className="mt-2 text-xs text-muted-foreground">
          {getReportVersion(example.report).label} · {validDate ? <time dateTime={date.toISOString()}>{date.toLocaleDateString("zh-CN", { timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit" })}（北京时间）</time> : "时间未记录"}
        </p>
      </div>
      <Link href={`/skill/${encodeURIComponent(example.slug)}#evaluation-report-title`} prefetch={false}
        className="mt-4 inline-flex min-h-11 items-center rounded-lg border border-primary px-4 py-2 text-sm font-semibold text-primary hover:bg-primary/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
        阅读完整报告与证据 →
      </Link>
      <p className="mt-2 text-xs leading-5 text-muted-foreground">历史报告仅反映生成时的公开证据，不是安全认证或安装推荐。</p>
    </section>
  );
}
