import "dotenv/config";
import { judgeSkill } from "../lib/judge";

async function main() {
  const result = await judgeSkill({
  name: "Repository issue assistant",
  type: "mcp-server",
  description: "A diagnostic MCP server that lets an AI client inspect repository issues.",
  readme: `# Repository issue assistant

This MCP server lets an AI client inspect repository issues without granting write access.

## Install

Run npm install and configure the MCP client to start the issue server.

## Request flow

1. A user asks the AI client to review open issues.
2. The AI client calls the server's list_issues tool.
3. The server reads issue metadata from the repository provider.
4. The server returns issue titles and labels to the AI client.

## Tool

list_issues accepts owner, repository, and state parameters. It returns issue titles, labels, and update times.

## Usage example

\`\`\`bash
npx repository-issue-assistant
\`\`\`

## Security and limitations

Use a read-only provider token. The server does not create, edit, or close issues.

## Errors

Authentication failures return an explicit authorization error. Rate limits return a retry-after value.

## License

MIT`,
  deterministicEvidence: [
    "通过: 有 README",
    "通过: 安装步骤",
    "通过: 示例",
    "通过: 输入、参数或工具说明",
    "通过: 限制、权限或边界",
    "通过: 错误处理或排障",
  ],
  });

  if (!result.diagram || result.diagramStatus !== "generated") {
    throw new Error(`LLM Judge 未返回可验证的 Skill 图示（${result.diagramStatus}）`);
  }

  console.log(JSON.stringify({
    ok: true,
    model: result.model,
    score: result.score,
    scores: result.scores,
    comment: result.comment,
    strengths: result.strengths,
    concerns: result.concerns,
    evidence: result.evidence,
    diagram: result.diagram,
    diagramStatus: result.diagramStatus,
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
