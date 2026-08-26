import type {
  EvaluationCheck,
  EvaluationSummary,
  EvaluationVerdict,
  PopularityStats,
  RiskLevel,
  SkillType,
} from "./types";

export const EVALUATOR_VERSION = "3.2.0";

export const WEIGHTS = {
  documentation: 0.22,
  security: 0.25,
  popularity: 0.1,
  activity: 0.13,
  quality: 0.3,
} as const;

export interface DocumentationResult {
  score: number;
  details: string;
  checks: EvaluationCheck[];
  strengths: string[];
  improvements: string[];
}

export interface OverallScoreInput {
  documentation: number;
  security: number;
  popularity: number;
  activity: number;
  quality: number;
  riskLevel: RiskLevel;
}

const DOCUMENTATION_EVIDENCE_CHECK_IDS = new Set([
  "install",
  "example",
  "inputs",
  "outputs",
  "limitations",
  "errors",
]);

const DOCUMENTATION_SIGNAL_PATTERNS = [
  /install|installation|setup|quick\s*start|getting\s*started|安装|配置|快速开始/i,
  /parameters?|arguments?|inputs?|tools?|参数|输入|工具/i,
  /outputs?|returns?|response|results?|输出|返回|结果/i,
  /limitations?|caveats?|permissions?|security|限制|注意|权限|安全|边界/i,
  /errors?|troubleshoot|faq|failure|错误|排障|常见问题|失败/i,
];

