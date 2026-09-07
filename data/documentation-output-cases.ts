import { SCORING_GOLDEN_CASES } from "./evaluation-golden-cases";

export const DOCUMENTATION_OUTPUT_SET_VERSION = "1.0.0";
const mature = SCORING_GOLDEN_CASES[0];
const command = "npm install @example/production-mcp\nnpx production-mcp --read-only";
const local = '{"mcpServers":{"example":{"command":"npx","args":["@example/production-mcp"]}}}';
const remote = '{"mcpServers":{"example":{"url":"https://mcp.example.invalid/mcp"}}}';
const fence = (language: string, content: string) => `\`\`\`${language}\n${content}\n\`\`\``;

// Original synthetic contrasts: explicitly labelled output is not an instruction.
// console/shell sessions, text, unlabelled code and actual configurations retain
// their existing meaning. Do not infer a negative label from an unknown language.
const variants = [
  ...["output", "stdout", "stderr", "log", "logs", "OUTPUT"].map((lang) =>
    ({ id: `command-${lang}`, block: fence(lang, command), actionable: false })),
  { id: "output-json-local", block: fence("output", local), actionable: false },
  { id: "stdout-json-remote", block: fence("stdout", remote), actionable: false },
  { id: "stderr-yaml", block: fence("stderr", "command: npx\nargs: [example-tool]"), actionable: false },
  { id: "log-api-call", block: fence("log", "curl https://api.example.invalid/items\nGET /items"), actionable: false },
  { id: "log-json-response", block: fence("log", '{"status":"ok","result":"example"}'), actionable: false },
  { id: "output-metadata", block: fence('output title="Example log"', command), actionable: false },
  { id: "nested-output", block: fence("output", command).split("\n").map((line) => `> ${line}`).join("\n"), actionable: false },
  { id: "tilde-output", block: `~~~output\n${command}\n~~~`, actionable: false },
  ...["bash", "sh", "shell", "console", "shell-session", "text", "", "custom-shell"].map((lang) =>
    ({ id: `real-command-${lang || "unlabelled"}`, block: fence(lang, command), actionable: true })),
  { id: "real-local-config", block: fence("json", local), actionable: true },
  { id: "real-remote-config", block: fence("json", remote), actionable: true },
  { id: "mixed-real-command-output", block: `${fence("bash", command)}\n\n${fence("output", "Installation completed successfully.")}`, actionable: true },
  { id: "empty-output", block: fence("output", ""), actionable: false },
  { id: "long-output", block: fence("output", `${command}\n${"[log] example status\n".repeat(800)}`), actionable: false },
];

export const DOCUMENTATION_OUTPUT_CASES = variants.map(({ id, block, actionable }) => ({
  id, readme: mature.readme.replace(/```[^\n]*\n[\s\S]*?```/, () => block),
  description: mature.description, filePaths: mature.filePaths,
  expectedScore: actionable ? 100 : 30, actionable,
}));
