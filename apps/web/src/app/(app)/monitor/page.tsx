"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { api } from "@/lib/client";
import { WATCH_SOURCES } from "@careeros/shared";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ExternalLink, Play, Plus, Radar, Trash2, Loader2 } from "lucide-react";

type Watch = {
  id: string; name: string; keywords: string[]; sources: string[]; locations: string[];
  intervalMinutes: number; enabled: boolean; lastRunAt?: string | null; lastError?: string | null;
  newJobCount: number;
};

type Job = {
  id: string; source: string; title: string; company?: string | null; location?: string | null;
  salary?: string | null; url: string; snippet?: string | null; publishedAt?: string | null;
  status: "new" | "viewed" | "imported" | "dismissed"; jdId?: string | null;
  createdAt: string; watch: { name: string };
};

const SOURCE_LABEL = Object.fromEntries(WATCH_SOURCES.map((s) => [s.id, s.label]));

const EMPTY_FORM = { name: "", keywords: "", sources: ["tencent", "bytedance"] as string[], locations: "", intervalMinutes: "60" };

export default function MonitorPage() {
  const router = useRouter();
  const [watches, setWatches] = useState<Watch[] | null>(null);
  const [jobs, setJobs] = useState<Job[] | null>(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [running, setRunning] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [w, j] = await Promise.all([
      api<{ data: Watch[] }>("/watches"),
      api<{ data: Job[] }>(`/discovered-jobs?status=${statusFilter}`),
    ]);
    if (w) setWatches(w.data);
    if (j) setJobs(j.data);
  }, [statusFilter]);

  useEffect(() => { void load(); }, [load]);

  async function createWatch() {
    const keywords = form.keywords.split(/[,，]/).map((s) => s.trim()).filter(Boolean);
    if (!form.name || keywords.length === 0 || form.sources.length === 0) {
      toast.error("名称、关键词、来源均为必填");
      return;
    }
    const res = await api("/watches", {
      method: "POST",
      body: JSON.stringify({
        name: form.name,
        keywords,
        sources: form.sources,
        locations: form.locations.split(/[,，]/).map((s) => s.trim()).filter(Boolean),
        intervalMinutes: Number(form.intervalMinutes),
      }),
    });
    if (res) {
      toast.success("已创建，首次抓取已排队");
      setCreateOpen(false);
      setForm(EMPTY_FORM);
      const created = res as { id: string };
      void api(`/watches/${created.id}/run`, { method: "POST", silent: true });
      setTimeout(() => void load(), 4000);
      void load();
    }
  }

  async function runNow(id: string) {
    setRunning(id);
    const res = await api(`/watches/${id}/run`, { method: "POST" });
    if (res) {
      toast.success("已触发抓取，稍候刷新");
      setTimeout(() => { void load(); setRunning(null); }, 5000);
    } else {
      setRunning(null);
    }
  }

  async function toggleWatch(w: Watch) {
    const res = await api(`/watches/${w.id}`, { method: "PUT", body: JSON.stringify({ enabled: !w.enabled }) });
    if (res) void load();
  }

  async function removeWatch(id: string) {
    const res = await api(`/watches/${id}`, { method: "DELETE" });
    if (res) { toast.success("已删除"); void load(); }
  }

  async function importJob(job: Job) {
    const res = await api<{ jdId: string }>(`/discovered-jobs/${job.id}/import`, { method: "POST" });
    if (res) {
      toast.success("已导入为 JD，解析中");
      router.push(`/jobs/${res.jdId}`);
    }
  }

  async function dismissJob(id: string) {
    const res = await api(`/discovered-jobs/${id}`, { method: "PUT", body: JSON.stringify({ status: "dismissed" }) });
    if (res) void load();
  }

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold">岗位监测</h1>
          <p className="text-sm text-muted-foreground">
            按关键词自动盯住招聘渠道的新岗位，一键导入为 JD 做匹配。来源可在代码中扩展。
          </p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="size-4" /> 新建监测</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader><DialogTitle>新建岗位监测</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>名称 *</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="海外发行 · 大厂" />
              </div>
              <div className="space-y-1.5">
                <Label>关键词（逗号分隔，最多 5 个）*</Label>
                <Input value={form.keywords} onChange={(e) => setForm({ ...form, keywords: e.target.value })} placeholder="海外发行, 游戏运营" />
              </div>
              <div className="space-y-1.5">
                <Label>来源 *</Label>
                <div className="flex flex-wrap gap-2">
                  {WATCH_SOURCES.map((s) => {
                    const on = form.sources.includes(s.id);
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() =>
                          setForm({
                            ...form,
                            sources: on ? form.sources.filter((x) => x !== s.id) : [...form.sources, s.id],
                          })
                        }
                      >
                        <Badge variant={on ? "default" : "outline"}>{s.label}</Badge>
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>城市过滤（可空）</Label>
                  <Input value={form.locations} onChange={(e) => setForm({ ...form, locations: e.target.value })} placeholder="深圳, 上海" />
                </div>
                <div className="space-y-1.5">
                  <Label>检查间隔</Label>
                  <Select value={form.intervalMinutes} onValueChange={(v) => setForm({ ...form, intervalMinutes: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="30">30 分钟</SelectItem>
                      <SelectItem value="60">1 小时</SelectItem>
                      <SelectItem value="240">4 小时</SelectItem>
                      <SelectItem value="1440">每天</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={createWatch}>创建并抓取</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* 监测任务 */}
      {!watches ? <Skeleton className="h-20" /> : watches.length === 0 ? (
        <Card><CardContent className="flex flex-col items-center gap-2 py-8 text-sm text-muted-foreground">
          <Radar className="size-6" />
          还没有监测任务。建一个，让新岗位自己来找你。
        </CardContent></Card>
      ) : (
        <div className="space-y-2">
          {watches.map((w) => (
            <Card key={w.id}>
              <CardContent className="flex items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium">{w.name}</p>
                    {w.newJobCount > 0 && <Badge>{w.newJobCount} 新</Badge>}
                    {w.lastError && <Badge variant="destructive" title={w.lastError}>抓取异常</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {w.keywords.join(" / ")} · {w.sources.map((s) => SOURCE_LABEL[s] ?? s).join("、")}
                    {w.locations.length > 0 && ` · ${w.locations.join("/")}`}
                    {` · 每 ${w.intervalMinutes >= 60 ? `${w.intervalMinutes / 60} 小时` : `${w.intervalMinutes} 分钟`}`}
                    {w.lastRunAt && ` · 上次 ${new Date(w.lastRunAt).toLocaleString("zh-CN")}`}
                  </p>
                </div>
                <Button variant="ghost" size="icon" className="size-8" title="立即抓取" disabled={running === w.id} onClick={() => runNow(w.id)}>
                  {running === w.id ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
                </Button>
                <Switch checked={w.enabled} onCheckedChange={() => toggleWatch(w)} />
                <Button variant="ghost" size="icon" className="size-8" onClick={() => removeWatch(w.id)}>
                  <Trash2 className="size-4" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Separator />

      {/* 岗位 feed */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">发现的岗位</h2>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部</SelectItem>
            <SelectItem value="new">未读</SelectItem>
            <SelectItem value="imported">已导入</SelectItem>
            <SelectItem value="dismissed">已忽略</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {!jobs ? <Skeleton className="h-32" /> : jobs.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">暂无岗位。创建监测或点「立即抓取」。</p>
      ) : (
        <div className="space-y-2">
          {jobs.map((j) => (
            <Card key={j.id} className={j.status === "new" ? "border-primary/40" : ""}>
              <CardContent className="py-3">
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <a href={j.url} target="_blank" rel="noreferrer" className="text-sm font-medium hover:underline">
                        {j.title} <ExternalLink className="inline size-3 text-muted-foreground" />
                      </a>
                      {j.status === "new" && <Badge className="px-1.5 py-0 text-[10px]">NEW</Badge>}
                      {j.status === "imported" && <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">已导入</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {[j.company, j.location, j.salary].filter(Boolean).join(" · ")}
                      {` · ${SOURCE_LABEL[j.source] ?? j.source} · ${j.watch.name}`}
                      {j.publishedAt && ` · ${new Date(j.publishedAt).toLocaleDateString("zh-CN")}`}
                    </p>
                    {j.snippet && <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{j.snippet}</p>}
                  </div>
                  <div className="flex shrink-0 gap-1.5">
                    {j.jdId ? (
                      <Button size="sm" variant="outline" onClick={() => router.push(`/jobs/${j.jdId}`)}>看匹配</Button>
                    ) : (
                      <Button size="sm" onClick={() => importJob(j)}>导入为 JD</Button>
                    )}
                    {j.status !== "dismissed" && (
                      <Button size="sm" variant="ghost" onClick={() => dismissJob(j.id)}>忽略</Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
