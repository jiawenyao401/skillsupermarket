import type { RiskLevel, SecurityFinding } from "./types";
import { deriveRiskLevel } from "./evaluation-scoring";
import { redactKnownSecrets } from "./redaction";

interface ScanDocument {
  path: string;
  content: string;
  kind?: "documentation" | "instruction" | "code" | "manifest";
}

interface PatternRule {
  pattern: RegExp;
  type: string;
  level: SecurityFinding["level"];
  category: NonNullable<SecurityFinding["category"]>;
  message: string;
  remediation: string;
  confidence: NonNullable<SecurityFinding["confidence"]>;
  contexts?: Array<NonNullable<ScanDocument["kind"]>>;
}

const RULES: PatternRule[] = [
  {
    pattern: /ignore\s+(?:all\s+)?previous\s+instructions|disregard\s+(?:all\s+)?prior|forget\s+everything/i,
    type: "instruction-override",
    level: "danger",
    category: "prompt-injection",
    message: "发现试图覆盖上游指令的提示词模式",
    remediation: "删除指令覆盖语句，并明确限定 Skill 只处理用户授权的数据和动作。",
    confidence: "high",
    contexts: ["instruction", "documentation"],
  },
  {
    pattern: /reveal\s+(?:your\s+)?(?:system\s+)?prompt|print\s+(?:the\s+)?system\s+message|exfiltrat(?:e|ion)/i,
    type: "prompt-extraction",
    level: "danger",
    category: "prompt-injection",
    message: "发现提示词或系统信息提取意图",
    remediation: "移除提示词提取逻辑，并增加敏感上下文不可输出的边界说明。",
    confidence: "high",
    contexts: ["instruction", "documentation"],
  },
  {
    pattern: /<\|im_(?:start|end)\|>|\[INST\]|<<SYS>>/i,
    type: "chat-template-token",
    level: "warning",
    category: "prompt-injection",
    message: "发现可能影响消息边界的模型模板标记",
    remediation: "不要在可执行指令中嵌入模型消息边界标记；示例内容应显式转义。",
    confidence: "medium",
    contexts: ["instruction", "documentation"],
  },
  {
    pattern: /sk-(?:proj-)?[a-zA-Z0-9_-]{20,}|sk-ant-[a-zA-Z0-9_-]{20,}|sk-or-[a-zA-Z0-9_-]{20,}/,
    type: "llm-api-key",
    level: "danger",
    category: "secret",
    message: "发现疑似 LLM API Key",
    remediation: "立即轮换密钥，并改用环境变量或 Secret Manager 注入。",
    confidence: "high",
  },
  {
    pattern: /gh[opusr]_[a-zA-Z0-9]{20,}|github_pat_[a-zA-Z0-9_]{20,}/,
    type: "github-token",
    level: "danger",
    category: "secret",
    message: "发现疑似 GitHub Token",
    remediation: "立即吊销并轮换 Token；仓库中只保留环境变量名。",
    confidence: "high",
  },
  {
    pattern: /AKIA[0-9A-Z]{16}|AIza[0-9A-Za-z_-]{35}|xox[baprs]-[0-9a-zA-Z-]{10,}/,
    type: "cloud-or-saas-token",
    level: "danger",
    category: "secret",
    message: "发现疑似云服务或 SaaS 凭证",
    remediation: "立即轮换凭证，并将其移出源码和文档。",
    confidence: "high",
  },
  {
    pattern: /-----BEGIN\s+(?:RSA\s+|EC\s+|OPENSSH\s+)?PRIVATE\s+KEY-----/,
    type: "private-key",
    level: "danger",
    category: "secret",
    message: "发现私钥内容",
    remediation: "立即吊销对应证书或密钥，清理 Git 历史，并使用密钥托管服务。",
    confidence: "high",
  },
  {
    pattern: /(?:password|passwd|secret)\s*[:=]\s*["'][^"'\n]{6,}["']/i,
    type: "hardcoded-credential",
    level: "danger",
    category: "secret",
    message: "发现疑似硬编码凭证",
    remediation: "使用运行时环境变量注入，并对已暴露凭证执行轮换。",
    confidence: "medium",
    contexts: ["code", "manifest"],
  },
  {
    pattern: /\beval\s*\(|new\s+Function\s*\(/,
    type: "dynamic-code-execution",
    level: "warning",
    category: "dangerous-api",
    message: "发现动态代码执行 API",
    remediation: "避免执行不可信字符串；使用明确的解析器、白名单或结构化指令。",
    confidence: "high",
    contexts: ["code", "instruction"],
  },
  {
    pattern: /\b(?:child_process|os\.system|subprocess\.(?:run|Popen|call)|execSync|spawnSync)\b/,
    type: "process-execution",
    level: "warning",
    category: "dangerous-api",
    message: "发现系统进程或命令执行能力",
    remediation: "限制可执行命令与参数，禁止拼接用户输入，并采用最小权限沙箱。",
    confidence: "high",
    contexts: ["code", "instruction"],
  },
  {
    pattern: /(?:curl|wget)[^\n|;]*(?:\||;)\s*(?:sh|bash)|npm\s+install\s+[^\n]*(?:--ignore-scripts=false|--unsafe-perm)/i,
    type: "unsafe-install-command",
    level: "danger",
    category: "supply-chain",
    message: "发现高风险的一键下载执行或安装命令",
    remediation: "固定版本与校验和，先下载审查再执行，避免管道直接交给 Shell。",
    confidence: "high",
  },
];

const MAX_FINDINGS = 60;

export interface ScanResult {
  score: number;
  riskLevel: RiskLevel;
  findings: SecurityFinding[];
  details: string;
  scannedFiles: number;
  scannedCharacters: number;
}

function redactEvidence(value: string): string {
  return redactKnownSecrets(value)
    .replace(/(["'][^"'\n]{2})[^"'\n]{4,}([^"'\n]{2}["'])/g, "$1***$2")
    .trim()
    .slice(0, 180);
}

function isDefensivePromptExample(line: string, injectionIndex: number): boolean {
  const prefix = line.slice(0, Math.max(0, injectionIndex));
  if (/(?:do not|don't|never)\s+(?:detect|block|prevent|avoid|reject)/i.test(prefix)) return false;
  return /(?:detect|block|prevent|avoid|reject|example|防止|检测|拦截|拒绝|示例)/i.test(prefix) ||
    /(?:never|do not|don't|不要|禁止)\s*$/i.test(prefix);
}

function isPlaceholderCredential(line: string): boolean {
  return /(?:replace[-_ ]?me|change[-_ ]?me|your[-_ ]?(?:password|secret)|example|placeholder|dummy|test[-_ ]?(?:only|password)|xxx+|<[^>]+>|\$\{[^}]+\})/i.test(line);
}

export function scanDocuments(documents: ScanDocument[]): ScanResult {
  const findings: SecurityFinding[] = [];
  const dedupe = new Set<string>();
  let scannedCharacters = 0;

  for (const document of documents) {
    const content = document.content.slice(0, 250_000);
    scannedCharacters += content.length;
    const lines = content.split("\n");

    for (const rule of RULES) {
      if (rule.contexts && document.kind && !rule.contexts.includes(document.kind)) continue;
      lines.forEach((line, index) => {
        const pattern = new RegExp(rule.pattern.source, rule.pattern.flags.replace("g", ""));
        const match = line.match(pattern);
        if (!match) return;
        if ((rule.category === "prompt-injection") && isDefensivePromptExample(line, match.index ?? 0)) return;
        if (rule.type === "hardcoded-credential" && isPlaceholderCredential(line)) return;
        const key = `${document.path}:${index + 1}:${rule.type}`;
        if (dedupe.has(key) || findings.length >= MAX_FINDINGS) return;
        dedupe.add(key);
        findings.push({
          level: rule.level,
          type: rule.type,
          category: rule.category,
          message: rule.message,
          location: `${document.path}:${index + 1}`,
          evidence: redactEvidence(line),
          remediation: rule.remediation,
          confidence: rule.confidence,
        });
      });
    }
  }

  const dangerCount = findings.filter((finding) => finding.level === "danger").length;
  const warningCount = findings.filter((finding) => finding.level === "warning").length;
  const mediumConfidencePenalty = findings.filter((finding) => finding.confidence === "medium").length * 2;
  const score = Math.max(0, 100 - dangerCount * 22 - warningCount * 7 - mediumConfidencePenalty);
  const riskLevel = deriveRiskLevel(findings);
  const details = findings.length === 0
    ? "未发现已知高风险模式"
    : `${dangerCount} 个高风险 · ${warningCount} 个需复核项`;

  return {
    score,
    riskLevel,
    findings,
    details,
    scannedFiles: documents.length,
    scannedCharacters,
  };
}

export function scanText(text: string): ScanResult {
  return scanDocuments([{ path: "README", content: text, kind: "documentation" }]);
}