function hasActionableAdoptionEvidence(readme: string): boolean {
  const codeBlocks = [...readme.matchAll(/```[^\n]*\n([\s\S]*?)```/g)].map((match) => match[1]);
  return codeBlocks.some((block) => [
    /(?:^|\n)\s*(?:\$\s*)?(?:npm|pnpm|yarn|bun)\s+(?:i|install|add|exec|dlx)\s+\S+/im,
    /(?:^|\n)\s*(?:\$\s*)?(?:npx|bunx)\s+\S+/im,
    /(?:^|\n)\s*(?:\$\s*)?(?:(?:python\s+-m\s+)?pip3?|pipx)\s+install\s+\S+/im,
    /(?:^|\n)\s*(?:\$\s*)?uv\s+(?:add|run|tool\s+install)\s+\S+/im,
    /(?:^|\n)\s*(?:\$\s*)?docker\s+(?:run|compose)\b/im,
    /(?:^|\n)\s*(?:\$\s*)?(?:brew|cargo|go)\s+install\s+\S+/im,
    /["']command["']\s*:\s*["'][^"']+["']/i,
  ].some((pattern) => pattern.test(block)));
}

function hasPackedChecklistLanguage(readme: string): boolean {
  let insideFence = false;
  return readme.split(/\r?\n/).some((line) => {
    if (/^\s*```/.test(line)) {
      insideFence = !insideFence;
      return false;
    }
    if (insideFence || /^\s*\|/.test(line)) return false;
    const normalized = line.replace(/^#{1,6}\s+/, "").trim();
    if (!normalized || normalized.length > 500) return false;
    if ((normalized.match(/\[[^\]]+\]\([^)]+\)/g) ?? []).length >= 3) return false;
    const matchedSignals = DOCUMENTATION_SIGNAL_PATTERNS.filter((pattern) => pattern.test(normalized)).length;
    return matchedSignals >= 4;
  });
}

/**
 * High-precision anti-gaming guard. It only trips when a nominally strong README
 * packs most checklist terms into one line and provides no executable adoption
 * evidence. Legitimate documents keep the existing, intentionally broad checks.
 */
function isDocumentationChecklistGaming(readme: string, rawScore: number): boolean {
  return rawScore >= 80 && hasPackedChecklistLanguage(readme) && !hasActionableAdoptionEvidence(readme);
}

export function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, Math.round(value)));
}

export function scoreDocumentation(
  readme: string,
  description: string | null,
  filePaths: string[],
): DocumentationResult {
  const normalized = readme.toLowerCase();
  const has = (pattern: RegExp) => pattern.test(normalized);
  let checks: EvaluationCheck[] = [
    { id: "description", label: "问题与用途描述", passed: Boolean(description && description.trim().length >= 40), weight: 10 },
    { id: "readme", label: "有效 README", passed: readme.trim().length >= 500, weight: 12, evidence: `${readme.trim().length} 字符` },
    { id: "install", label: "安装或接入步骤", passed: has(/install|安装|setup|配置|quick\s*start|getting\s*started/), weight: 14 },
    { id: "example", label: "可执行示例", passed: /```[\s\S]{20,}?```/.test(readme), weight: 16 },
    { id: "inputs", label: "输入、参数或工具说明", passed: has(/parameters?|arguments?|inputs?|参数|输入|tools?|工具/), weight: 11 },
    { id: "outputs", label: "输出或结果说明", passed: has(/outputs?|returns?|response|输出|返回|结果/), weight: 9 },
    { id: "limitations", label: "限制、权限或边界", passed: has(/limitations?|caveats?|permissions?|security|限制|注意|权限|安全/), weight: 12 },
    { id: "errors", label: "错误处理或排障", passed: has(/errors?|troubleshoot|faq|错误|排障|常见问题/), weight: 8 },
    { id: "license", label: "许可证信息", passed: has(/license|许可证/) || filePaths.some((path) => /license/i.test(path)), weight: 5 },
    { id: "structure", label: "结构化章节", passed: (readme.match(/^#{1,4}\s+/gm) ?? []).length >= 3, weight: 3 },
  ];
  const rawScore = checks.reduce((sum, check) => sum + (check.passed ? check.weight : 0), 0);
  const checklistGamingDetected = isDocumentationChecklistGaming(readme, rawScore);
  if (checklistGamingDetected) {
    checks = checks.map((check) => DOCUMENTATION_EVIDENCE_CHECK_IDS.has(check.id)
      ? { ...check, passed: false, evidence: "关键词集中但缺少可执行、可核对的采用证据" }
      : check);
  }
  const score = checks.reduce((sum, check) => sum + (check.passed ? check.weight : 0), 0);
  const passed = checks.filter((check) => check.passed).map((check) => check.label);
  const missing = checks.filter((check) => !check.passed).map((check) => check.label);
  return {
    score: clamp(score),
    details: checklistGamingDetected
      ? `${passed.length}/${checks.length} 项文档检查通过 · 已触发反关键词堆砌保护`
      : `${passed.length}/${checks.length} 项文档检查通过`,
    checks,
    strengths: passed.slice(0, 4),
    improvements: checklistGamingDetected
      ? ["提供可执行、可核对的接入与边界证据", ...missing].slice(0, 5)
      : missing.slice(0, 5),
  };
}

export function scorePopularity(stats: PopularityStats): number {
  const stars = Math.min(55, Math.log10(1 + Math.max(0, stats.stars)) * 13.75);
  const downloads = Math.min(30, Math.log10(1 + Math.max(0, stats.downloadsWeekly)) * 5);
  const forks = Math.min(10, Math.log10(1 + Math.max(0, stats.forks)) * 3.3);
  const growth = Math.min(5, Math.log10(1 + Math.max(0, stats.starsGrowth30d)) * 2.5);
  return clamp(stars + downloads + forks + growth);
}

export function scoreActivity(
  lastCommit: Date | null,
  openIssues: number,
  stars: number,
  now = new Date(),
): number {
  if (!lastCommit) return 15;
  const days = Math.max(0, (now.getTime() - lastCommit.getTime()) / 86_400_000);
  const freshness = days <= 7 ? 100 : days <= 30 ? 90 : days <= 90 ? 72 : days <= 180 ? 52 : days <= 365 ? 30 : 12;
  const issuePenalty = stars >= 20 && openIssues > Math.max(50, stars * 0.35) ? 10 : 0;
  return clamp(freshness - issuePenalty);
}

export function deterministicQualityScore(
  doc: DocumentationResult,
  filePaths: string[],
  hasLicense: boolean,
  hasRepo: boolean,
  type: SkillType,
): number {
  const normalizedPaths = filePaths.map((path) => path.toLowerCase());
  const hasSkillSpec = normalizedPaths.some((path) => path.endsWith("skill.md"));
  const hasManifest = normalizedPaths.some((path) => /(?:package\.json|pyproject\.toml|requirements\.txt|mcp\.json)$/.test(path));
  let score = 20;
  if (hasRepo) score += 10;
  if (hasLicense) score += 8;
  if (hasSkillSpec) score += 20;
  if (hasManifest) score += 12;
  if (doc.checks.find((check) => check.id === "example")?.passed) score += 12;
  if (doc.checks.find((check) => check.id === "inputs")?.passed) score += type === "mcp-server" ? 10 : 8;
  if (doc.checks.find((check) => check.id === "limitations")?.passed) score += 7;
  if (doc.checks.find((check) => check.id === "errors")?.passed) score += 5;
  if (doc.score >= 80) score += 5;
  return clamp(score);
}

export function calculateConfidence(input: {
  readmeLength: number;
  fileCount: number;
  aiJudgeUsed: boolean;
  hasRepoMetadata: boolean;
  hasActivity: boolean;
}): number {
  let score = 25;
  score += Math.min(25, input.readmeLength / 400);
  score += Math.min(20, input.fileCount * 4);
  if (input.aiJudgeUsed) score += 15;
  if (input.hasRepoMetadata) score += 10;
  if (input.hasActivity) score += 5;
  return clamp(score);
}

export function combineQualityScore(deterministicScore: number, aiScore: number | null): number {
  return aiScore === null
    ? clamp(deterministicScore)
    : clamp(deterministicScore * 0.45 + aiScore * 0.55);
}

export function calculateOverallScore(input: OverallScoreInput): number {
  let overall = clamp(
    input.documentation * WEIGHTS.documentation +
    input.security * WEIGHTS.security +
    input.popularity * WEIGHTS.popularity +
    input.activity * WEIGHTS.activity +
    input.quality * WEIGHTS.quality,
  );
  if (input.riskLevel === "critical") overall = Math.min(overall, 39);
  if (input.riskLevel === "high") overall = Math.min(overall, 59);
  return overall;
}

function gradeFor(score: number): EvaluationSummary["grade"] {
  if (score >= 92) return "A+";
  if (score >= 85) return "A";
  if (score >= 75) return "B";
  if (score >= 65) return "C";
  if (score >= 50) return "D";
  return "F";
}

function verdictFor(score: number, risk: RiskLevel): EvaluationVerdict {
  if (risk === "critical") return "blocked";
  if (risk === "high") return "caution";
  if (score >= 82) return "recommended";
  if (score >= 68) return "promising";
  if (score >= 50) return "needs-work";
  return "caution";
}

const VERDICT_LABELS: Record<EvaluationVerdict, string> = {
  recommended: "值得推荐",
  promising: "值得试用",
  caution: "谨慎采用",
  "needs-work": "需要完善",
  blocked: "暂不建议使用",
};

export function buildSummary(score: number, riskLevel: RiskLevel, confidence: number): EvaluationSummary {
  const verdict = verdictFor(score, riskLevel);
  const confidenceLabel = confidence >= 80 ? "高" : confidence >= 60 ? "中" : "低";
  const headline = riskLevel === "critical"
    ? "检测到关键风险，修复前不建议接入"
    : verdict === "recommended"
      ? "证据充分，整体质量与安全表现优秀"
      : verdict === "promising"
        ? "核心能力可用，建议在受控范围内试用"
        : verdict === "needs-work"
          ? "具备基础能力，但文档或工程质量仍需完善"
          : "存在需要人工复核的风险或证据不足";
  return {
    grade: gradeFor(score),
    verdict,
    verdictLabel: VERDICT_LABELS[verdict],
    riskLevel,
    confidence,
    confidenceLabel,
    headline,
  };
}
