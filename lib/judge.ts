// Website configuration adapter; the SDK never reads process.env.
import { createLLMJudge, type JudgeInput, type JudgeResult } from "../packages/evaluation-sdk/src/llm-judge";
export * from "../packages/evaluation-sdk/src/judge";

interface JudgeConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
  provider: "deepseek" | "openai" | "anthropic";
}

function configuredKey(value: string | undefined): string {
  return value?.trim() ?? "";
}

export function hasJudgeConfiguration(
  env: Readonly<Record<string, string | undefined>> = process.env,
): boolean {
  return Boolean(
    configuredKey(env.DEEPSEEK_API_KEY)
    || configuredKey(env.OPENAI_API_KEY)
    || configuredKey(env.ANTHROPIC_API_KEY)
  );
}

function getConfig(): JudgeConfig {
  const deepseekApiKey = configuredKey(process.env.DEEPSEEK_API_KEY);
  const openaiApiKey = configuredKey(process.env.OPENAI_API_KEY);
  const anthropicApiKey = configuredKey(process.env.ANTHROPIC_API_KEY);
  if (deepseekApiKey) {
    return {
      apiKey: deepseekApiKey,
      baseUrl: process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com",
      model: process.env.DEEPSEEK_MODEL || "deepseek-chat",
      provider: "deepseek",
    };
  }
  if (openaiApiKey) {
    return {
      apiKey: openaiApiKey,
      baseUrl: "https://api.openai.com/v1",
      model: process.env.OPENAI_JUDGE_MODEL || "gpt-4.1-mini",
      provider: "openai",
    };
  }
  if (anthropicApiKey) {
    return {
      apiKey: anthropicApiKey,
      baseUrl: "https://api.anthropic.com",
      model: process.env.ANTHROPIC_JUDGE_MODEL || "claude-haiku-4-5",
      provider: "anthropic",
    };
  }
  throw new Error("未配置可用的 LLM Judge");
}

export async function judgeSkill(input: JudgeInput, context?: { signal: AbortSignal }): Promise<JudgeResult> {
  return createLLMJudge(getConfig())(input, context ?? { signal: new AbortController().signal });
}
