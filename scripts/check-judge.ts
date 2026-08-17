import "dotenv/config";
import { judgeSkill } from "../lib/judge";

async function main() {
  const result = await judgeSkill({
  name: "Judge connectivity probe",
  type: "claude-skill",
  description: "A diagnostic sample used only to verify the configured AI judge and its structured output.",
  readme: `# Install

Run npm install.

## Usage

\`\`\`bash
npx probe
\`\`\`

## Limitations

No network access.

## License

MIT`,
  deterministicEvidence: [
    "通过: 有 README",
    "通过: 安装步骤",
    "通过: 示例",
    "通过: 限制说明",
  ],
  });

  console.log(JSON.stringify({
    ok: true,
    model: result.model,
    score: result.score,
    scores: result.scores,
    comment: result.comment,
    strengths: result.strengths,
    concerns: result.concerns,
    evidence: result.evidence,
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
