import type {
  EvaluationCheck,
  EvaluationConfidenceFactor,
  EvaluationSummary,
  EvaluationVerdict,
  PopularityStats,
  RiskLevel,
  SecurityFinding,
  SkillType,
} from "./types";

export const EVALUATOR_VERSION = "3.7.0";

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

export interface EvidenceDocument {
  path: string;
  content: string;
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

interface FencedCodeBlock {
  language: string;
  content: string;
}

function fencedCodeBlocks(readme: string): FencedCodeBlock[] {
  return [...readme.matchAll(/```([^\n]*)\n([\s\S]*?)```/g)].map((match) => ({
    language: match[1].trim().toLowerCase(),
    content: match[2].trim(),
  }));
}

function hasActionableAdoptionEvidence(readme: string): boolean {
  return fencedCodeBlocks(readme).some(({ content: block }) => [
    /(?:^|\n)\s*(?:\$\s*)?(?:npm|pnpm|yarn|bun)\s+(?:i|install|add|exec|dlx)\s+\S+/im,
    /(?:^|\n)\s*(?:\$\s*)?(?:npx|bunx)\s+\S+/im,
    /(?:^|\n)\s*(?:\$\s*)?(?:(?:python\s+-m\s+)?pip3?|pipx)\s+install\s+\S+/im,
    /(?:^|\n)\s*(?:\$\s*)?uv\s+(?:add|run|tool\s+install)\s+\S+/im,
    /(?:^|\n)\s*(?:\$\s*)?docker\s+(?:run|compose)\b/im,
    /(?:^|\n)\s*(?:\$\s*)?(?:brew|cargo|go)\s+install\s+\S+/im,
    /(?:^|\n)\s*(?:\$\s*)?git\s+clone\s+\S+/im,
    /(?:^|\n)\s*(?:\$\s*)?(?:claude|codex|gemini)\s+(?:mcp|skills?|extensions?)\s+(?:add|install)\s+\S+/im,
    /["']command["']\s*:\s*["'][^"']+["']/i,
    /(?:^|\n)\s*command\s*:\s*\S+/im,
  ].some((pattern) => pattern.test(block)));
}

function hasConcreteUsageEvidence(readme: string): boolean {
  return fencedCodeBlocks(readme).some(({ language, content }) => {
    if (content.length < 20 || /^(?:text|txt|plaintext|output)$/i.test(language)) return false;
    const jsonProperties = content.match(/["'][\w.-]+["']\s*:\s*(?:["'\d[{]|true\b|false\b|null\b)/g) ?? [];
    const yamlProperties = content.match(/^\s*[\w.-]+\s*:\s*\S.+$/gm) ?? [];
    return [
      /(?:^|\n)\s*(?:\$\s*)?(?:curl|git|node|python3?|deno|claude|codex|gemini)\s+\S+/im,
      /(?:^|\n)\s*(?:GET|POST|PUT|PATCH|DELETE)\s+\/\S+/m,
      /(?:^|\n)\s*(?:await\s+)?[\w$.]+\s*\([^\n)]*\)/m,
      /(?:^|\n)\s*(?:import\s+.+\s+from\s+|from\s+\S+\s+import\s+)/m,
    ].some((pattern) => pattern.test(content)) || jsonProperties.length >= 2 || yamlProperties.length >= 2;
  });
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
 * covers nearly the full checklist, either packed or spread across headings, but
 * provides neither executable adoption evidence nor a structured usage example.
 */
function isDocumentationChecklistGaming(readme: string, rawScore: number): boolean {
  if (rawScore < 80 || hasActionableAdoptionEvidence(readme) || hasConcreteUsageEvidence(readme)) return false;
  return hasPackedChecklistLanguage(readme) || DOCUMENTATION_SIGNAL_PATTERNS.every((pattern) => pattern.test(readme));
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
  const hasInstallSignal = has(/install|安装|setup|配置|quick\s*start|getting\s*started/);
  const hasExampleSignal = /```[\s\S]{20,}?```/.test(readme);
  const hasAdoptionEvidence = hasActionableAdoptionEvidence(readme);
  const hasUsageEvidence = hasConcreteUsageEvidence(readme);
  let checks: EvaluationCheck[] = [
    { id: "description", label: "问题与用途描述", passed: Boolean(description && description.trim().length >= 40), weight: 10 },
    { id: "readme", label: "有效 README", passed: readme.trim().length >= 500, weight: 12, evidence: `${readme.trim().length} 字符` },
    {
      id: "install",
      label: "安装或接入步骤",
      passed: hasInstallSignal && hasAdoptionEvidence,
      weight: 14,
      evidence: hasInstallSignal && !hasAdoptionEvidence ? "仅提及安装，缺少可执行命令或工具配置" : undefined,
    },
    {
      id: "example",
      label: "可执行示例",
      passed: hasExampleSignal && (hasAdoptionEvidence || hasUsageEvidence),
      weight: 16,
      evidence: hasExampleSignal && !hasAdoptionEvidence && !hasUsageEvidence
        ? "代码块不包含可执行调用或结构化请求"
        : undefined,
    },
    { id: "inputs", label: "输入、参数或工具说明", passed: has(/parameters?|arguments?|inputs?|参数|输入|tools?|工具/), weight: 11 },
    { id: "outputs", label: "输出或结果说明", passed: has(/outputs?|returns?|response|输出|返回|结果/), weight: 9 },
    { id: "limitations", label: "限制、权限或边界", passed: has(/limitations?|caveats?|permissions?|security|限制|注意|权限|安全/), weight: 12 },
    { id: "errors", label: "错误处理或排障", passed: has(/errors?|troubleshoot|faq|错误|排障|常见问题/), weight: 8 },
    { id: "license", label: "许可证信息", passed: has(/license|许可证/) || filePaths.some((path) => /license/i.test(path)), weight: 5 },
    { id: "structure", label: "结构化章节", passed: (readme.match(/^#{1,4}\s+/gm) ?? []).length >= 3, weight: 3 },
  ];
  const evidenceScore = checks.reduce((sum, check) => sum + (check.passed ? check.weight : 0), 0);
  const nominalScore = evidenceScore +
    (hasInstallSignal && !hasAdoptionEvidence ? 14 : 0) +
    (hasExampleSignal && !hasAdoptionEvidence && !hasUsageEvidence ? 16 : 0);
  const checklistGamingDetected = isDocumentationChecklistGaming(readme, nominalScore);
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

function evidenceSourceKind(path: string): string {
  const basename = path.toLowerCase().split("/").at(-1) ?? "";
  if (/^readme(?:\.|$)/.test(basename)) return "readme";
  if (basename === "skill.md") return "instruction";
  if (basename === "security.md") return "security";
  if (basename === ".env.example") return "configuration";
  if (/^dockerfile|^docker-compose\.ya?ml$/.test(basename)) return "runtime";
  if (/^(?:package\.json|pyproject\.toml|requirements\.txt|mcp\.json)$/.test(basename)) return "manifest";
  if (/^licen[cs]e(?:\.|$)/.test(basename)) return "license";
  return "other";
}

const EVIDENCE_SOURCE_CAPS: Readonly<Record<string, number>> = {
  readme: 1,
  instruction: 4,
  manifest: 2,
  security: 1,
  configuration: 1,
  runtime: 1,
  license: 1,
  other: 1,
};

/** Count distinct, non-trivial evidence with bounded credit per file family. */
export function countIndependentEvidenceSources(documents: readonly EvidenceDocument[]): number {
  const evidenceByKind = new Map<string, Set<string>>();
  for (const document of documents) {
    const normalizedContent = document.content.replace(/\s+/g, " ").trim();
    if (normalizedContent.length < 40) continue;
    const kind = evidenceSourceKind(document.path);
    const contents = evidenceByKind.get(kind) ?? new Set<string>();
    contents.add(normalizedContent);
    evidenceByKind.set(kind, contents);
  }
  return [...evidenceByKind.entries()].reduce(
    (sum, [kind, contents]) => sum + Math.min(EVIDENCE_SOURCE_CAPS[kind] ?? 1, contents.size),
    0,
  );
}

/** Ignore empty, badge-only and repeated lines when measuring README evidence. */
export function calculateEffectiveReadmeEvidenceCharacters(readme: string): number {
  const uniqueLines = new Set<string>();
  for (const line of readme.split(/\r?\n/)) {
    const normalized = line.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    if (!normalized || /^!\[[^\]]*\]\([^)]+\)$/.test(normalized)) continue;
    uniqueLines.add(normalized);
  }
  return [...uniqueLines].reduce((sum, line) => sum + Math.min(400, line.length), 0);
}

export interface ConfidenceInput {
  readmeEvidenceCharacters: number;
  evidenceSourceCount: number;
  aiJudgeUsed: boolean;
  hasRepoMetadata: boolean;
  hasActivity: boolean;
}

export interface ConfidenceBreakdown {
  score: number;
  factors: EvaluationConfidenceFactor[];
}

function factorStatus(contribution: number, maxContribution: number): EvaluationConfidenceFactor["status"] {
  if (contribution <= 0) return "missing";
  return contribution >= maxContribution * 0.6 ? "strong" : "partial";
}

export function calculateConfidenceBreakdown(input: ConfidenceInput): ConfidenceBreakdown {
  const readmeEvidenceCharacters = Math.max(0, Math.round(input.readmeEvidenceCharacters));
  const evidenceSourceCount = Math.max(0, Math.floor(input.evidenceSourceCount));
  const readmeContribution = clamp(readmeEvidenceCharacters / 400, 0, 25);
  const sourceContribution = clamp(evidenceSourceCount * 4, 0, 20);
  const factors: EvaluationConfidenceFactor[] = [
    {
      id: "evaluation-complete",
      label: "基础评测完成",
      status: "strong",
      contribution: 25,
      maxContribution: 25,
      detail: "确定性评分与静态安全扫描已完成",
    },
    {
      id: "readme-evidence",
      label: "README 有效证据",
      status: factorStatus(readmeContribution, 25),
      contribution: readmeContribution,
      maxContribution: 25,
      detail: `${readmeEvidenceCharacters.toLocaleString("zh-CN")} 个去重后的有效字符`,
    },
    {
      id: "independent-sources",
      label: "独立证据来源",
      status: factorStatus(sourceContribution, 20),
      contribution: sourceContribution,
      maxContribution: 20,
      detail: `${evidenceSourceCount} 类非重复证据，重复文件不叠加`,
    },
    {
      id: "repository-metadata",
      label: "仓库元数据",
      status: input.hasRepoMetadata ? "strong" : "missing",
      contribution: input.hasRepoMetadata ? 10 : 0,
      maxContribution: 10,
      detail: input.hasRepoMetadata ? "已取得仓库状态与采用数据" : "未取得可验证的仓库元数据",
    },
    {
      id: "activity",
      label: "活跃记录",
      status: input.hasActivity ? "strong" : "missing",
      contribution: input.hasActivity ? 5 : 0,
      maxContribution: 5,
      detail: input.hasActivity ? "已取得最近提交时间" : "未取得有效提交记录",
    },
    {
      id: "ai-review",
      label: "AI 复核",
      status: input.aiJudgeUsed ? "strong" : "missing",
      contribution: input.aiJudgeUsed ? 15 : 0,
      maxContribution: 15,
      detail: input.aiJudgeUsed ? "已完成结构化 AI 证据复核" : "未启用 AI 复核，本项不加分",
    },
  ];

  return {
    score: clamp(factors.reduce((sum, factor) => sum + factor.contribution, 0)),
    factors,
  };
}

export function calculateConfidence(input: ConfidenceInput): number {
  return calculateConfidenceBreakdown(input).score;
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

/** Keep stored and reconstructed reports on the same security policy. */
export function deriveRiskLevel(
  findings: readonly Pick<SecurityFinding, "level" | "category">[],
): RiskLevel {
  const dangers = findings.filter((finding) => finding.level === "danger").length;
  const warnings = findings.filter((finding) => finding.level === "warning").length;
  const hasSecret = findings.some((finding) => finding.category === "secret");
  if (hasSecret || dangers >= 3) return "critical";
  if (dangers >= 1 || warnings >= 4) return "high";
  if (warnings >= 1) return "medium";
  return "low";
}

function gradeFor(score: number): EvaluationSummary["grade"] {
  if (score >= 92) return "A+";
  if (score >= 85) return "A";
  if (score >= 75) return "B";
  if (score >= 65) return "C";
  if (score >= 50) return "D";
  return "F";
}

function verdictFor(score: number, risk: RiskLevel, confidence: number): EvaluationVerdict {
  if (risk === "critical") return "blocked";
  if (risk === "high") return "caution";
  const scoreVerdict = score >= 82
    ? "recommended"
    : score >= 68
      ? "promising"
      : score >= 50
        ? "needs-work"
        : "caution";
  if (confidence < 40 && (scoreVerdict === "recommended" || scoreVerdict === "promising")) return "caution";
  if (confidence < 60 && scoreVerdict === "recommended") return "promising";
  return scoreVerdict;
}

const VERDICT_LABELS: Record<EvaluationVerdict, string> = {
  recommended: "值得推荐",
  promising: "值得试用",
  caution: "谨慎采用",
  "needs-work": "需要完善",
  blocked: "暂不建议使用",
};

export function buildSummary(score: number, riskLevel: RiskLevel, confidence: number): EvaluationSummary {
  const verdict = verdictFor(score, riskLevel, confidence);
  const confidenceLabel = confidence >= 80 ? "高" : confidence >= 60 ? "中" : "低";
  const headline = riskLevel === "critical"
    ? "检测到关键风险，修复前不建议接入"
    : confidence < 40 && score >= 68
      ? "评分较高但证据严重不足，需要补充材料后复核"
      : confidence < 60 && score >= 82
        ? "评分表现优秀但置信度不足，建议先在受控范围试用"
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

/**
 * Legacy reports predate persisted confidence evidence. Treat that absence as
 * unknown confidence instead of inventing a midpoint or issuing a high-trust
 * recommendation that the stored report cannot substantiate.
 */
export function buildLegacySummary(score: number, riskLevel: RiskLevel): EvaluationSummary {
  return {
    ...buildSummary(score, riskLevel, 0),
    headline: "这是历史评测报告，缺少可核对的置信度证据；请重新评测后再决定是否采用。",
  };
}
