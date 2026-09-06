import { SCORING_GOLDEN_CASES } from "./evaluation-golden-cases";

export const DOCUMENTATION_FORMAT_SET_VERSION = "1.0.0";
const mature = SCORING_GOLDEN_CASES[0];
const command = "npm install @example/production-mcp\nnpx production-mcp --read-only";
const fence = "`".repeat(3);
const replaceExample = (block: string) => mature.readme.replace(/```[^\n]*\n[\s\S]*?```/, () => block);

// Same original content and adoption command; only Markdown presentation differs.
// Negative controls contain no rendered adoption command or usable example.
export const DOCUMENTATION_FORMAT_CASES = [
  { id: "backticks", block: `${fence}bash\n${command}\n${fence}`, actionable: true },
  { id: "tildes", block: `~~~bash\n${command}\n~~~`, actionable: true },
  { id: "long-backticks", block: `${fence}\`bash\n${command}\n${fence}\``, actionable: true },
  { id: "long-tildes", block: `~~~~~bash\n${command}\n~~~~~`, actionable: true },
  { id: "indented-code", block: command.split("\n").map((line) => `    ${line}`).join("\n"), actionable: true },
  { id: "blockquote", block: `${fence}bash\n${command}\n${fence}`.split("\n").map((line) => `> ${line}`).join("\n"), actionable: true },
  { id: "list-nested", block: `- Install:\n\n${`${fence}bash\n${command}\n${fence}`.split("\n").map((line) => `  ${line}`).join("\n")}`, actionable: true },
  { id: "info-metadata", block: `~~~bash title="Install"\n${command}\n~~~`, actionable: true },
  { id: "hidden-html-comment", block: `<!--\n${fence}bash\n${command}\n${fence}\n-->`, actionable: false },
  { id: "hidden-html-style", block: `<style>\n${fence}bash\n${command}\n${fence}\n</style>`, actionable: false },
  { id: "placeholder", block: `~~~text\nInstallation example placeholder with no actual command.\n~~~`, actionable: false },
  { id: "empty", block: "", actionable: false },
].map(({ id, block, actionable }) => ({
  id, readme: replaceExample(block), description: mature.description,
  filePaths: mature.filePaths, expectedScore: actionable ? 100 : 30, actionable,
}));
