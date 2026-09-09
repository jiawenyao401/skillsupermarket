"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "./ui/Button";

export function ReportShare({ url }: { url: string }) {
  const [status, setStatus] = useState<"idle" | "copying" | "copied" | "error">("idle");
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (status === "error") {
      input.current?.focus();
      input.current?.select();
    }
  }, [status]);

  async function copyLink() {
    setStatus("copying");
    try {
      await navigator.clipboard.writeText(url);
      setStatus("copied");
    } catch {
      setStatus("error");
    }
  }

  return (
    <aside className="min-w-0 rounded-2xl border px-4 py-4 sm:px-5" aria-label="分享公开报告">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-bold">把报告发给一起选型的同事</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">无需登录即可阅读。链接展示最新报告，不是固定版本存档。</p>
        </div>
        <Button type="button" variant="outline" onClick={copyLink} disabled={status === "copying"}
          className="min-h-11 shrink-0 rounded-full px-4 text-sm" aria-busy={status === "copying"}>
          {status === "copied" ? <Check className="mr-2 h-4 w-4" aria-hidden="true" /> : <Copy className="mr-2 h-4 w-4" aria-hidden="true" />}
          {status === "copying" ? "正在复制…" : "复制报告链接"}
        </Button>
      </div>
      <p role="status" aria-live="polite" className="mt-2 text-xs leading-5 text-muted-foreground">
        {status === "copied" ? "链接已复制，可粘贴给同事。" : status === "error" ? "浏览器未允许自动复制，请手动复制下方链接。" : "只复制链接，不会自动发送消息。"}
      </p>
      <details className="mt-2 text-xs text-muted-foreground" open={status === "error" || undefined}>
        <summary className="cursor-pointer py-2">查看链接 / 手动复制</summary>
        <input ref={input} type="text" readOnly value={url} aria-label="公开报告链接"
          onFocus={(event) => event.currentTarget.select()}
          className="mt-1 min-h-11 w-full min-w-0 rounded-lg border bg-background px-3 font-mono text-xs text-foreground" />
      </details>
    </aside>
  );
}
