export const CREDENTIAL_VALUE_SET_VERSION = "1.0.0";

// Synthetic values only. The first case preserves the non-secret expression at
// github/github-mcp-server@2de6e4742bc44b1fdfd7337dc36541cc89d8a73f Dockerfile:33.
// These labels concern literal credentials, not the safety of the build/runtime.
const literal = "NotARealCredential42";
const read = "$(cat /run/secrets/oauth_client_secret 2>/dev/null || echo '')";
const cases: Array<[string, string, number]> = [
  ["github-build-secret-read", `export OAUTH_CLIENT_SECRET="${read}" && \\`, 0],
  ["simple-build-secret-read", 'SECRET="$(cat /run/secrets/client_secret)"', 0],
  ["build-secret-read-stderr", 'PASSWORD="$(cat /run/secrets/client_secret 2>/dev/null)"', 0],
  ["build-secret-read-empty-fallback", `PASSWORD="$(cat /run/secrets/client_secret || echo '')"`, 0],
  ["literal-password", `PASSWORD="${literal}"`, 1],
  ["literal-secret", `CLIENT_SECRET='${literal}'`, 1],
  ["single-quoted-command-is-literal", "SECRET='$(cat /run/secrets/client_secret)'", 1],
  ["literal-prefix", `SECRET="prefix${read}"`, 1],
  ["literal-suffix", `SECRET="${read}suffix"`, 1],
  ["literal-nonempty-fallback", `SECRET="$(cat /run/secrets/client_secret || echo '${literal}')"`, 1],
  ["literal-echo-command", `SECRET="$(echo '${literal}')"`, 1],
  ["literal-printf-command", `SECRET="$(printf '${literal}')"`, 1],
  ["arbitrary-command", 'SECRET="$(fetch-value --from-network)"', 1],
  ["traversal-not-exempted", 'SECRET="$(cat /run/secrets/../../file)"', 1],
  ["second-command-not-exempted", `SECRET="$(cat /run/secrets/client; echo '${literal}')"`, 1],
  ["placeholder-comment-cannot-hide", `PASSWORD="${literal}" # example placeholder dummy`, 1],
  ["unrelated-environment-cannot-hide", `PASSWORD="${literal}" OTHER="\${TOKEN}"`, 1],
  ["unrelated-tags-cannot-hide", `PASSWORD="${literal}" # <placeholder>`, 1],
  ["placeholder-before-literal", `SECRET="replace-me" PASSWORD="${literal}"`, 1],
  ["secret-read-before-literal", `SECRET="${read}" PASSWORD="${literal}"`, 1],
  ["literal-before-secret-read", `PASSWORD="${literal}" SECRET="${read}"`, 1],
  ["separate-lines", `SECRET="${read}"\nPASSWORD="${literal}"`, 1],
  ["two-literals-same-line", `SECRET="${literal}" PASSWORD="AnotherSyntheticValue"`, 1],
  ["opposite-quote-in-literal", `PASSWORD="NotA'RealCredential42"`, 1],
  ["placeholder", 'PASSWORD="replace-me"', 0],
  ["change-me", 'PASSWORD="change_me"', 0],
  ["environment-placeholder", 'PASSWORD="${DB_PASSWORD}"', 0],
  ["angle-placeholder", 'PASSWORD="<your-password>"', 0],
  ["placeholder-name-in-literal", `PASSWORD="dummy-${literal}"`, 1],
  ["interpolation-with-literal", `PASSWORD="${literal}\${SUFFIX}"`, 1],
  ["short-value-no-cross-quote", 'PASSWORD="a" OTHER="ordinary text"', 0],
  ["unterminated-quote", 'PASSWORD="unterminated', 0],
  ["short-value", 'PASSWORD="short"', 0],
  ["empty-value", 'PASSWORD=""', 0],
  ["no-secret", 'RUN go build ./cmd/server', 0],
  ["long-nonmatching-line", `RUN ${"x".repeat(20_000)}`, 0],
];

export const CREDENTIAL_VALUE_CASES = cases.map(([id, content, expectedFindings]) => ({
  id, content, expectedFindings, path: id === "github-build-secret-read" ? "Dockerfile" : "build.sh", kind: "code" as const,
}));
