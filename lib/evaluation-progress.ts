export interface EvaluationProgress {
  status: "pending" | "running" | "done" | "failed";
  progress: number;
  stage?: string;
  slug?: string;
}

function parseProgress(value: unknown, jobId: string): EvaluationProgress {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid progress");
  const row = value as Record<string, unknown>;
  if (row.id !== jobId || typeof row.status !== "string" || !["pending", "running", "done", "failed"].includes(row.status) ||
    typeof row.progress !== "number" || !Number.isFinite(row.progress) || row.progress < 0 || row.progress > 100) {
    throw new Error("Invalid progress");
  }
  return {
    status: row.status as EvaluationProgress["status"], progress: row.progress,
    ...(typeof row.stage === "string" && row.stage.length <= 64 ? { stage: row.stage } : {}),
    ...(typeof row.slug === "string" && /^[a-z0-9_-]{1,200}$/i.test(row.slug) ? { slug: row.slug } : {}),
  };
}

/** Polls only the existing job. A paused query is not a failed evaluation. */
export function watchEvaluationProgress(jobId: string, callbacks: {
  onProgress: (progress: EvaluationProgress) => void;
  onPause: (message: string) => void;
  onUnauthorized: () => void;
}): () => void {
  let stopped = false;
  let failures = 0;
  let timer: ReturnType<typeof setTimeout>;
  let controller: AbortController | null = null;
  const pause = (message: string) => { stopped = true; callbacks.onPause(message); };

  async function poll() {
    if (stopped) return;
    controller = new AbortController();
    const deadline = setTimeout(() => controller?.abort(), 15_000);
    try {
      const response = await fetch(`/api/evaluate/${encodeURIComponent(jobId)}`, {
        cache: "no-store", signal: controller.signal,
      });
      if (stopped) return;
      if (response.status === 401) { stopped = true; callbacks.onUnauthorized(); return; }
      if (response.status === 403 || response.status === 404) {
        pause("暂时无法查询此任务，请在账户页核对任务记录。"); return;
      }
      if (response.status === 429) { pause("查询过于频繁，请稍后继续查询原任务。"); return; }
      if (!response.ok) throw new Error("Progress unavailable");
      const data = parseProgress(await response.json(), jobId);
      if (stopped) return;
      failures = 0;
      callbacks.onProgress(data);
      if (data.status === "pending" || data.status === "running") timer = setTimeout(poll, 1800);
      else stopped = true;
    } catch {
      if (stopped) return;
      failures += 1;
      if (failures >= 3) pause("暂时无法连接进度服务，已暂停自动查询。");
      else timer = setTimeout(poll, 3500 * failures);
    } finally {
      clearTimeout(deadline);
      controller = null;
    }
  }

  timer = setTimeout(poll, 900);
  return () => { stopped = true; clearTimeout(timer); controller?.abort(); };
}
