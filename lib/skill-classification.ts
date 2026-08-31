import type { SkillType } from "./types";

export interface GitHubSkillClassificationInput {
  name: string;
  description: string | null;
  topics: string[];
}

export const SKILL_CLASSIFIER_VERSION = "1.1.0";

/**
 * Classify the repository's deliverable, not merely the protocol words it
 * mentions. Collections, courses, examples and SDKs may discuss MCP heavily
 * without being an installable MCP server.
 */
export function inferGitHubSkillType(repo: GitHubSkillClassificationInput): SkillType {
  const name = repo.name.toLowerCase();
  const description = (repo.description ?? "").toLowerCase();
  const topics = repo.topics.map((topic) => topic.toLowerCase());
  const text = `${name} ${description} ${topics.join(" ")}`;

  const isCollectionOrLearningResource = (
    /(?:^|[-_ ])(?:awesome|examples?|samples?|tutorials?|course|curriculum|workshop|cookbook|beginners?|learning|learn|guides?|templates?|collection|resources?)(?:$|[-_ ])/i.test(name)
    || /\b(?:curated list|learning path|course|curriculum|tutorial|workshop|cookbook|collection of|examples repository|sample repository|educational resource)\b/i.test(description)
    || topics.some((topic) => /^(?:awesome-list|education|tutorial|course|curriculum|examples?|samples?|learning-resources?)$/.test(topic))
  );
  if (isCollectionOrLearningResource) return "agent-pack";

  const hasExplicitSkillSignal = (
    topics.some((topic) => /^(?:claude|agent)[-_ ]?skills?$/.test(topic))
    || /(?:^|[-_ ])(?:claude|agent)[-_ ]?skills?(?:$|[-_ ])/i.test(name)
    || /\b(?:claude|agent) skills?\b/i.test(description)
  );
  if (hasExplicitSkillSignal) return "claude-skill";

  const hasExplicitMcpServerSignal = (
    topics.some((topic) => /^(?:mcp-server|model-context-protocol-server)$/.test(topic))
    || /(?:^|[-_ ])mcp[-_ ]?servers?(?:$|[-_ ])/i.test(name)
    || /\b(?:mcp|model context protocol) servers?\b/i.test(description)
    || /\bserver (?:implementation )?for (?:the )?(?:mcp|model context protocol)\b/i.test(description)
    || /\bimplements? (?:the )?(?:mcp|model context protocol)(?: server)?\b/i.test(description)
  );
  if (hasExplicitMcpServerSignal) return "mcp-server";

  // Generic MCP mentions include clients, SDKs, courses and registries. They
  // stay in the broad agent-pack class unless server evidence is explicit.
  if (/\bmcp\b|model[- ]context[- ]protocol/.test(text)) return "agent-pack";
  return "agent-pack";
}
