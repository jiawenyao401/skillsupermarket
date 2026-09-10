import { z } from "zod";
import { EvaluationError, throwIfAborted } from "./errors.ts";
import { runJudge, type JudgeInput, type JudgeResult } from "./judge.ts";

export type { JudgeInput, JudgeResult } from "./judge.ts";
export type Judge = (input: JudgeInput, context: { signal: AbortSignal }) => Promise<JudgeResult>;

export interface LLMJudgeOptions {
  provider: "deepseek" | "openai" | "anthropic";
  apiKey: string;
  model: string;
  /** HTTPS API root; OpenAI-compatible roots usually end in /v1. */
  baseUrl?: string;
  /** Per-request deadline, including reading the response body. Default: 30s. */
  timeoutMs?: number;
  /** Trusted transport for tests or an application-controlled proxy. */
  fetch?: typeof globalThis.fetch;
}

const DEFAULT_BASE_URLS = {
  deepseek: "https://api.deepseek.com",
  openai: "https://api.openai.com/v1",
  anthropic: "https://api.anthropic.com",
} as const;
const MAX_RESPONSE_BYTES = 1_048_576;
const configSchema = z.object({
  provider: z.enum(["deepseek", "openai", "anthropic"]),
  apiKey: z.string().trim().min(1).max(4096).refine((value) => !/[\r\n]/.test(value)),
  model: z.string().trim().min(1).max(200),
  baseUrl: z.string().url().optional(),
  timeoutMs: z.number().int().min(1).max(300_000).default(30_000),
  fetch: z.custom<typeof globalThis.fetch>((value) => typeof value === "function").optional(),
}).strict();

async function readJson(response: Response): Promise<unknown> {
  const length = response.headers.get("content-length");
  if (length && Number(length) > MAX_RESPONSE_BYTES) {
    await response.body?.cancel();
    throw new EvaluationError("JUDGE_FAILED");
  }
  if (!response.body) throw new EvaluationError("JUDGE_FAILED");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let bytes = 0;
  let text = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > MAX_RESPONSE_BYTES) throw new EvaluationError("JUDGE_FAILED");
      text += decoder.decode(value, { stream: true });
    }
    return JSON.parse(text + decoder.decode());
  } finally {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}

/** Explicit credentials only. No environment lookup, telemetry or persistent state. */
export function createLLMJudge(options: LLMJudgeOptions): Judge {
  const parsed = configSchema.safeParse(options);
  if (!parsed.success) throw new EvaluationError("INVALID_OPTIONS");
  const config = parsed.data;
  const base = new URL(config.baseUrl ?? DEFAULT_BASE_URLS[config.provider]);
  const localHttp = base.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(base.hostname);
  if ((!localHttp && base.protocol !== "https:") || base.username || base.password || base.search || base.hash) {
    throw new EvaluationError("INVALID_OPTIONS");
  }
  const url = base.href.replace(/\/$/, "") + (config.provider === "anthropic" ? "/v1/messages" : "/chat/completions");
  const transport = config.fetch ?? globalThis.fetch;
  return async (input, { signal }) => {
    throwIfAborted(signal);
    const request = Object.assign(async (prompt: string, system: string, maxTokens: number): Promise<unknown> => {
      throwIfAborted(signal);
      const deadline = AbortSignal.timeout(config.timeoutMs);
      const combined = AbortSignal.any([signal, deadline]);
      try {
        const anthropic = config.provider === "anthropic";
        const response = await transport(url, {
          method: "POST",
          redirect: "error",
          cache: "no-store",
          signal: combined,
          headers: {
            "Content-Type": "application/json",
            ...(anthropic
              ? { "x-api-key": config.apiKey, "anthropic-version": "2023-06-01" }
              : { Authorization: `Bearer ${config.apiKey}` }),
          },
          body: JSON.stringify({
            model: config.model,
            max_tokens: maxTokens,
            temperature: 0,
            // Keep the bounded JSON judge non-thinking, including newer DeepSeek
            // model names whose API default would spend this budget on reasoning.
            ...(config.provider === "deepseek" ? { thinking: { type: "disabled" } } : {}),
            ...(anthropic
              ? { system, messages: [{ role: "user", content: prompt }] }
              : { response_format: { type: "json_object" }, messages: [{ role: "system", content: system }, { role: "user", content: prompt }] }),
          }),
        });
        if (!response.ok) {
          await response.body?.cancel();
          throw new EvaluationError("JUDGE_FAILED");
        }
        const data = await readJson(response);
        // Validate the envelope without reflecting provider content in errors.
        const envelope = anthropic
          ? z.object({ content: z.array(z.object({ text: z.string() })).min(1) }).parse(data).content[0].text
          : z.object({ choices: z.array(z.object({ message: z.object({ content: z.string() }) })).min(1) }).parse(data).choices[0].message.content;
        const jsonMatch = envelope.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new EvaluationError("JUDGE_FAILED");
        return JSON.parse(jsonMatch[0]);
      } catch {
        throwIfAborted(signal);
        throw new EvaluationError(deadline.aborted ? "JUDGE_TIMEOUT" : "JUDGE_FAILED");
      }
    }, { model: config.model });
    try {
      const result = await runJudge(input, request);
      throwIfAborted(signal);
      return result;
    } catch (error) {
      throwIfAborted(signal);
      throw error instanceof EvaluationError ? error : new EvaluationError("JUDGE_FAILED");
    }
  };
}
