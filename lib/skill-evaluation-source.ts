import { parseEvaluationSource } from "@/lib/source-parser";

export interface EvaluatableSkillSource {
  source: "official" | "github" | "npm" | "pypi" | "manual" | null;
  name: string;
  repoUrl: string | null;
  packageUrl: string | null;
}

export function getSkillEvaluationSource(skill: EvaluatableSkillSource): string | null {
  const candidates = skill.source === "npm"
    ? [skill.packageUrl, skill.name, skill.repoUrl]
    : skill.source === "pypi"
      ? [`pypi:${skill.name}`, skill.packageUrl, skill.repoUrl]
      : [skill.repoUrl, skill.packageUrl];

  return candidates.find((candidate): candidate is string => Boolean(candidate && parseEvaluationSource(candidate))) ?? null;
}
