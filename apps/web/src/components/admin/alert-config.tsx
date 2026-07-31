"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

type Config = { enabled: boolean; dailyThresholdUsd: number; webhookUrl: string | null; lastFiredOn: string | null };

const STATUS_LABEL: Record<string, string> = {
  disabled: "未启用",
  below: "未超阈值",
  already_fired: "今日已通知过",
  exceeded_no_webhook: "已超阈值，但未配置 webhook",
  webhook_error: "已超阈值，webhook 发送失败",
  fired: "已超阈值，已发送通知",
};

export function AlertConfig({ config }: { config: Config }) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(config.enabled);
  const [threshold, setThreshold] = useState(config.dailyThresholdUsd);
  const [webhook, setWebhook] = useState(config.webhookUrl ?? "");
  const [busy, setBusy] = useState(false);
  const [checkResult, setCheckResult] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/alerts", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled, dailyThresholdUsd: threshold, webhookUrl: webhook.trim() || undefined }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error?.message ?? "保存失败");
      toast.success("已保存");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "保存失败");
    } finally {
      setBusy(false);
    }
  }

  async function checkNow() {
    setBusy(true);
    setCheckResult(null);
    try {
      const res = await fetch("/api/admin/alerts/check", { method: "POST" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error?.message ?? "检查失败");
      setCheckResult(`${STATUS_LABEL[json.status] ?? json.status}（今日 $${Number(json.cost).toFixed(4)} / 阈值 $${Number(json.threshold).toFixed(4)}）`);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "检查失败");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3 rounded-lg border bg-card p-4">
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={enabled} disabled={busy} onChange={(e) => setEnabled(e.target.checked)} />
        启用当日成本告警
      </label>
      <div className="flex items-center gap-2 text-sm">
        <span className="w-24 text-muted-foreground">日阈值 (USD)</span>
        <input type="number" min={0} step="0.01" value={threshold} disabled={busy} onChange={(e) => setThreshold(Math.max(0, Number(e.target.value)))} className="w-32 rounded-md border bg-background px-2 py-1" />
      </div>
      <div className="flex items-center gap-2 text-sm">
        <span className="w-24 text-muted-foreground">Webhook URL</span>
        <input type="url" value={webhook} disabled={busy} placeholder="https://hooks.slack.com/..." onChange={(e) => setWebhook(e.target.value)} className="w-96 max-w-full rounded-md border bg-background px-2 py-1 font-mono text-xs" />
      </div>
      {config.lastFiredOn && <p className="text-xs text-muted-foreground">上次通知：{config.lastFiredOn}</p>}
      <div className="flex items-center gap-2">
        <Button size="sm" disabled={busy} onClick={save}>保存</Button>
        <Button size="sm" variant="outline" disabled={busy} onClick={checkNow}>立即检查</Button>
        {checkResult && <span className="text-xs text-muted-foreground">{checkResult}</span>}
      </div>
      <p className="text-xs text-muted-foreground">worker 每小时自动检查一次；「立即检查」用于当场验证。当日只通知一次。</p>
    </div>
  );
}
