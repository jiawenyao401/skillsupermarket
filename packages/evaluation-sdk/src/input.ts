import { z } from "zod";
import { EvaluationError } from "./errors.ts";

export const EVIDENCE_LIMITS = Object.freeze({
  documentCharacters: 250_000,
  totalCharacters: 2_000_000,
  files: 64,
});

const count = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const delta = z.number().int().min(Number.MIN_SAFE_INTEGER).max(Number.MAX_SAFE_INTEGER);
export const timestampSchema = z.string().datetime({ offset: true }).refine((value) => Number.isFinite(Date.parse(value)));
const inputSchema = z.object({
  name: z.string().trim().min(1).max(200),
  type: z.enum(["claude-skill", "mcp-server", "agent-pack"]),
  description: z.string().max(10_000).nullable().optional().default(null),
  readme: z.string().max(EVIDENCE_LIMITS.documentCharacters),
  files: z.array(z.object({
    path: z.string().min(1).max(500).refine((value) =>
      !/[\u0000-\u001f\u007f\\]/.test(value) && !value.startsWith("/") &&
      !value.split("/").some((part) => !part || part === "." || part === "..") &&
      !/^[a-z]:/i.test(value)),
    content: z.string().max(EVIDENCE_LIMITS.documentCharacters),
    kind: z.enum(["documentation", "instruction", "code", "manifest"]).optional(),
  }).strict()).max(EVIDENCE_LIMITS.files).default([]),
  hasLicense: z.boolean().default(false),
  hasRepository: z.boolean().default(false),
  hasRepositoryMetadata: z.boolean().default(false),
  lastCommitAt: timestampSchema.nullable().default(null),
  openIssues: count.default(0),
  popularity: z.object({
    stars: count.default(0),
    forks: count.default(0),
    downloadsWeekly: count.default(0),
    starsGrowth7d: delta.default(0),
    starsGrowth30d: delta.default(0),
  }).strict().default({}),
  sources: z.array(z.string().trim().min(1).max(200)).max(16).default(["Caller-provided evidence"]),
  classifierVersion: z.string().min(1).max(80).optional(),
  caseStudy: z.boolean().default(false),
}).strict().superRefine((input, ctx) => {
  const paths = input.files.map((file) => file.path.toLowerCase());
  if (paths.includes("readme.md") || new Set(paths).size !== paths.length) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Duplicate evidence paths" });
  }
  if (input.readme.length + input.files.reduce((sum, file) => sum + file.content.length, 0) > EVIDENCE_LIMITS.totalCharacters) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Evidence size exceeded" });
  }
});

export type EvaluationInput = z.input<typeof inputSchema>;

/** Validates and copies JSON-shaped evidence. It never reads paths or fetches URLs. */
export function parseEvaluationInput(input: unknown): z.output<typeof inputSchema> {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) throw new EvaluationError("INVALID_INPUT");
  return parsed.data;
}

export function inferDocumentKind(path: string): "documentation" | "instruction" | "code" | "manifest" {
  const normalized = path.toLowerCase();
  if (normalized.includes("skill.md")) return "instruction";
  if (normalized.endsWith(".json") || normalized.endsWith(".toml") || normalized.includes("requirements")) return "manifest";
  if (/dockerfile|\.ya?ml$|\.js$|\.ts$|\.py$/.test(normalized)) return "code";
  return "documentation";
}
