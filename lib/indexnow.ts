// IndexNow keys are public ownership proofs, not secrets. Keep this value in
// sync with public/2b1d51e8ea840f812aba6f18e051277c.txt.
export const INDEXNOW_KEY = "2b1d51e8ea840f812aba6f18e051277c";

export const INDEXNOW_ENDPOINTS = [
  "https://api.indexnow.org/indexnow",
  "https://yandex.com/indexnow",
] as const;

type IndexNowPayload = {
  host: string;
  key: string;
  keyLocation: string;
  urlList: string[];
};

type IndexNowResult = {
  endpoint: string;
  status: number;
};

const FALLBACK_STATUSES = new Set([403, 500, 502, 503, 504]);

/**
 * Submit once through the protocol's shared network. Some participating
 * endpoints verify a new host differently, so a verification or transient
 * endpoint failure may fall through to the next official participant.
 */
export async function submitIndexNowPayload(
  payload: IndexNowPayload,
  fetcher: typeof fetch = fetch,
): Promise<IndexNowResult> {
  const failures: string[] = [];

  for (const endpoint of INDEXNOW_ENDPOINTS) {
    try {
      const response = await fetcher(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(15_000),
      });
      if (response.ok || response.status === 202) {
        return { endpoint, status: response.status };
      }

      const body = (await response.text()).replace(/\s+/g, " ").slice(0, 240);
      failures.push(`${new URL(endpoint).hostname}: HTTP ${response.status}${body ? ` ${body}` : ""}`);
      if (!FALLBACK_STATUSES.has(response.status)) break;
    } catch (error) {
      failures.push(`${new URL(endpoint).hostname}: ${error instanceof Error ? error.message : "request failed"}`);
    }
  }

  throw new Error(`IndexNow endpoints failed: ${failures.join("; ")}`);
}
