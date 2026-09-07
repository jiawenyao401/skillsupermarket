import { SCORING_GOLDEN_CASES } from "./evaluation-golden-cases";

export const REMOTE_MCP_ADOPTION_SET_VERSION = "1.0.0";
const mature = SCORING_GOLDEN_CASES[0];
const endpoint = "https://mcp.example.invalid/mcp";
const config = (entry: unknown) => JSON.stringify({ mcpServers: { example: entry } }, null, 2);

// Original synthetic controls, not copied README content. The score checks
// adoption evidence supported by at least one client, not universal compatibility.
export const REMOTE_MCP_ADOPTION_CASES = [
  { id: "cursor-url", content: config({ url: endpoint }), actionable: true },
  { id: "cursor-headers", content: config({ url: endpoint, headers: { Authorization: "Bearer ${EXAMPLE_KEY}" } }), actionable: true },
  { id: "claude-http", content: config({ type: "http", url: endpoint }), actionable: true },
  { id: "claude-streamable-http", content: config({ type: "streamable-http", url: endpoint }), actionable: true },
  { id: "sse", content: config({ type: "sse", url: endpoint }), actionable: true },
  { id: "local-http", content: config({ url: "http://localhost:3000/mcp" }), actionable: true },
  { id: "invalid-json", content: '{"mcpServers":{"example":{"url":"https://mcp.example.invalid/mcp",}}}', actionable: false },
  { id: "unrelated-url", content: JSON.stringify({ name: "example", url: endpoint }), actionable: false },
  { id: "quoted-config", content: JSON.stringify(config({ url: endpoint })), actionable: false },
  { id: "array-root", content: JSON.stringify([{ mcpServers: { example: { url: endpoint } } }]), actionable: false },
  { id: "array-servers", content: JSON.stringify({ mcpServers: [{ url: endpoint }] }), actionable: false },
  { id: "array-entry", content: config([{ url: endpoint }]), actionable: false },
  { id: "null-entry", content: config(null), actionable: false },
  { id: "empty-servers", content: '{"mcpServers":{}}', actionable: false },
  { id: "missing-url", content: config({ type: "http" }), actionable: false },
  { id: "non-string-url", content: config({ type: "http", url: 123 }), actionable: false },
  { id: "relative-url", content: config({ url: "/mcp" }), actionable: false },
  { id: "invalid-host", content: config({ url: "https://bad host/mcp" }), actionable: false },
  { id: "javascript-url", content: config({ url: "javascript:alert(1)" }), actionable: false },
  { id: "file-url", content: config({ url: "file:///private/example" }), actionable: false },
  { id: "stdio-url", content: config({ type: "stdio", url: endpoint }), actionable: false },
  { id: "unknown-type", content: config({ type: "made-up", url: endpoint }), actionable: false },
  { id: "null-type", content: config({ type: null, url: endpoint }), actionable: false },
  { id: "array-type", content: config({ type: ["http"], url: endpoint }), actionable: false },
  { id: "array-headers", content: config({ url: endpoint, headers: [] }), actionable: false },
  { id: "invalid-headers", content: config({ url: endpoint, headers: { Authorization: 123 } }), actionable: false },
  { id: "hidden-comment", content: config({ url: endpoint }), wrapper: "comment", actionable: false },
  { id: "output-block", content: config({ url: endpoint }), wrapper: "output", actionable: false },
  { id: "plain-prose", content: config({ url: endpoint }), wrapper: "prose", actionable: false },
].map(({ id, content, wrapper, actionable }) => {
  const code = `\`\`\`${wrapper === "output" ? "output" : "json"}\n${content}\n\`\`\``;
  const block = wrapper === "comment" ? `<!--\n${code}\n-->` : wrapper === "prose" ? content.replace(/\n/g, " ") : code;
  return { id, readme: mature.readme.replace(/```[^\n]*\n[\s\S]*?```/, () => block),
    description: mature.description, filePaths: mature.filePaths, actionable };
});
