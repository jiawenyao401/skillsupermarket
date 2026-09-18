/** Opt-in, bounded experiment. Never writes reports, jobs or user events. */
import dotenv from "dotenv";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createLLMJudge } from "../packages/evaluation-sdk/src/llm-judge";
import { protectJudgeInput } from "../packages/evaluation-sdk/src/judge";
import { redactKnownSecrets } from "../packages/evaluation-sdk/src/redaction";
import { baseline } from "./benchmark-readme-evidence";

async function main() {
  if (!process.argv.includes("--live")) throw new Error("Explicit --live required");
  dotenv.config({ quiet: true });
  const model = process.env.DEEPSEEK_MODEL;
  assert.ok(model, "Choose DEEPSEEK_MODEL explicitly");
  assert.ok(process.env.DEEPSEEK_API_KEY);
  const source = await fetch("https://raw.githubusercontent.com/mksglu/context-mode/4112e8485badf11300a8f0b217aa1fcb418193c2/README.md", {
    signal: AbortSignal.timeout(20_000), redirect: "error",
  });
  assert.equal(source.status, 200);
  const readme = await source.text();
  assert.equal(createHash("sha256").update(readme).digest("hex"), "9308e09043c4746340662e7a72e68de155fc28d70a1dd316f5ff292596076d04");
  const contextInput = { name: "Context Mode", type: "mcp-server", description: "Context optimization for AI coding agents", readme,
    deterministicEvidence: ["通过: 安装步骤", "通过: 可执行示例", "通过: 限制或安全边界", "通过: 错误处理"] };
  const inputs = [
    { id: "context-mode-1", ...contextInput }, { id: "context-mode-2", ...contextInput },
    { id: "hosted-control", name: "Fictional hosted control", type: "mcp-server", description: "Synthetic hosted search control, not a real project.",
      readme: "# Hosted search\n## Install\nConfigure the HTTPS endpoint and an API key.\n## Usage\nSend search(query) to receive JSON results.\n## Limitations\nThe core tool requires the hosted service and internet access; it cannot work offline.\n## Privacy\nQueries are transmitted to the service. Only submit non-sensitive test data.\n## Troubleshooting\nBound retries for HTTP 429; stop after three attempts.\n## License\nReview service terms before use.",
      deterministicEvidence: ["通过: 安装步骤", "通过: 限制或安全边界", "通过: 错误处理"] },
  ];
  for (const input of inputs) for (const variant of ["baseline", "candidate"]) {
    const usage: unknown[] = [];
    let calls = 0;
    const judge = createLLMJudge({ provider: "deepseek", apiKey: process.env.DEEPSEEK_API_KEY,
      baseUrl: "https://api.deepseek.com", model, timeoutMs: 60_000,
      fetch: async (url, init) => {
        assert.ok(++calls <= 2);
        const body = JSON.parse(String(init?.body));
        if (variant === "baseline") for (const message of body.messages) if (message.role === "user") {
          message.content = message.content.replace(/\n- README 可能为评测器节选；[^\n]+/, "")
            .replace(/<untrusted_readme>[\s\S]*?<\/untrusted_readme>/,
              `<untrusted_readme>\n${protectJudgeInput(baseline(input.readme))}\n</untrusted_readme>`);
        }
        const response = await fetch(url, { ...init, body: JSON.stringify(body) });
        if (response.ok) {
          const data = await response.clone().json();
          // Record token counts only, never an unbounded provider envelope.
          usage.push(Object.fromEntries(["prompt_tokens", "completion_tokens", "total_tokens"].map((key) =>
            [key, Number.isSafeInteger(data.usage?.[key]) ? data.usage[key] : null])));
        }
        return response;
      } });
    const started = performance.now();
    const result = await judge(input, { signal: AbortSignal.timeout(125_000) });
    const output = JSON.stringify({ id: input.id, variant, model, ms: Math.round(performance.now() - started), calls, usage,
      score: result.score, scores: result.scores, comment: result.comment, concerns: result.concerns,
      avoidFor: result.avoidFor, evidence: result.evidence, diagramStatus: result.diagramStatus });
    console.log(redactKnownSecrets(output).replace(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g, "[IP redacted]")
      .replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g, "[email redacted]"));
  }
}
void main().catch(() => { console.error("READ_ONLY_MODEL_EXPERIMENT_FAILED; no retry or production write performed"); process.exitCode = 1; });
