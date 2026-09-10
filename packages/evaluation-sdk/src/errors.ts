export type EvaluationErrorCode =
  | "INVALID_INPUT"
  | "INVALID_OPTIONS"
  | "JUDGE_UNAVAILABLE"
  | "JUDGE_FAILED"
  | "JUDGE_TIMEOUT"
  | "ABORTED";

const MESSAGES: Record<EvaluationErrorCode, string> = {
  INVALID_INPUT: "评测输入无效或超过证据大小限制",
  INVALID_OPTIONS: "SDK 配置无效",
  JUDGE_UNAVAILABLE: "要求 AI 复核，但未提供 Judge",
  JUDGE_FAILED: "AI 复核失败或返回了无效的评测结果",
  JUDGE_TIMEOUT: "AI 复核超时",
  ABORTED: "评测已取消",
};

/** Messages deliberately omit evidence, API keys, upstream bodies and causes. */
export class EvaluationError extends Error {
  readonly code: EvaluationErrorCode;
  constructor(code: EvaluationErrorCode) {
    super(MESSAGES[code]);
    this.name = "EvaluationError";
    this.code = code;
  }
}

export function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw new EvaluationError("ABORTED");
}
