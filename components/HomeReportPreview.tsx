import Link from "next/link";
import { getReportVersion } from "../lib/report-provenance";
import { normalizeEvaluationDiagram } from "../lib/judge";

export interface HomeReportExample {
  slug: string;
  name: string;
  report: unknown;
  evaluatedAt: Date | null;
}

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

export function HomeReportPreview({ example }: { example?: HomeReportExample }) {
  if (!example) return null;
  const report = record(example.report);
  const headline = record(report?.summary)?.headline;
  const actions = record(report?.recommendation)?.nextActions;
  const action = Array.isArray(actions) ? actions.find((item) => typeof item === "string" && item.trim()) : undefined;
  const date = example.evaluatedAt;
  const validDate = date instanceof Date && Number.isFinite(date.getTime());
  const diagram = normalizeEvaluationDiagram(report?.diagram);

  return (
    <section aria-labelledby="home-report-preview-title" className="home-report [overflow-wrap:anywhere]">
      <div className="home-report-heading">
        <h2 id="home-report-preview-title">真实报告 · 无需注册</h2>
        <span>报告节选</span>
      </div>
      <p className="home-report-name">{example.name}</p>
      <p className="home-report-date">
          {getReportVersion(example.report).label} · {validDate ? <time dateTime={date.toISOString()}>{date.toLocaleDateString("zh-CN", { timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit" })}（北京时间）</time> : "时间未记录"}
      </p>
      <div className="home-report-findings">
        {typeof headline === "string" && headline.trim() && <p><span>报告结论：</span>{headline}</p>}
        {action && <p><span>建议先做：</span>{action}</p>}
      </div>
      {diagram && <div className="home-relations">
        <h3>{{ flow: "流程图", sequence: "时序图", architecture: "结构图" }[diagram.type]} · 关系节选</h3>
        <ul>
          {diagram.edges.slice(0, 2).map((edge, index) => <li key={index}>
            <span className="home-relation-node">{diagram.nodes.find(node => node.id === edge.from)!.label}</span>
            <span className="home-relation-edge"><span>{edge.label}</span><span aria-hidden="true">⟶</span></span>
            <span className="home-relation-node">{diagram.nodes.find(node => node.id === edge.to)!.label}</span>
          </li>)}
        </ul>
        <p>取自本报告的 {diagram.nodes.length} 个节点、{diagram.edges.length} 条关系；完整图与依据见报告。</p>
      </div>}
      <Link href={`/skill/${encodeURIComponent(example.slug)}#evaluation-report-title`} prefetch={false}
        className="home-text-link home-report-link">
        阅读完整报告与证据 →
      </Link>
      <p className="home-note">历史报告仅反映生成时的公开证据，不是安全认证或安装推荐。</p>
    </section>
  );
}
