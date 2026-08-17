import "dotenv/config";
import { getEvaluationFiles, getReadme, getRepo } from "../lib/github";
import { judgeSkill } from "../lib/judge";

const repositories = process.argv.slice(2);
if (repositories.length === 0) {
  console.error("usage: benchmark-judge <owner/repo> [...]");
  process.exit(1);
}

async function evaluateRepository(fullName: string) {
  const [repo, readme] = await Promise.all([getRepo(fullName, true), getReadme(fullName)]);
  if (!repo || !readme) throw new Error(`${fullName}: repository or README unavailable`);
  const files = await getEvaluationFiles(fullName, repo.default_branch);
  const paths = files.map((file) => file.path.toLowerCase());
  const evidence = [
    `${readme.length >= 500 ? "通过" : "缺失"}: 有效 README (${readme.length} 字符)`,
    `${/install|setup|getting started|quick start|安装|配置/i.test(readme) ? "通过" : "缺失"}: 安装步骤`,
    `${/```[\s\S]{20,}?```/.test(readme) ? "通过" : "缺失"}: 可执行示例`,
    `${/limit|caveat|permission|security|限制|权限|安全/i.test(readme) ? "通过" : "缺失"}: 限制或安全边界`,
    `${paths.some((path) => path.endsWith("skill.md")) ? "通过" : "缺失"}: SKILL.md`,
    `${paths.some((path) => /package\.json|pyproject\.toml|requirements\.txt|mcp\.json/.test(path)) ? "通过" : "缺失"}: 项目清单`,
  ];
  const result = await judgeSkill({
    name: repo.name,
    type: repo.topics.includes("mcp") ? "mcp-server" : repo.topics.includes("claude-skill") ? "claude-skill" : "agent-pack",
    description: repo.description ?? "",
    readme,
    deterministicEvidence: evidence,
  });
  const repeat = process.env.BENCHMARK_REPEAT === "1"
    ? await judgeSkill({
        name: repo.name,
        type: repo.topics.includes("mcp") ? "mcp-server" : repo.topics.includes("claude-skill") ? "claude-skill" : "agent-pack",
        description: repo.description ?? "",
        readme,
        deterministicEvidence: evidence,
      })
    : null;
  return {
    repository: fullName,
    model: result.model,
    score: result.score,
    scores: result.scores,
    comment: result.comment,
    strengths: result.strengths,
    concerns: result.concerns,
    bestFor: result.bestFor,
    avoidFor: result.avoidFor,
    evidence: result.evidence,
    readmeCharacters: readme.length,
    evidenceFiles: files.length,
    repeatScore: repeat?.score ?? null,
    scoreDrift: repeat ? Math.abs(result.score - repeat.score) : null,
  };
}

async function main() {
  for (const repository of repositories) {
    try {
      console.log(JSON.stringify(await evaluateRepository(repository)));
    } catch (error) {
      console.error(JSON.stringify({ repository, error: error instanceof Error ? error.message : String(error) }));
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
