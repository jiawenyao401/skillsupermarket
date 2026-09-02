import "dotenv/config";
import {
  DIAGRAM_RECOVERY_BENCHMARK_CASES,
  DIAGRAM_RECOVERY_BENCHMARK_VERSION,
} from "../data/evaluation-diagram-recovery-cases";
import { getEvaluationFiles } from "../lib/github";
import { hasExplicitDiagramEvidence, judgeSkill } from "../lib/judge";

async function getPinnedReadme(repository: string, ref: string): Promise<string | null> {
  const encodedRepository = repository.split("/").map(encodeURIComponent).join("/");
  for (const filename of ["README.md", "readme.md", "Readme.md"]) {
    const response = await fetch(`https://raw.githubusercontent.com/${encodedRepository}/${encodeURIComponent(ref)}/${filename}`, {
      signal: AbortSignal.timeout(12_000),
    });
    if (response.ok) return response.text();
    if (response.status !== 404) throw new Error(`pinned README request failed (${response.status})`);
  }
  return null;
}

async function evaluateCase(fixture: (typeof DIAGRAM_RECOVERY_BENCHMARK_CASES)[number]) {
  const [readme, files] = await Promise.all([
    getPinnedReadme(fixture.repository, fixture.ref),
    getEvaluationFiles(fixture.repository, fixture.ref),
  ]);
  if (!readme) throw new Error(`${fixture.id}: pinned README unavailable`);
  const paths = files.map((file) => file.path.toLowerCase());
  const result = await judgeSkill({
    name: fixture.name,
    type: fixture.type,
    description: fixture.description,
    readme,
    deterministicEvidence: [
      `${readme.length >= 500 ? "通过" : "缺失"}: 有效 README (${readme.length} 字符)`,
      `${/install|setup|getting started|quick start|安装|配置/i.test(readme) ? "通过" : "缺失"}: 安装步骤`,
      `${/```[\s\S]{20,}?```/.test(readme) ? "通过" : "缺失"}: 可执行示例`,
      `${/limit|caveat|permission|security|限制|权限|安全/i.test(readme) ? "通过" : "缺失"}: 限制或安全边界`,
      `${paths.some((path) => path.endsWith("skill.md")) ? "通过" : "缺失"}: SKILL.md`,
      `${paths.some((path) => /package\.json|pyproject\.toml|requirements\.txt|mcp\.json/.test(path)) ? "通过" : "缺失"}: 项目清单`,
    ],
  });
  const recoveryEligible = hasExplicitDiagramEvidence(readme);
  const passed = fixture.expectedStatuses.includes(result.diagramStatus as "generated" | "insufficient-evidence" | "invalid-output")
    && (fixture.expectedRecoveryEligible === undefined || recoveryEligible === fixture.expectedRecoveryEligible);
  return {
    id: fixture.id,
    repository: fixture.repository,
    expectedStatuses: fixture.expectedStatuses,
    status: result.diagramStatus,
    type: result.diagram?.type ?? null,
    recoveryAttempted: result.diagramRecoveryAttempted,
    recoveryStatus: result.diagramRecoveryStatus,
    recoveryEligible,
    passed,
  };
}

async function main() {
  const results = [];
  for (const fixture of DIAGRAM_RECOVERY_BENCHMARK_CASES) {
    const result = await evaluateCase(fixture);
    results.push(result);
    console.log(JSON.stringify(result));
  }
  const passed = results.filter((result) => result.passed).length;
  console.log(JSON.stringify({
    benchmarkVersion: DIAGRAM_RECOVERY_BENCHMARK_VERSION,
    passed,
    total: results.length,
    regressions: results.length - passed,
  }));
  if (passed !== results.length) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
