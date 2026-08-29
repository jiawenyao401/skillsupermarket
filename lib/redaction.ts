const PRIVATE_KEY_BLOCK = /-----BEGIN\s+(?:RSA\s+|EC\s+|OPENSSH\s+)?PRIVATE\s+KEY-----[\s\S]*?-----END\s+(?:RSA\s+|EC\s+|OPENSSH\s+)?PRIVATE\s+KEY-----/g;

/**
 * Redact credential shapes before untrusted evidence leaves the evaluator or
 * becomes part of a public report. The replacements intentionally keep a short
 * provider prefix so reviewers can still understand the finding category.
 */
export function redactKnownSecrets(value: string): string {
  return value
    .replace(PRIVATE_KEY_BLOCK, "***redacted private key***")
    .replace(/sk-(?:proj-)?[a-zA-Z0-9_-]{8,}/g, "sk-***redacted***")
    .replace(/github_pat_[a-zA-Z0-9_]{8,}/g, "github_pat_***redacted***")
    .replace(/gh[opusr]_[a-zA-Z0-9]{8,}/g, "gh*_***redacted***")
    .replace(/AKIA[0-9A-Z]{16}/g, "AKIA***redacted***")
    .replace(/AIza[0-9A-Za-z_-]{20,}/g, "AIza***redacted***")
    .replace(/xox[baprs]-[0-9a-zA-Z-]{8,}/g, "xox*-***redacted***")
    .replace(/((?:password|passwd|secret)\s*[:=]\s*["'])[^"'\n]{6,}(["'])/gi, "$1***redacted***$2");
}
