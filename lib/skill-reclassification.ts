import type { SkillType } from "./types";
import { inferGitHubSkillType } from "./skill-classification";

export interface ReclassifiableGitHubSkill {
  id: string;
  name: string;
  description: string | null;
  tags: string[] | null;
  type: SkillType;
  hasEvaluation: boolean;
}

export interface SkillTypeChange {
  id: string;
  from: SkillType;
  to: SkillType;
  hasEvaluation: boolean;
}

/**
 * Build a deterministic migration plan from public GitHub metadata. Keeping
 * planning pure makes classifier rollouts regression-testable before any
 * inventory or evaluation job is changed.
 */
export function planGitHubSkillReclassification(
  skills: ReclassifiableGitHubSkill[],
): SkillTypeChange[] {
  return skills.flatMap((skill) => {
    const inferredType = inferGitHubSkillType({
      name: skill.name,
      description: skill.description,
      topics: skill.tags ?? [],
    });
    if (inferredType === skill.type) return [];
    return [{
      id: skill.id,
      from: skill.type,
      to: inferredType,
      hasEvaluation: skill.hasEvaluation,
    }];
  });
}

export function summarizeSkillTypeChanges(changes: SkillTypeChange[]): Record<string, number> {
  return changes.reduce<Record<string, number>>((summary, change) => {
    const transition = `${change.from}->${change.to}`;
    summary[transition] = (summary[transition] ?? 0) + 1;
    return summary;
  }, {});
}
