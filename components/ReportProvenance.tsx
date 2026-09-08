import Link from "next/link";
import { getReportVersion } from "../lib/report-provenance";

export function ReportProvenance({ report, evaluatedAt, currentVersion, reevaluationSlug }: {
  report: unknown;
  evaluatedAt: Date | null;
  currentVersion: string;
  reevaluationSlug?: string;
}) {
  const stored = getReportVersion(report);
  const validDate = evaluatedAt instanceof Date && Number.isFinite(evaluatedAt.getTime()) ? evaluatedAt : null;
  const sameVersion = stored.version === currentVersion;
  return (
    <section className="rounded-2xl border bg-card p-5 sm:p-6" aria-label="报告时间与版本">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <dl className="flex flex-wrap gap-x-8 gap-y-3 text-sm">
            <div><dt className="text-xs text-muted-foreground">评测生成时间（北京时间）</dt><dd className="mt-1 font-semibold">
              {validDate ? <time dateTime={validDate.toISOString()}>{validDate.toLocaleString("zh-CN", {
                timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit",
                hour: "2-digit", minute: "2-digit", hourCycle: "h23",
              })}</time> : "时间未记录"}
            </dd></div>
            <div><dt className="text-xs text-muted-foreground">本报告引擎</dt><dd className="mt-1 font-semibold">{stored.label}</dd></div>
            <div><dt className="text-xs text-muted-foreground">当前引擎</dt><dd className="mt-1 font-semibold">v{currentVersion}</dd></div>
          </dl>
          <p className="mt-3 max-w-3xl text-xs leading-5 text-muted-foreground">
            {stored.version === null
              ? "无法确认本报告的规则版本；重新评测后可获得完整版本记录。"
              : sameVersion
                ? "规则版本一致，但报告只反映生成时的证据，不代表项目代码和安全状态始终不变。"
                : "本报告与当前引擎使用不同规则；原分数不会自动更新，不同版本的分数不宜直接对比。"}
          </p>
        </div>
        {reevaluationSlug ? <div className="shrink-0 sm:max-w-48">
          <Link href={`/evaluate?skill=${encodeURIComponent(reevaluationSlug)}`} className="button-primary inline-flex min-h-11 w-full justify-center px-4 text-sm" prefetch={false}>重新评测此项目</Link>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">进入后确认来源与额度，提交才会创建任务。</p>
        </div> : null}
      </div>
    </section>
  );
}
