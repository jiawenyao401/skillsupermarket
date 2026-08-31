import assert from "node:assert/strict";
import test from "node:test";
import { inferGitHubSkillType, SKILL_CLASSIFIER_VERSION } from "../lib/skill-classification";
import {
  planGitHubSkillReclassification,
  summarizeSkillTypeChanges,
} from "../lib/skill-reclassification";

test(`GitHub skill classifier ${SKILL_CLASSIFIER_VERSION} distinguishes products from learning resources`, () => {
  assert.equal(inferGitHubSkillType({
    name: "mcp-for-beginners",
    description: "This open-source curriculum teaches Model Context Protocol concepts with lessons and labs.",
    topics: ["mcp", "education", "curriculum"],
  }), "agent-pack");
  assert.equal(inferGitHubSkillType({
    name: "awesome-mcp-servers",
    description: "A curated list of Model Context Protocol servers and resources.",
    topics: ["awesome-list", "mcp"],
  }), "agent-pack");
  assert.equal(inferGitHubSkillType({
    name: "mcp-sdk",
    description: "A TypeScript SDK and client library for Model Context Protocol.",
    topics: ["mcp", "sdk"],
  }), "agent-pack");
});

test(`GitHub skill classifier ${SKILL_CLASSIFIER_VERSION} keeps explicit servers and skills precise`, () => {
  assert.equal(inferGitHubSkillType({
    name: "github-mcp-server",
    description: "The GitHub MCP server implements Model Context Protocol tools.",
    topics: ["mcp-server"],
  }), "mcp-server");
  assert.equal(inferGitHubSkillType({
    name: "servers",
    description: "Model Context Protocol servers maintained as reference implementations.",
    topics: ["model-context-protocol"],
  }), "mcp-server");
  assert.equal(inferGitHubSkillType({
    name: "deployment-claude-skill",
    description: "A Claude Skill for diagnosing deployments.",
    topics: ["claude-skill"],
  }), "claude-skill");
});

test(`GitHub skill classifier ${SKILL_CLASSIFIER_VERSION} does not let collection wording masquerade as a server`, () => {
  assert.equal(inferGitHubSkillType({
    name: "mcp-server-examples",
    description: "An examples repository containing multiple MCP server demonstrations.",
    topics: ["mcp-server", "examples"],
  }), "agent-pack");
});

test(`GitHub skill classifier ${SKILL_CLASSIFIER_VERSION} produces a deterministic inventory migration plan`, () => {
  const changes = planGitHubSkillReclassification([
    {
      id: "course",
      name: "mcp-for-beginners",
      description: "A Model Context Protocol curriculum with lessons and labs.",
      tags: ["mcp", "curriculum"],
      type: "mcp-server",
      hasEvaluation: true,
    },
    {
      id: "server",
      name: "github-mcp-server",
      description: "An MCP server implementation for GitHub.",
      tags: ["mcp-server"],
      type: "mcp-server",
      hasEvaluation: false,
    },
    {
      id: "skill",
      name: "deployment-claude-skill",
      description: "A Claude Skill for deployment diagnostics.",
      tags: null,
      type: "agent-pack",
      hasEvaluation: false,
    },
  ]);

  assert.deepEqual(changes, [
    { id: "course", from: "mcp-server", to: "agent-pack", hasEvaluation: true },
    { id: "skill", from: "agent-pack", to: "claude-skill", hasEvaluation: false },
  ]);
  assert.deepEqual(summarizeSkillTypeChanges(changes), {
    "mcp-server->agent-pack": 1,
    "agent-pack->claude-skill": 1,
  });
});
