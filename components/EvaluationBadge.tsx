"use client";

import Image from "next/image";
import { Check, Copy, ExternalLink } from "lucide-react";
import { useState } from "react";

interface EvaluationBadgeProps {
  badgeUrl: string;
  detailUrl: string;
  skillName: string;
}
export function EvaluationBadge({ badgeUrl, detailUrl, skillName }: EvaluationBadgeProps) {
  const [copied, setCopied] = useState(false);
  const markdown = `[![${skillName} Skill Supermarket evaluation](${badgeUrl})](${detailUrl})`;

  async function copyMarkdown() {
    await navigator.clipboard.writeText(markdown);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <aside className="surface-card overflow-hidden p-5 sm:p-6" aria-labelledby="evaluation-badge-title">
      <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
        <div>
          <h2 id="evaluation-badge-title" className="font-bold">把真实评测展示到项目主页</h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
            项目作者可以把动态徽章加入 GitHub README。分数更新后徽章自动同步，点击可查看完整证据报告。
          </p>
        </div>
        <a href={detailUrl} className="shrink-0" aria-label={`打开 ${skillName} 的公开评测报告`}>
          <Image src={badgeUrl} alt={`${skillName} Skill Supermarket 评测徽章`} width={244} height={28} unoptimized />
        </a>
      </div>
      <div className="mt-5 flex flex-col gap-2 sm:flex-row">
        <code className="min-w-0 flex-1 overflow-x-auto rounded-xl bg-muted px-4 py-3 text-xs text-muted-foreground">{markdown}</code>
        <button type="button" onClick={copyMarkdown} className="button-primary h-10 shrink-0 px-4 text-sm">
          {copied ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
          {copied ? "已复制" : "复制 README 徽章"}
        </button>
      </div>
      <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
        <ExternalLink className="h-3.5 w-3.5" /> 链接带有来源参数，可区分 README 带来的真实访问。
      </p>
      <span className="sr-only" aria-live="polite">{copied ? "Markdown 徽章代码已复制" : ""}</span>
    </aside>
  );
}
