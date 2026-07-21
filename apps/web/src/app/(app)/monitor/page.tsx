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
import { useT } from "@/lib/i18n/provider";

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
  const t = useT();
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
      toast.error(t("monitor.requiredError"));
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
      toast.success(t("monitor.created"));
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
      toast.success(t("monitor.fetchTriggered"));
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
    if (res) { toast.success(t("common.deleted")); void load(); }
  }

  async function importJob(job: Job) {
    const res = await api<{ jdId: string }>(`/discovered-jobs/${job.id}/import`, { method: "POST" });
    if (res) {
      toast.success(t("monitor.importedToast"));
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
          <h1 className="text-xl font-semibold">{t("monitor.title")}</h1>
          <p className="text-sm text-muted-foreground">
            {t("monitor.subtitle")}
          </p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="size-4" /> {t("monitor.newWatch")}</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader><DialogTitle>{t("monitor.newWatchTitle")}</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>{t("monitor.name")}</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={t("monitor.namePlaceholder")} />
              </div>
              <div className="space-y-1.5">
                <Label>{t("monitor.keywords")}</Label>
                <Input value={form.keywords} onChange={(e) => setForm({ ...form, keywords: e.target.value })} placeholder={t("monitor.keywordsPlaceholder")} />
              </div>
              <div className="space-y-1.5">
                <Label>{t("monitor.source")}</Label>
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
                  <Label>{t("monitor.locations")}</Label>
                  <Input value={form.locations} onChange={(e) => setForm({ ...form, locations: e.target.value })} placeholder={t("monitor.locationsPlaceholder")} />
                </div>
                <div className="space-y-1.5">
                  <Label>{t("monitor.interval")}</Label>
                  <Select value={form.intervalMinutes} onValueChange={(v) => setForm({ ...form, intervalMinutes: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="30">{t("monitor.interval.30")}</SelectItem>
                      <SelectItem value="60">{t("monitor.interval.60")}</SelectItem>
                      <SelectItem value="240">{t("monitor.interval.240")}</SelectItem>
                      <SelectItem value="1440">{t("monitor.interval.1440")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={createWatch}>{t("monitor.createAndRun")}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* 监测任务 */}
      {!watches ? <Skeleton className="h-20" /> : watches.length === 0 ? (
        <Card><CardContent className="flex flex-col items-center gap-2 py-8 text-sm text-muted-foreground">
          <Radar className="size-6" />
          {t("monitor.watchEmpty")}
        </CardContent></Card>
      ) : (
        <div className="space-y-2">
          {watches.map((w) => (
            <Card key={w.id}>
              <CardContent className="flex items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium">{w.name}</p>
                    {w.newJobCount > 0 && <Badge>{t("monitor.newBadge", { count: w.newJobCount })}</Badge>}
                    {w.lastError && <Badge variant="destructive" title={w.lastError}>{t("monitor.fetchError")}</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {w.keywords.join(" / ")} · {w.sources.map((s) => SOURCE_LABEL[s] ?? s).join("、")}
                    {w.locations.length > 0 && ` · ${w.locations.join("/")}`}
                    {` · ${w.intervalMinutes >= 60 ? t("monitor.everyHours", { hours: w.intervalMinutes / 60 }) : t("monitor.everyMinutes", { minutes: w.intervalMinutes })}`}
                    {w.lastRunAt && ` · ${t("monitor.lastRun", { time: new Date(w.lastRunAt).toLocaleString("zh-CN") })}`}
                  </p>
                </div>
                <Button variant="ghost" size="icon" className="size-8" title={t("monitor.runNow")} disabled={running === w.id} onClick={() => runNow(w.id)}>
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
        <h2 className="text-sm font-semibold">{t("monitor.discoveredJobs")}</h2>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("monitor.filter.all")}</SelectItem>
            <SelectItem value="new">{t("monitor.filter.new")}</SelectItem>
            <SelectItem value="imported">{t("monitor.filter.imported")}</SelectItem>
            <SelectItem value="dismissed">{t("monitor.filter.dismissed")}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {!jobs ? <Skeleton className="h-32" /> : jobs.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">{t("monitor.jobsEmpty")}</p>
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
                      {j.status === "imported" && <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">{t("monitor.imported")}</Badge>}
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
                      <Button size="sm" variant="outline" onClick={() => router.push(`/jobs/${j.jdId}`)}>{t("monitor.seeMatch")}</Button>
                    ) : (
                      <Button size="sm" onClick={() => importJob(j)}>{t("monitor.importAsJd")}</Button>
                    )}
                    {j.status !== "dismissed" && (
                      <Button size="sm" variant="ghost" onClick={() => dismissJob(j.id)}>{t("monitor.dismiss")}</Button>
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
