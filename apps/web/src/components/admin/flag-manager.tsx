"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

type Flag = { id: string; key: string; description: string | null; enabled: boolean; rolloutPercent: number };

function FlagRow({ flag }: { flag: Flag }) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(flag.enabled);
  const [rollout, setRollout] = useState(flag.rolloutPercent);
  const [busy, setBusy] = useState(false);
  const dirty = enabled !== flag.enabled || rollout !== flag.rolloutPercent;

  async function save() {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/flags/${flag.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled, rolloutPercent: rollout }),
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

  return (
    <tr className="border-t align-top">
      <td className="px-3 py-2">
        <div className="font-mono text-xs">{flag.key}</div>
        {flag.description && <div className="text-xs text-muted-foreground">{flag.description}</div>}
      </td>
      <td className="px-3 py-2">
        <label className="flex items-center gap-1.5 text-sm">
          <input type="checkbox" checked={enabled} disabled={busy} onChange={(e) => setEnabled(e.target.checked)} />
          {enabled ? "开" : "关"}
        </label>
      </td>
      <td className="px-3 py-2">
        <input
          type="number"
          min={0}
          max={100}
          value={rollout}
          disabled={busy}
          onChange={(e) => setRollout(Math.max(0, Math.min(100, Number(e.target.value))))}
          className="w-20 rounded-md border bg-background px-2 py-1 text-sm"
        />
        <span className="ml-1 text-xs text-muted-foreground">%</span>
      </td>
      <td className="px-3 py-2 text-right">
        <Button size="sm" variant="outline" disabled={busy || !dirty} onClick={save}>保存</Button>
      </td>
    </tr>
  );
}

export function FlagManager({ flags }: { flags: Flag[] }) {
  const router = useRouter();
  const [key, setKey] = useState("");
  const [desc, setDesc] = useState("");
  const [busy, setBusy] = useState(false);

  async function create() {
    if (!key.trim()) return;
    setBusy(true);
    try {
      const res = await fetch("/api/admin/flags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: key.trim(), description: desc.trim() || undefined }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error?.message ?? "创建失败");
      toast.success("已创建");
      setKey("");
      setDesc("");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "创建失败");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-card p-3">
        <input value={key} onChange={(e) => setKey(e.target.value)} placeholder="key（如 new_dashboard）" className="w-52 rounded-md border bg-background px-2 py-1.5 text-sm" />
        <input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="描述（可选）" className="w-64 rounded-md border bg-background px-2 py-1.5 text-sm" />
        <Button size="sm" disabled={busy || !key.trim()} onClick={create}>创建开关</Button>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Key</th>
              <th className="px-3 py-2 font-medium">启用</th>
              <th className="px-3 py-2 font-medium">放量比例</th>
              <th className="px-3 py-2 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {flags.length === 0 && <tr><td colSpan={4} className="px-3 py-6 text-center text-muted-foreground">暂无开关，先创建一个</td></tr>}
            {flags.map((f) => <FlagRow key={f.id} flag={f} />)}
          </tbody>
        </table>
      </div>
    </div>
  );
}
