// 领域类型定义 - 与 lib/schema.ts (Drizzle) 保持一致

import type { SkillType, EvaluationReport } from "../packages/evaluation-sdk/src/types";
export type { SkillType, EvaluationReport, EvaluationDiagramType, EvaluationDiagramStatus, EvaluationDiagramRecoveryStatus, EvaluationDiagramRejectionReason, EvaluationDiagramNode, EvaluationDiagramEdge, EvaluationDiagram, SecurityFinding, RiskLevel, EvaluationVerdict, EvaluationSummary, EvaluationCheck, QualitySubScores, EvaluationRecommendation, EvaluationConfidenceFactorId, EvaluationConfidenceFactor, EvaluationMethodology, PopularityStats } from "../packages/evaluation-sdk/src/types";
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
