// 领域类型定义 - 与 lib/schema.ts (Drizzle) 保持一致

export type SkillType = "claude-skill" | "mcp-server" | "agent-pack";
export type SkillStatus = "active" | "archived" | "removed";
export type SkillSource = "official" | "github" | "npm" | "pypi" | "manual";
export type RankingPeriod = "daily" | "weekly" | "monthly";
export type JobStatus = "pending" | "running" | "done" | "failed";

export interface Skill {
  id: string;
  slug: string;
  type: SkillType;
  name: string;
  description: string | null;
  tags: string[];
  category: string | null;

  source: SkillSource | null;
  repoUrl: string | null;
  packageUrl: string | null;
  homepageUrl: string | null;

  authorName: string | null;
  authorAvatar: string | null;
  authorUrl: string | null;

  license: string | null;
  currentVersion: string | null;
  firstSeenAt: Date;
  lastUpdatedAt: Date;
  lastIndexedAt: Date | null;

  githubStars: number;
  githubForks: number;
  githubWatchers: number;
  githubOpenIssues: number;
  githubLastCommit: Date | null;
  npmDownloadsWeekly: number;
  pypiDownloadsWeekly: number;

  status: SkillStatus;
  createdAt: Date;
}

export interface Evaluation {
  id: string;
  skillId: string;
  overallScore: number;

  documentationScore: number;
  securityScore: number;
  popularityScore: number;
  activityScore: number;
  qualityScore: number;

  report: EvaluationReport;
  evaluatedBy: string;
  evaluatedAt: Date;
}

export interface EvaluationReport {
  version?: string;
  summary?: EvaluationSummary;
  diagram?: EvaluationDiagram;
  documentation: {
    score: number;
    details: string;
    checks?: EvaluationCheck[];
    strengths?: string[];
    improvements?: string[];
  };
  security: {
    score: number;
    details: string;
    findings: SecurityFinding[];
    riskLevel?: RiskLevel;
    scannedFiles?: number;
    scannedCharacters?: number;
  };
  popularity: { score: number; details: string; stats: PopularityStats };
  activity: { score: number; details: string; lastCommitAt?: string | null };
  quality: {
    score: number;
    details: string;
    llmComment?: string;
    deterministicScore?: number;
    aiScore?: number | null;
    subScores?: QualitySubScores;
    evidence?: string[];
  };
  recommendation?: EvaluationRecommendation;
  methodology?: EvaluationMethodology;
  overall: number;
}

export type EvaluationDiagramType = "flow" | "sequence" | "architecture";
export type EvaluationDiagramStatus =
  | "generated"
  | "insufficient-evidence"
  | "invalid-output"
  | "judge-unavailable";

export interface EvaluationDiagramNode {
  id: string;
  label: string;
  role?: string;
}

export interface EvaluationDiagramEdge {
  from: string;
  to: string;
  label: string;
}

export interface EvaluationDiagram {
  type: EvaluationDiagramType;
  title: string;
  rationale: string;
  nodes: EvaluationDiagramNode[];
  edges: EvaluationDiagramEdge[];
  evidence: string[];
}

export interface SecurityFinding {
  level: "info" | "warning" | "danger";
  type: string;
  message: string;
  location?: string;
  evidence?: string;
  remediation?: string;
  confidence?: "low" | "medium" | "high";
  category?: "prompt-injection" | "secret" | "dangerous-api" | "supply-chain";
}

export type RiskLevel = "low" | "medium" | "high" | "critical";
export type EvaluationVerdict =
  | "recommended"
  | "promising"
  | "caution"
  | "needs-work"
  | "blocked";

export interface EvaluationSummary {
  grade: "A+" | "A" | "B" | "C" | "D" | "F";
  verdict: EvaluationVerdict;
  verdictLabel: string;
  riskLevel: RiskLevel;
  confidence: number;
  confidenceLabel: "高" | "中" | "低";
  headline: string;
}

export interface EvaluationCheck {
  id: string;
  label: string;
  passed: boolean;
  weight: number;
  evidence?: string;
}

export interface QualitySubScores {
  utility: number;
  clarity: number;
  reusability: number;
  design: number;
  documentation: number;
}

export interface EvaluationRecommendation {
  strengths: string[];
  concerns: string[];
  bestFor: string[];
  avoidFor: string[];
  nextActions: string[];
}

export type EvaluationConfidenceFactorId =
  | "evaluation-complete"
  | "readme-evidence"
  | "independent-sources"
  | "repository-metadata"
  | "activity"
  | "ai-review";

export interface EvaluationConfidenceFactor {
  id: EvaluationConfidenceFactorId;
  label: string;
  status: "strong" | "partial" | "missing";
  contribution: number;
  maxContribution: number;
  detail: string;
}

export interface EvaluationMethodology {
  evaluatorVersion: string;
  evaluatedAt: string;
  sources: string[];
  scannedFiles: string[];
  scannedCharacters: number;
  aiJudgeUsed: boolean;
  diagramStatus?: EvaluationDiagramStatus;
  aiJudgeModel?: string;
  rubricVersion?: string;
  aiJudgeCalibration?: string[];
  evaluatedSkillType?: SkillType;
  skillClassifierVersion?: string;
  weights: Record<string, number>;
  limitations: string[];
  confidenceFactors?: EvaluationConfidenceFactor[];
  caseStudy?: boolean;
}

export interface PopularityStats {
  stars: number;
  forks: number;
  downloadsWeekly: number;
  starsGrowth7d: number;
  starsGrowth30d: number;
}

export interface MetricsDaily {
  skillId: string;
  date: string;
  githubStars: number;
  githubStarsDelta: number;
  githubForks: number;
  githubOpenIssues: number;
  npmDownloadsWeekly: number;
  pypiDownloadsWeekly: number;
  hotScore: number;
}

export interface Ranking {
  id: string;
  period: RankingPeriod;
  date: string;
  rank: number;
  skillId: string;
  score: number;
}

export interface EvaluationJob {
  id: string;
  skillId: string;
  status: JobStatus;
  triggeredBy: string | null;
  startedAt: Date | null;
  finishedAt: Date | null;
  error: string | null;
  createdAt: Date;
}

// 用于 UI 展示的合成类型
export interface SkillWithEvaluation extends Skill {
  evaluation: Evaluation | null;
  hotScore: number;
}
