import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { evaluations, skills } from "@/lib/schema";
import type { EvaluationReport } from "@/lib/types";

export const dynamic = "force-dynamic";

function escapeXml(value: string): string {
  return value.replace(/[<>&"']/g, (character) => ({
    "<": "&lt;",
    ">": "&gt;",
    "&": "&amp;",
    '"': "&quot;",
    "'": "&apos;",
  })[character] ?? character);
}
function riskLabel(report: EvaluationReport): string {
  const risk = report.summary?.riskLevel;
  if (risk === "critical") return "critical risk";
  if (risk === "high") return "high risk";
  if (risk === "medium") return "medium risk";
  return "low risk";
}

function riskColor(report: EvaluationReport): string {
  const risk = report.summary?.riskLevel;
  if (risk === "critical") return "#b42318";
  if (risk === "high") return "#e44b23";
  if (risk === "medium") return "#b7791f";
  return "#16825d";
}

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [row] = await db
    .select({
      name: skills.name,
      score: evaluations.overallScore,
      report: evaluations.report,
    })
    .from(skills)
    .innerJoin(evaluations, eq(evaluations.skillId, skills.id))
    .where(eq(skills.slug, slug))
    .orderBy(desc(evaluations.evaluatedAt))
    .limit(1);

  if (!row) return new Response("Evaluation not found", { status: 404 });

  const report = row.report as EvaluationReport;
  const score = Math.max(0, Math.min(100, row.score));
  const status = riskLabel(report);
  const color = riskColor(report);
  const accessibleLabel = escapeXml(`${row.name}: Skill Supermarket score ${score} out of 100, ${status}`);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="244" height="28" role="img" aria-label="${accessibleLabel}">
  <title>${accessibleLabel}</title>
  <defs><linearGradient id="g" x2="0" y2="100%"><stop offset="0" stop-color="#fff" stop-opacity=".12"/><stop offset="1" stop-opacity=".08"/></linearGradient></defs>
  <clipPath id="r"><rect width="244" height="28" rx="7"/></clipPath>
  <g clip-path="url(#r)">
    <rect width="143" height="28" fill="#151a28"/>
    <rect x="143" width="101" height="28" fill="${color}"/>
    <rect width="244" height="28" fill="url(#g)"/>
  </g>
  <g fill="#fff" text-anchor="middle" font-family="Verdana,Arial,sans-serif" font-size="11" font-weight="600">
    <text x="71.5" y="18">Skill Supermarket</text>
    <text x="193.5" y="18">${score}/100 · ${status}</text>
  </g>
</svg>`;

  return new Response(svg, {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400",
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
