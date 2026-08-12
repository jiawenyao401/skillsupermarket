"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { useRouter } from "next/navigation";

export default function EvaluatePage() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "提交失败");
      setResult(data);
      // 3 秒后跳到详情页
      setTimeout(() => {
        if (data.slug) router.push(`/skill/${data.slug}`);
      }, 3000);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Skill 评测</h1>
        <p className="text-muted-foreground mt-2">
          提交一个 GitHub repo / npm 包 / 完整 URL，我们会自动：
        </p>
        <ul className="mt-3 text-sm text-muted-foreground list-disc pl-5 space-y-1">
          <li>从仓库拉取元数据和 README</li>
          <li>跑安全扫描（prompt 注入、敏感数据、危险 API）</li>
          <li>用 LLM 评审 5 维质量分（实用/清晰/复用/设计/文档）</li>
          <li>算流行度 + 活跃度</li>
          <li>入库并生成详情页</li>
        </ul>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="text-sm font-medium">URL 或包名</label>
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://github.com/anthropics/skills/tree/main/skills/... 或 @modelcontextprotocol/server-git"
            className="mt-1 w-full px-3 py-2 border rounded-md bg-background"
            required
          />
          <p className="text-xs text-muted-foreground mt-1">
            支持 GitHub repo / npm 包 / PyPI 包
          </p>
        </div>

        <Button type="submit" disabled={submitting} className="w-full">
          {submitting ? "提交中..." : "开始评测"}
        </Button>
      </form>

      {error && (
        <div className="p-3 rounded border border-destructive bg-destructive/10 text-destructive text-sm">
          ❌ {error}
        </div>
      )}

      {result && (
        <div className="p-4 rounded border bg-muted text-sm space-y-2">
          <div>✅ 已提交评测任务</div>
          <div>Skill: <code>{result.slug}</code></div>
          <div className="text-muted-foreground">
            3 秒后跳转到详情页...（评测需要 1-2 分钟完成）
          </div>
        </div>
      )}

      <div className="border-t pt-6 text-xs text-muted-foreground space-y-2">
        <p><strong>评分维度说明：</strong></p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>实用性 (20)</strong>：解决什么问题？场景是否清晰？</li>
          <li><strong>清晰度 (20)</strong>：描述和文档是否清楚？</li>
          <li><strong>可复用性 (20)</strong>：其他开发者能直接用吗？</li>
          <li><strong>设计质量 (20)</strong>：API/接口设计是否合理？</li>
          <li><strong>文档质量 (20)</strong>：README/示例/参数说明完整？</li>
        </ul>
        <p className="mt-2">
          💡 评测是异步执行，提交后会立即进入队列。你可以刷新详情页查看进度。
        </p>
      </div>
    </div>
  );
}
