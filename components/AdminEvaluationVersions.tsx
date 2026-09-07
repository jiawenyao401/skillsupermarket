import type { EvaluationVersionMetrics } from "../lib/evaluation-version-metrics";

export function AdminEvaluationVersions({ metrics }: { metrics: EvaluationVersionMetrics }) {
  return (
    <section className="surface-card overflow-hidden" aria-labelledby="evaluation-versions-heading">
      <div className="border-b px-5 py-5 sm:px-7">
        <h2 id="evaluation-versions-heading" className="font-bold">评测版本覆盖</h2>
        <p className="mt-2 text-sm">
          当前算法 {metrics.currentVersion}：{metrics.currentVersionLatestReports} / {metrics.activeSkills} 个有效 Skill
          （{metrics.currentVersionCoverage === null ? "暂无样本" : `${metrics.currentVersionCoverage.toFixed(1)}%`}）
        </p>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          共 {metrics.latestReports} 个有效 Skill 有报告；其他版本 {metrics.otherVersionLatestReports} 个，版本未知 {metrics.unversionedLatestReports} 个。覆盖率不是准确率，也不代表旧报告已重评。
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-left text-sm">
          <caption className="sr-only">有效 Skill 的最新报告版本和历史报告产出</caption>
          <thead className="bg-muted/45 text-xs text-muted-foreground"><tr>
            {["算法版本", "最新报告", "D1 产出", "D7 产出", "D30 产出"].map((label) => <th key={label} scope="col" className="px-5 py-3 font-semibold">{label}</th>)}
          </tr></thead>
          <tbody className="divide-y">
            {metrics.versions.map((row) => <tr key={row.version ?? "unknown"}>
              <th scope="row" className="px-5 py-3 font-semibold">{row.version ?? "版本未知"}{row.version === metrics.currentVersion ? "（当前）" : ""}</th>
              {[row.latestReports, row.reports1d, row.reports7d, row.reports30d].map((count, index) => <td key={index} className="px-5 py-3 tabular-nums">{count}</td>)}
            </tr>)}
            {metrics.versions.length === 0 && <tr><td colSpan={5} className="px-5 py-6 text-muted-foreground">暂无评测报告</td></tr>}
          </tbody>
        </table>
      </div>
      <p className="border-t px-5 py-4 text-xs leading-5 text-muted-foreground">
        最新报告按 Skill 去重；D1/D7/D30 按评测时间滚动统计所有产出，包含重评、运营和发布冒烟，不是用户增长。报告尚无任务来源关联，不能推断真实用户采用率。此处不会触发重评。
      </p>
    </section>
  );
}
