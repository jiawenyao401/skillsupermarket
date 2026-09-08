function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

// Never substitute the running engine's version for a stored report's version.
// Conflicting or malformed metadata must not acquire an invented provenance.
export function getReportVersion(report: unknown): { version: string | null; label: string } {
  const data = record(report);
  const raw = [data?.version, record(data?.methodology)?.evaluatorVersion].filter((v) => v !== undefined && v !== null);
  if (raw.length === 0) return { version: null, label: "版本未记录" };
  if (raw.some((v) => typeof v !== "string" || !/^\d{1,4}\.\d{1,4}\.\d{1,4}$/.test(v))) {
    return { version: null, label: "版本记录无效" };
  }
  if (new Set(raw).size > 1) return { version: null, label: "版本记录不一致" };
  const version = raw[0] as string;
  return { version, label: `v${version}` };
}
