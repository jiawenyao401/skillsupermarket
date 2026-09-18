import { createHash } from "node:crypto";
import { performance } from "node:perf_hooks";
import { selectReadmeEvidence } from "../packages/evaluation-sdk/src/judge";
import { README_EVIDENCE_CASES as cases, README_EVIDENCE_SET_VERSION } from "../data/readme-evidence-cases";

// Frozen 93f5d15 selector: do not update to make the baseline pass.
export function baseline(readme: string): string {
  if (readme.length <= 30_000) return readme;
  const sections = readme.split(/(?=^#{1,4}\s+)/gm).map((s) => s.trim()).filter(Boolean);
  const selected: string[] = [], seen = new Set<string>();
  let remaining = 30_000;
  const add = (s: string) => {
    if (remaining <= 0 || seen.has(s)) return;
    seen.add(s); const slice = s.slice(0, remaining); selected.push(slice); remaining -= slice.length + 2;
  };
  add(sections[0] ?? readme.slice(0, 5_000));
  for (const priority of [
    /quick\s*start|getting\s*started|install|setup|安装|配置/i,
    /usage|example|demo|用法|示例/i,
    /tool|parameter|argument|input|output|api|参数|输入|输出/i,
    /security|permission|privacy|limit|caveat|安全|权限|限制|隐私/i,
    /error|troubleshoot|faq|错误|排障|常见问题/i,
    /license|contribut|许可|贡献/i,
  ]) for (const section of sections) if (priority.test(section)) add(section);
  for (const section of sections) add(section);
  return selected.join("\n\n").slice(0, 30_000);
}

function measure(selector: (readme: string) => string) {
  const durations: number[] = [];
  const outcomes = cases.map((fixture) => {
    const outputs = Array.from({ length: 20 }, () => {
      const start = performance.now(), result = selector(fixture.readme);
      durations.push(performance.now() - start); return result;
    });
    const missing = fixture.required.filter((fact) => !outputs[0].includes(fact));
    return { id: fixture.id, missing, characters: outputs[0].length,
      passed: missing.length === 0 && outputs[0].length <= 30_000 && (!fixture.unchanged || outputs[0] === fixture.readme),
      drift: outputs.some((output) => output !== outputs[0]) };
  });
  durations.sort((a, b) => a - b);
  return { passed: outcomes.filter((o) => o.passed).length, total: outcomes.length,
    drift: outcomes.filter((o) => o.drift).length, medianMs: +durations[Math.floor(durations.length / 2)].toFixed(3),
    p95Ms: +durations[Math.floor(durations.length * .95)].toFixed(3), extraModelCalls: 0, outcomes };
}
if (process.argv[1]?.endsWith("benchmark-readme-evidence.ts")) {
  const before = measure(baseline), after = measure(selectReadmeEvidence);
  console.log(JSON.stringify({ benchmark: README_EVIDENCE_SET_VERSION, baselineCommit: "93f5d15",
    fixtureSha256: createHash("sha256").update(JSON.stringify(cases)).digest("hex"), baseline: before, candidate: after,
    regressions: after.outcomes.filter((o, i) => !o.passed && before.outcomes[i].passed).map((o) => o.id) }, null, 2));
  if (process.argv.includes("--check") && (after.passed !== after.total || after.drift)) process.exitCode = 1;
}
