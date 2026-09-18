import { fromMarkdown } from "mdast-util-from-markdown";
import { parseDocument } from "yaml";

export interface AgentSkillDocument {
  path: string;
  content: string;
}

export interface AgentSkillInspection {
  path: string;
  content: string;
  valid: boolean;
  substantive: boolean;
  name?: string;
  description?: string;
  body: string;
  issues: string[];
  warnings: string[];
}

export interface AgentSkillAnalysis {
  detected: number;
  valid: number;
  invalid: number;
  substantive: number;
  selected?: AgentSkillInspection;
  inspections: AgentSkillInspection[];
}

const FRONTMATTER = /^\uFEFF?---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)([\s\S]*)$/;
const NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const PROCEDURE_VERB = /\b(?:read|run|use|call|invoke|open|create|write|check|verify|validate|return|report|ask|inspect|compare|analy[sz]e|generate|execute|load|fetch|select|review)\b|(?:读取|运行|使用|调用|打开|创建|写入|检查|验证|返回|报告|询问|分析|生成|执行|加载|选择|评审)/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function bodyIsSubstantive(body: string): boolean {
  const normalized = body.replace(/\s+/g, " ").trim();
  if (normalized.length < 120 || !PROCEDURE_VERB.test(normalized)) return false;
  try {
    const root = fromMarkdown(body);
    let listItems = 0;
    let codeBlocks = 0;
    const pending = [...root.children];
    while (pending.length) {
      const node = pending.pop()!;
      if (node.type === "listItem") listItems += 1;
      if (node.type === "code") codeBlocks += 1;
      if ("children" in node) pending.push(...node.children);
    }
    return listItems >= 2 || codeBlocks >= 1 || normalized.length >= 300;
  } catch {
    return false;
  }
}

function inspectSkill(document: AgentSkillDocument): AgentSkillInspection {
  const issues: string[] = [];
  const warnings: string[] = [];
  const basename = document.path.split("/").at(-1) ?? "";
  if (basename !== "SKILL.md") issues.push("文件名必须严格为 SKILL.md");

  const match = document.content.match(FRONTMATTER);
  if (!match) {
    return {
      path: document.path,
      content: document.content,
      valid: false,
      substantive: false,
      body: "",
      issues: [...issues, "缺少位于文件开头且完整闭合的 YAML frontmatter"],
      warnings,
    };
  }

  const [, source, body] = match;
  let frontmatter: Record<string, unknown> | undefined;
  try {
    const parsed = parseDocument(source, {
      schema: "core",
      merge: false,
      prettyErrors: false,
      uniqueKeys: true,
    });
    if (parsed.errors.length > 0 || parsed.warnings.length > 0) {
      issues.push("YAML frontmatter 无法安全、唯一地解析");
    } else {
      const value = parsed.toJS({ maxAliasCount: 0 });
      if (isRecord(value)) frontmatter = value;
      else issues.push("YAML frontmatter 顶层必须是对象");
    }
  } catch {
    issues.push("YAML frontmatter 无法安全、唯一地解析");
  }

  let name: string | undefined;
  let description: string | undefined;
  if (frontmatter) {
    if (typeof frontmatter.name !== "string" || !frontmatter.name.trim()) {
      issues.push("name 必须是非空字符串");
    } else {
      name = frontmatter.name;
      if (name.length > 64 || !NAME.test(name)) issues.push("name 必须为 1-64 位小写字母、数字或单连字符");
    }
    if (typeof frontmatter.description !== "string" || !frontmatter.description.trim()) {
      issues.push("description 必须是非空字符串");
    } else {
      description = frontmatter.description;
      if (description.length > 1024) issues.push("description 不得超过 1024 个字符");
      if (!/\b(?:when|use\s+(?:this|for)|on\s+requests?)\b|(?:适用|用于|当.+时|场景)/i.test(description)) {
        warnings.push("description 未清楚说明何时使用该 Skill");
      }
    }
    if (frontmatter.license !== undefined && typeof frontmatter.license !== "string") {
      issues.push("license 如提供必须是字符串");
    }
    if (frontmatter.compatibility !== undefined && (
      typeof frontmatter.compatibility !== "string" ||
      !frontmatter.compatibility.length ||
      frontmatter.compatibility.length > 500
    )) {
      issues.push("compatibility 如提供必须是 1-500 个字符的字符串");
    }
    if (frontmatter["allowed-tools"] !== undefined && typeof frontmatter["allowed-tools"] !== "string") {
      issues.push("allowed-tools 如提供必须是字符串");
    }
    if (frontmatter.metadata !== undefined && (
      !isRecord(frontmatter.metadata) ||
      Object.values(frontmatter.metadata).some((value) => typeof value !== "string")
    )) {
      issues.push("metadata 如提供必须是字符串到字符串的映射");
    }
  }

  const parts = document.path.split("/");
  const parent = parts.length > 1 ? parts.at(-2) : undefined;
  if (name && parent && parent !== name) issues.push("SKILL.md 父目录名必须与 name 一致");
  if (!body.trim()) issues.push("SKILL.md 必须包含 Markdown 指令正文");

  const substantive = bodyIsSubstantive(body);
  if (body.trim() && !substantive) warnings.push("指令正文过薄，缺少可核实的执行步骤或示例");
  return { path: document.path, content: document.content, valid: issues.length === 0, substantive, name, description, body, issues, warnings };
}

/** Inspect caller-provided Skill evidence only. This never reads paths, executes code, or fetches resources. */
export function analyzeAgentSkills(documents: readonly AgentSkillDocument[]): AgentSkillAnalysis {
  const inspections = documents
    .filter((document) => document.path.split("/").at(-1)?.toLowerCase() === "skill.md")
    .map(inspectSkill)
    .sort((left, right) => {
      const validity = Number(right.valid) - Number(left.valid);
      const substance = Number(right.substantive) - Number(left.substantive);
      const depth = left.path.split("/").length - right.path.split("/").length;
      return validity || substance || depth || left.path.localeCompare(right.path);
    });
  return {
    detected: inspections.length,
    valid: inspections.filter((inspection) => inspection.valid).length,
    invalid: inspections.filter((inspection) => !inspection.valid).length,
    substantive: inspections.filter((inspection) => inspection.valid && inspection.substantive).length,
    selected: inspections[0],
    inspections,
  };
}

export function agentSkillEvidence(analysis: AgentSkillAnalysis): string[] {
  if (!analysis.detected) return [];
  const evidence = [
    `${analysis.invalid ? "未通过" : "通过"}: Agent Skills 格式校验 ${analysis.valid}/${analysis.detected} 个通过`,
  ];
  if (analysis.substantive > 0) evidence.push(`通过: ${analysis.substantive} 个有效 Skill 含可核实的指令步骤或示例`);
  if (analysis.selected && analysis.detected > 1) {
    evidence.push(`质量评审选取 ${analysis.selected.path}；其余 ${analysis.detected - 1} 个仅做格式扫描`);
  }
  return evidence;
}
