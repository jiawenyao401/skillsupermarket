import type { SkillType } from "../lib/types";

export const DIAGRAM_RECOVERY_BENCHMARK_VERSION = "1.0.0";

export interface DiagramRecoveryBenchmarkCase {
  id: string;
  repository: string;
  ref: string;
  name: string;
  type: SkillType;
  description: string;
  expectedStatuses: Array<"generated" | "insufficient-evidence" | "invalid-output">;
  expectedRecoveryEligible?: boolean;
}

/**
 * Real production examples pinned to immutable commits. These entries contain
 * metadata only; benchmark evidence is fetched from the recorded public ref.
 */
export const DIAGRAM_RECOVERY_BENCHMARK_CASES: DiagramRecoveryBenchmarkCase[] = [
  {
    id: "irrelevant-fork-demo",
    repository: "octocat/Spoon-Knife",
    ref: "d0dd1f61b33d64e29d8bc1372a94ef6a2fee76a9",
    name: "Spoon-Knife",
    type: "agent-pack",
    description: "This repo is for demonstration purposes only.",
    expectedStatuses: ["insufficient-evidence"],
    expectedRecoveryEligible: false,
  },
  {
    id: "directory-without-relationships",
    repository: "openai/skills",
    ref: "49f948faa9258a0c61caceaf225e179651397431",
    name: "skills",
    type: "agent-pack",
    description: "Skills Catalog for Codex",
    expectedStatuses: ["insufficient-evidence"],
    expectedRecoveryEligible: false,
  },
  {
    id: "explicit-learning-path",
    repository: "liyupi/ai-guide",
    ref: "64dccf5ce1b3481646392d55f616c0d83b4db656",
    name: "ai-guide",
    type: "agent-pack",
    description: "AI 资源大全与 Vibe Coding 零基础教程",
    expectedStatuses: ["generated"],
    expectedRecoveryEligible: true,
  },
  {
    id: "skill-architecture-control",
    repository: "google-labs-code/stitch-skills",
    ref: "0337446dadde6f8c94210444e2aa9d546126480f",
    name: "stitch-skills",
    type: "claude-skill",
    description: "Agent Skills designed to work with the Stitch MCP server",
    expectedStatuses: ["generated"],
  },
  {
    id: "mcp-sequence-control",
    repository: "idosal/git-mcp",
    ref: "c487a29895dcfcb5b672247e646426a56e2051c1",
    name: "git-mcp",
    type: "mcp-server",
    description: "Remote MCP server for public GitHub projects",
    expectedStatuses: ["generated"],
  },
  {
    id: "known-unstable-output-control",
    repository: "Agents365-ai/drawio-skill",
    ref: "7b996a17d05509bac95227c8e58397a8a175a1b9",
    name: "drawio-skill",
    type: "claude-skill",
    description: "Generate maintainable draw.io architecture models from text and real sources",
    // Baseline alternates between a valid flow and a schema-invalid graph.
    // The benchmark tracks that known variance while guarding the stable cases.
    expectedStatuses: ["generated", "invalid-output"],
  },
];
