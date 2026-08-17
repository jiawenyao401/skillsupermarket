import "dotenv/config";
import { createHash } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { getEvaluationFiles, getReadme, getRepo } from "../lib/github";
import { judgeSkill } from "../lib/judge";

const DEFAULT_CASES = [
  "microsoft/playwright-mcp",
  "modelcontextprotocol/servers",
  "anthropics/skills",
  "openai/skills",
];

async function prepare(repository: string) {
  const [repo, readme] = await Promise.all([getRepo(repository, true), getReadme(repository)]);
  if (!repo || !readme) throw new Error(`${repository}: repository or README unavailable`);
  const files = await getEvaluationFiles(repository, repo.default_branch);
  const paths = files.map((file) => file.path.toLowerCase());
  const evidence = [
    `${readme.length >= 500 ? "通过" : "缺失"}: 有效 README (${readme.length} 字符)`,
    `${/install|setup|getting started|quick start|安装|配置/i.test(readme) ? "通过" : "缺失"}: 安装步骤`,
    `${/```[\s\S]{20,}?```/.test(readme) ? "通过" : "缺失"}: 可执行示例`,
    `${/parameters?|arguments?|inputs?|outputs?|tools?|参数|输入|输出|工具/i.test(readme) ? "通过" : "缺失"}: 参数或工具说明`,
    `${/limit|caveat|permission|security|privacy|限制|权限|安全|隐私/i.test(readme) ? "通过" : "缺失"}: 限制或安全边界`,
    `${/error|troubleshoot|faq|错误|排障|常见问题/i.test(readme) ? "通过" : "缺失"}: 错误处理或排障`,
    `${paths.some((path) => /package\.json|pyproject\.toml|requirements\.txt|mcp\.json/.test(path)) ? "通过" : "缺失"}: 项目清单`,
  ];
  const judgment = await judgeSkill({
    name: repo.name,
    type: repo.topics.includes("mcp") ? "mcp-server" : repo.topics.some((topic) => /skill/.test(topic)) ? "claude-skill" : "agent-pack",
    description: repo.description ?? "",
    readme,
    deterministicEvidence: evidence,
  });
  return {
    repository,
    readmeSha256: createHash("sha256").update(readme).digest("hex"),
    judgment,
  };
}

async function main() {
  const repositories = process.argv.slice(2).length ? process.argv.slice(2) : DEFAULT_CASES;
  const cases = [];
  for (const repository of repositories) {
    const result = await prepare(repository);
    cases.push(result);
    console.log(JSON.stringify({ repository, score: result.judgment.score, model: result.judgment.model }));
  }
  const outputPath = resolve(process.env.CASE_JUDGMENTS_PATH ?? "data/case-study-judgments.json");
  await writeFile(outputPath, JSON.stringify({
    formatVersion: 1,
    preparedAt: new Date().toISOString(),
    cases,
  }, null, 2), { encoding: "utf8", mode: 0o600 });
  console.log(JSON.stringify({ outputPath, count: cases.length }));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
