// 安全扫描器
// 扫描 prompt 注入 / 敏感数据 / 危险 API
import type { SecurityFinding } from "./types";

// Prompt 注入关键词 (常见攻击模式)
const PROMPT_INJECTION_PATTERNS: { pattern: RegExp; type: string }[] = [
  { pattern: /ignore\s+(all\s+)?previous\s+instructions/i, type: "instruction-override" },
  { pattern: /disregard\s+(all\s+)?prior/i, type: "instruction-override" },
  { pattern: /forget\s+everything/i, type: "instruction-override" },
  { pattern: /you\s+are\s+now\s+[a-z]+/i, type: "role-override" },
  { pattern: /pretend\s+to\s+be/i, type: "role-override" },
  { pattern: /system\s*:\s*you\s+are/i, type: "system-prompt-injection" },
  { pattern: /<\|im_start\|>/i, type: "chat-template-injection" },
  { pattern: /<\|im_end\|>/i, type: "chat-template-injection" },
  { pattern: /###\s*Instruction/i, type: "prompt-structure-injection" },
  { pattern: /reveal\s+(your\s+)?(system\s+)?prompt/i, type: "prompt-extraction" },
];

// 敏感数据 (API key / token / 私钥)
const SECRET_PATTERNS: { pattern: RegExp; type: string }[] = [
  { pattern: /sk-[a-zA-Z0-9]{20,}/, type: "openai-key" },
  { pattern: /sk-ant-[a-zA-Z0-9-]{20,}/, type: "anthropic-key" },
  { pattern: /sk-or-[a-zA-Z0-9-]{20,}/, type: "openrouter-key" },
  { pattern: /ghp_[a-zA-Z0-9]{20,}/, type: "github-pat" },
  { pattern: /gho_[a-zA-Z0-9]{20,}/, type: "github-oauth" },
  { pattern: /AKIA[0-9A-Z]{16}/, type: "aws-access-key" },
  { pattern: /AIza[0-9A-Za-z_-]{35}/, type: "google-api-key" },
  { pattern: /xox[baprs]-[0-9a-zA-Z-]{10,}/, type: "slack-token" },
  { pattern: /-----BEGIN\s+(RSA\s+)?PRIVATE\s+KEY-----/, type: "private-key" },
  { pattern: /password\s*[:=]\s*['"][^'"]{4,}['"]/i, type: "hardcoded-password" },
  // 中国手机号
  { pattern: /\b1[3-9]\d{9}\b/, type: "phone-number" },
  // 身份证号 (粗略)
  { pattern: /\b[1-9]\d{5}(?:18|19|20)\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])\d{3}[\dXx]\b/, type: "id-card" },
];

// 危险 API
const DANGEROUS_API_PATTERNS: { pattern: RegExp; type: string; lang: string }[] = [
  { pattern: /\beval\s*\(/, type: "eval", lang: "js/py" },
  { pattern: /\bexec\s*\(/, type: "exec", lang: "js/py" },
  { pattern: /\bos\.system\s*\(/, type: "os-system", lang: "py" },
  { pattern: /\bsubprocess\.[a-z]+\s*\(/, type: "subprocess", lang: "py" },
  { pattern: /\bchild_process/, type: "child-process", lang: "js" },
  { pattern: /new\s+Function\s*\(/, type: "new-function", lang: "js" },
  { pattern: /require\s*\(\s*['"]child_process['"]\s*\)/, type: "child-process", lang: "js" },
];

export interface ScanResult {
  score: number; // 0-100
  findings: SecurityFinding[];
  details: string;
}

export function scanText(text: string): ScanResult {
  const findings: SecurityFinding[] = [];
  const lines = text.split("\n");

  // 1. Prompt 注入扫描
  lines.forEach((line, i) => {
    for (const { pattern, type } of PROMPT_INJECTION_PATTERNS) {
      if (pattern.test(line)) {
        findings.push({
          level: "warning",
          type: `prompt-injection:${type}`,
          message: `检测到 prompt 注入模式: ${type}`,
          location: `line ${i + 1}`,
        });
      }
    }
  });

  // 2. 敏感数据扫描
  lines.forEach((line, i) => {
    for (const { pattern, type } of SECRET_PATTERNS) {
      if (pattern.test(line)) {
        findings.push({
          level: "danger",
          type: `secret:${type}`,
          message: `检测到敏感数据: ${type}`,
          location: `line ${i + 1}`,
        });
      }
    }
  });

  // 3. 危险 API 扫描
  for (const { pattern, type, lang } of DANGEROUS_API_PATTERNS) {
    const matches = text.matchAll(new RegExp(pattern, "g"));
    for (const match of matches) {
      const lineNum = text.substring(0, match.index).split("\n").length;
      findings.push({
        level: "warning",
        type: `dangerous-api:${type}`,
        message: `检测到危险 API: ${type} (${lang})`,
        location: `line ${lineNum}`,
      });
    }
  }

  // 计算 score
  // 基础 100, danger 扣 20, warning 扣 5, 上限扣到 0
  let score = 100;
  for (const f of findings) {
    if (f.level === "danger") score -= 20;
    else if (f.level === "warning") score -= 5;
  }
  score = Math.max(0, score);

  const details =
    findings.length === 0
      ? "未发现安全问题"
      : `发现 ${findings.filter((f) => f.level === "danger").length} 个高危, ${findings.filter((f) => f.level === "warning").length} 个警告`;

  return { score, findings, details };
}
