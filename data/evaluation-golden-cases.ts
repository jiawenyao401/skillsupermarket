import type { PopularityStats, RiskLevel, SkillType } from "../lib/types";

export const SCORING_GOLDEN_SET_VERSION = "1.2.0";

export interface ScoringGoldenCase {
  id: string;
  description: string | null;
  readme: string;
  filePaths: string[];
  type: SkillType;
  hasLicense: boolean;
  hasRepo: boolean;
  popularity: PopularityStats;
  activity: {
    daysSinceLastCommit: number | null;
    openIssues: number;
    stars: number;
  };
  aiScore: number | null;
  securityScore: number;
  riskLevel: RiskLevel;
  expected: {
    documentation: number;
    deterministicQuality: number;
    quality: number;
    popularity: number;
    activity: number;
    confidence: number;
    overall: number;
    grade: "A+" | "A" | "B" | "C" | "D" | "F";
    verdict: "recommended" | "promising" | "caution" | "needs-work" | "blocked";
  };
}

const completeReadme = `# Production MCP Server

This server gives engineering teams a reproducible way to inspect deployment metadata and diagnose failed jobs without granting write access.

## Install and setup

Install the package, create a least-privilege token, and set the required environment variable before starting the server.

\`\`\`bash
npm install @example/production-mcp
PRODUCTION_MCP_TOKEN=replace-me npx production-mcp --read-only
\`\`\`

## Tools, inputs, and parameters

The inspect_job tool accepts a required job_id input and an optional include_logs argument. The list_deployments tool accepts an environment parameter. Every parameter is validated before a request is sent.

## Outputs and results

Successful calls return a structured response with status, timestamps, and redacted evidence. Empty results are returned as an empty items array rather than an error.

## Security, permissions, and limitations

Use a read-only token with the minimum repository scope. The server never writes deployment state. It does not support private network access without an operator-managed proxy, and it must not be used to expose secrets or personal data.

## Errors and troubleshooting FAQ

Authentication errors return an actionable message without echoing credentials. Retry rate limits with exponential backoff. Confirm the configured environment and token scope before opening an issue.

## License

Released under the Apache-2.0 license. Contributions require tests and must preserve the read-only security boundary.
`;

export const SCORING_GOLDEN_CASES: ScoringGoldenCase[] = [
  {
    id: "mature-mcp-with-ai-review",
    description: "A read-only MCP server for inspecting deployment metadata and diagnosing failed engineering jobs.",
    readme: completeReadme,
    filePaths: ["README.md", "SKILL.md", "package.json"],
    type: "mcp-server",
    hasLicense: true,
    hasRepo: true,
    popularity: {
      stars: 1_000,
      forks: 100,
      downloadsWeekly: 10_000,
      starsGrowth7d: 30,
      starsGrowth30d: 100,
    },
    activity: { daysSinceLastCommit: 5, openIssues: 20, stars: 1_000 },
    aiScore: 88,
    securityScore: 100,
    riskLevel: "low",
    expected: {
      documentation: 100,
      deterministicQuality: 100,
      quality: 93,
      popularity: 73,
      activity: 100,
      confidence: 71,
      overall: 95,
      grade: "A+",
      verdict: "recommended",
    },
  },
  {
    id: "sparse-project-with-insufficient-evidence",
    description: "Tiny tool",
    readme: "# Tiny\n\nRuns.",
    filePaths: ["README.md"],
    type: "agent-pack",
    hasLicense: false,
    hasRepo: true,
    popularity: {
      stars: 0,
      forks: 0,
      downloadsWeekly: 0,
      starsGrowth7d: 0,
      starsGrowth30d: 0,
    },
    activity: { daysSinceLastCommit: null, openIssues: 0, stars: 0 },
    aiScore: null,
    securityScore: 100,
    riskLevel: "low",
    expected: {
      documentation: 0,
      deterministicQuality: 30,
      quality: 30,
      popularity: 0,
      activity: 15,
      confidence: 35,
      overall: 36,
      grade: "F",
      verdict: "caution",
    },
  },
  {
    id: "strong-project-blocked-by-critical-risk",
    description: "A read-only MCP server for inspecting deployment metadata and diagnosing failed engineering jobs.",
    readme: completeReadme,
    filePaths: ["README.md", "SKILL.md", "package.json"],
    type: "mcp-server",
    hasLicense: true,
    hasRepo: true,
    popularity: {
      stars: 1_000,
      forks: 100,
      downloadsWeekly: 10_000,
      starsGrowth7d: 30,
      starsGrowth30d: 100,
    },
    activity: { daysSinceLastCommit: 5, openIssues: 20, stars: 1_000 },
    aiScore: null,
    securityScore: 20,
    riskLevel: "critical",
    expected: {
      documentation: 100,
      deterministicQuality: 100,
      quality: 100,
      popularity: 73,
      activity: 100,
      confidence: 56,
      overall: 39,
      grade: "F",
      verdict: "blocked",
    },
  },
];
