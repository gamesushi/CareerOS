"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { api } from "@/lib/client";
import {
  WATCH_SOURCES, JOB_CATEGORIES, JOB_ROLES, REGIONS, JOB_LANGUAGES, EXPERIENCE_LEVELS,
  SOURCE_REGIONS, SOURCE_INDUSTRIES,
} from "@careeros/shared";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ExternalLink, Play, Plus, Radar, Trash2, Loader2, ChevronDown, Upload } from "lucide-react";
import { useT } from "@/lib/i18n/provider";

type Watch = {
  id: string; name: string; keywords: string[]; sources: string[]; locations: string[];
  matchCategories?: string[]; matchRoles?: string[]; matchRegions?: string[];
  matchLanguages?: string[]; matchExperience?: string[];
  intervalMinutes: number; enabled: boolean; lastRunAt?: string | null; lastError?: string | null;
  newJobCount: number;
  lastResult?: string | null;
};

type Job = {
  id: string; source: string; title: string; company?: string | null; location?: string | null;
  salary?: string | null; url: string; snippet?: string | null; publishedAt?: string | null;
  status: "new" | "viewed" | "imported" | "dismissed"; jdId?: string | null;
  reviewStatus?: "pending" | "approved" | "rejected";
  categories?: string[] | null;
  roles?: string[] | null; regions?: string[] | null;
  languages?: string[] | null; experience?: string[] | null;
  matchScore?: number | null;
  matchReasons?: { type: string; label: string; similarity: number }[] | null;
  createdAt: string; watch: { name: string };
};

const SOURCE_LABEL = Object.fromEntries(WATCH_SOURCES.map((s) => [s.id, s.label]));

/** 根据地区+业态筛选来源；未选时显示全部。 */
function filterSources(sourceIds: string[], regionIds: string[], industryIds: string[]) {
  if (regionIds.length === 0 && industryIds.length === 0) return sourceIds;
  return sourceIds.filter((id) => {
    const s = WATCH_SOURCES.find((x) => x.id === id);
    if (!s) return false;
    const regionMatch = regionIds.length === 0 || regionIds.includes(s.region);
    const industryMatch = industryIds.length === 0 || s.industries.some((i) => industryIds.includes(i));
    return regionMatch && industryMatch;
  });
}

// 职种按品类分组（表单分组渲染 / feed 二级筛选）
const ROLE_GROUPS = ["game", "finance", "tech", "ai", "general"].map((cat) => ({
  category: cat,
  roles: JOB_ROLES.filter((r) => r.category === cat),
}));
const PRESET_REGION_IDS = new Set<string>(REGIONS.map((r) => r.id));

const EMPTY_FORM = {
  name: "", keywords: "", sources: [] as string[],
  sourceRegions: [] as string[], sourceIndustries: [] as string[],
  categories: [] as string[], roles: [] as string[],
  regions: [] as string[], regionInput: "",
  languages: [] as string[], experience: [] as string[],
  excludeKeywords: "", maxAgeDays: "",
  intervalMinutes: "60",
};
const CATEGORY_FILTER_KEY = "careeros.categoryFilter";
const ROLE_FILTER_KEY = "careeros.roleFilter";

export default function MonitorPage() {
  const router = useRouter();
  const t = useT();
  const [watches, setWatches] = useState<Watch[] | null>(null);
  const [jobs, setJobs] = useState<Job[] | null>(null);
  const [cal, setCal] = useState<{ strong: number; moderate: number; weak: number; unscored: number; scored: number; verdict: string } | null>(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [roleFilter, setRoleFilter] = useState<string>("all");

  const [mounted, setMounted] = useState(false);

  // 水合完成后再从 localStorage 读取持久化筛选，避免 SSR/CSR 初值不一致导致 hydration mismatch
  useEffect(() => {
    let active = true;
    requestAnimationFrame(() => {
      if (!active) return;
      setMounted(true);
      const c = localStorage.getItem(CATEGORY_FILTER_KEY);
      if (c) setCategoryFilter(c);
      const r = localStorage.getItem(ROLE_FILTER_KEY);
      if (r) setRoleFilter(r);
    });
    return () => {
      active = false;
    };
  }, []);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [running, setRunning] = useState<string | null>(null);
  const [runStart, setRunStart] = useState<number | null>(null);
  const [runTick, setRunTick] = useState(0);
  const [rolesOpen, setRolesOpen] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const changeCategory = (c: string) => {
    setCategoryFilter(c);
    setRoleFilter("all"); // 切换品类时重置职种筛选
    if (typeof window !== "undefined") {
      localStorage.setItem(CATEGORY_FILTER_KEY, c);
      localStorage.setItem(ROLE_FILTER_KEY, "all");
    }
  };
  const changeRole = (r: string) => {
    setRoleFilter(r);
    if (typeof window !== "undefined") localStorage.setItem(ROLE_FILTER_KEY, r);
  };
  const toggleInList = (key: "sources" | "sourceRegions" | "sourceIndustries" | "categories" | "roles" | "regions" | "languages" | "experience", id: string) => {
    setForm((f) => {
      const list = f[key];
      return { ...f, [key]: list.includes(id) ? list.filter((x) => x !== id) : [...list, id] };
    });
  };

  /** 地区/业态变化时，把当前可见来源自动追加到已选列表。 */
  const syncSourcesWithFilters = (base: typeof EMPTY_FORM, patch: Partial<typeof EMPTY_FORM>) => {
    const next = { ...base, ...patch };
    const visible = filterSources(
      WATCH_SOURCES.map((s) => s.id),
      next.sourceRegions,
      next.sourceIndustries,
    );
    return { ...next, sources: [...new Set([...next.sources, ...visible])] };
  };

  const toggleSourceRegion = (id: string) => {
    setForm((f) => {
      const nextRegions = f.sourceRegions.includes(id)
        ? f.sourceRegions.filter((x) => x !== id)
        : [...f.sourceRegions, id];
      return syncSourcesWithFilters(f, { sourceRegions: nextRegions });
    });
  };

  const toggleSourceIndustry = (id: string) => {
    setForm((f) => {
      const nextIndustries = f.sourceIndustries.includes(id)
        ? f.sourceIndustries.filter((x) => x !== id)
        : [...f.sourceIndustries, id];
      return syncSourcesWithFilters(f, { sourceIndustries: nextIndustries });
    });
  };
  const addCustomRegion = () => {
    const v = form.regionInput.trim();
    if (!v) return;
    if (!form.regions.includes(v)) setForm({ ...form, regions: [...form.regions, v], regionInput: "" });
    else setForm({ ...form, regionInput: "" });
  };
  const clearSourceFilters = () => {
    setForm((f) => ({ ...f, sourceRegions: [], sourceIndustries: [] }));
  };

  type Cal = { strong: number; moderate: number; weak: number; unscored: number; scored: number; verdict: string };
  const load = useCallback(async () => {
    const [w, j, c] = await Promise.all([
      api<{ data: Watch[] }>("/watches"),
      api<{ data: Job[] }>(`/discovered-jobs?status=${statusFilter}`),
      api<{ data: Cal }>("/watches/calibration", { silent: true }),
    ]);
    if (w) setWatches(w.data);
    if (j) setJobs(j.data);
    if (c) setCal(c.data);
  }, [statusFilter]);

  useEffect(() => {
    let active = true;
    void (async () => {
      const [w, j, c] = await Promise.all([
        api<{ data: Watch[] }>("/watches"),
        api<{ data: Job[] }>(`/discovered-jobs?status=${statusFilter}`),
        api<{ data: Cal }>("/watches/calibration", { silent: true }),
      ]);
      if (active) {
        if (w) setWatches(w.data);
        if (j) setJobs(j.data);
        if (c) setCal(c.data);
      }
    })();
    return () => { active = false; };
  }, [statusFilter]);

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
        locations: [],
        matchCategories: form.categories,
        matchRoles: form.roles,
        matchRegions: form.regions,
        matchLanguages: form.languages,
        matchExperience: form.experience,
        excludeKeywords: form.excludeKeywords.split(/[,，]/).map((s) => s.trim()).filter(Boolean),
        maxAgeDays: form.maxAgeDays ? Number(form.maxAgeDays) : null,
        intervalMinutes: Number(form.intervalMinutes),
      }),
    });
    if (res) {
      toast.success(t("monitor.created"));
      setCreateOpen(false);
      setForm(EMPTY_FORM);
      setRolesOpen(false);
      setAdvancedOpen(false);
      const created = res as { id: string };
      void api(`/watches/${created.id}/run`, { method: "POST", silent: true });
      setTimeout(() => void load(), 4000);
      void load();
    }
  }

  // 抓取进行时每秒 tick 一次，驱动进度条动画重渲染
  useEffect(() => {
    if (running === null) return;
    const id = setInterval(() => setRunTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [running]);

  async function runNow(w: Watch) {
    const baseline = w.lastRunAt ?? null;
    setRunning(w.id);
    setRunStart(Date.now());
    const res = await api(`/watches/${w.id}/run`, { method: "POST" });
    if (!res) {
      setRunning(null);
      setRunStart(null);
      return;
    }
    toast.success(t("monitor.fetchTriggered"));
    const startedAt = Date.now();
    const iv = setInterval(async () => {
      try {
        const wres = await api<{ data: Watch[] }>("/watches");
        if (!wres) return;
        const u = wres.data.find((x) => x.id === w.id);
        const done =
          !!u &&
          (baseline == null
            ? !!u.lastRunAt
            : !!u.lastRunAt && new Date(u.lastRunAt).getTime() > new Date(baseline).getTime());
        if (done || Date.now() - startedAt > 180_000) {
          clearInterval(iv);
          setRunning(null);
          setRunStart(null);
          void load();
          if (done && u?.lastResult) {
            try {
              const r = JSON.parse(u.lastResult);
              toast.success(
                t("monitor.fetchDone", {
                  created: r.created ?? 0,
                  updated: r.updated ?? 0,
                  found: r.found ?? 0,
                }),
              );
              return;
            } catch {
              /* 解析失败则走兜底提示 */
            }
          }
          toast.success(t("monitor.fetchDoneSimple"));
        }
      } catch {
        /* 轮询瞬时失败忽略，下次继续 */
      }
    }, 3000);
  }

  async function toggleWatch(w: Watch) {
    const res = await api(`/watches/${w.id}`, { method: "PUT", body: JSON.stringify({ enabled: !w.enabled }) });
    if (res) void load();
  }

  async function removeWatch(id: string) {
    const res = await api(`/watches/${id}`, { method: "DELETE" });
    if (res) { toast.success(t("common.deleted")); void load(); }
  }

  async function trackJob(job: Job) {
    const res = await api<{ deduped?: boolean }>(`/applications`, {
      method: "POST",
      body: JSON.stringify({ discoveredJobId: job.id }),
    });
    if (res) toast.success(res.deduped ? t("monitor.trackDeduped") : t("monitor.trackAdded"));
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

  const [scoring, setScoring] = useState(false);
  async function scoreJobs() {
    setScoring(true);
    const res = await api(`/discovered-jobs/score`, { method: "POST" });
    if (res) {
      toast.success(t("monitor.scoreQueued"));
      setTimeout(() => {
        void load();
        setScoring(false);
      }, 3000);
    } else {
      setScoring(false);
    }
  }

  const visibleJobs =
    !jobs
      ? null
      : jobs.filter(
          (j) =>
            (categoryFilter === "all" || (j.categories ?? []).includes(categoryFilter)) &&
            (roleFilter === "all" || (j.roles ?? []).includes(roleFilter)),
        );
  // feed 二级职种筛选：选中具体品类时显示该品类职种 chips
  const feedRoles =
    categoryFilter === "all"
      ? []
      : JOB_ROLES.filter((r) => r.category === categoryFilter || (categoryFilter !== "general" && r.category === "general"));

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold">{t("monitor.title")}</h1>
          <p className="text-sm text-muted-foreground">
            {t("monitor.subtitle")}
          </p>
        </div>
        <div className="flex items-center gap-2">
        <Button size="sm" variant="outline" asChild>
          <Link href="/monitor/submit"><Upload className="size-4" /> {t("monitor.submitJob")}</Link>
        </Button>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="size-4" /> {t("monitor.newWatch")}</Button>
          </DialogTrigger>
          <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
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
              <div className="space-y-2">
                <Label>{t("monitor.source")}</Label>
                <div className="space-y-1.5 rounded-lg border p-3">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-xs text-muted-foreground">{t("monitor.sourceRegion")}</span>
                    {SOURCE_REGIONS.map((r) => {
                      const on = form.sourceRegions.includes(r.id);
                      return (
                        <button key={r.id} type="button" onClick={() => toggleSourceRegion(r.id)}>
                          <Badge variant={on ? "default" : "outline"} className="text-xs">{r.label}</Badge>
                        </button>
                      );
                    })}
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-xs text-muted-foreground">{t("monitor.sourceIndustry")}</span>
                    {SOURCE_INDUSTRIES.map((i) => {
                      const on = form.sourceIndustries.includes(i.id);
                      return (
                        <button key={i.id} type="button" onClick={() => toggleSourceIndustry(i.id)}>
                          <Badge variant={on ? "default" : "outline"} className="text-xs">{i.label}</Badge>
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {filterSources(
                    WATCH_SOURCES.map((s) => s.id),
                    form.sourceRegions,
                    form.sourceIndustries,
                  ).map((id) => {
                    const s = WATCH_SOURCES.find((x) => x.id === id)!;
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
                {(form.sourceRegions.length > 0 || form.sourceIndustries.length > 0) && (
                  <button type="button" onClick={clearSourceFilters} className="text-xs text-muted-foreground hover:text-foreground">
                    {t("monitor.clearSourceFilters")}
                  </button>
                )}
              </div>
              <div className="space-y-1.5">
                <Label>{t("monitor.matchCategories")}</Label>
                <p className="text-xs text-muted-foreground">{t("monitor.matchCategoriesHint")}</p>
                <div className="flex flex-wrap gap-2">
                  {JOB_CATEGORIES.map((c) => {
                    const on = form.categories.includes(c.id);
                    return (
                      <button key={c.id} type="button" onClick={() => toggleInList("categories", c.id)}>
                        <Badge variant={on ? "default" : "outline"}>{t(`category.${c.id}`)}</Badge>
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="space-y-1.5">
                <button
                  type="button"
                  onClick={() => setRolesOpen((v) => !v)}
                  className="flex w-full items-center justify-between"
                >
                  <div className="space-y-0.5 text-left">
                    <Label className="cursor-pointer">{t("monitor.matchRoles")}</Label>
                    <p className="text-xs text-muted-foreground">{t("monitor.matchRolesHint")}</p>
                  </div>
                  <ChevronDown className={`size-4 text-muted-foreground transition-transform ${rolesOpen ? "rotate-180" : ""}`} />
                </button>
                {!rolesOpen && form.roles.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {form.roles.map((r) => (
                      <button key={r} type="button" onClick={() => toggleInList("roles", r)}>
                        <Badge className="text-xs">{t(`role.${r}`)} ×</Badge>
                      </button>
                    ))}
                  </div>
                )}
                {rolesOpen && (
                  <div className="space-y-2 rounded-lg border p-3">
                    {ROLE_GROUPS.map((g) => (
                      <div key={g.category}>
                        <p className="mb-1 text-[11px] font-medium text-muted-foreground">{t(`category.${g.category}`)}</p>
                        <div className="flex flex-wrap gap-1.5">
                          {g.roles.map((r) => {
                            const on = form.roles.includes(r.id);
                            return (
                              <button key={r.id} type="button" onClick={() => toggleInList("roles", r.id)}>
                                <Badge variant={on ? "default" : "outline"} className="text-xs">{t(`role.${r.id}`)}</Badge>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="space-y-1.5">
                <button
                  type="button"
                  onClick={() => setAdvancedOpen((v) => !v)}
                  className="flex w-full items-center justify-between rounded-lg border p-2.5 text-left hover:bg-muted/50"
                >
                  <div>
                    <p className="text-sm font-medium">{t("monitor.advancedFilters")}</p>
                    <p className="text-xs text-muted-foreground">{t("monitor.advancedFiltersHint")}</p>
                  </div>
                  <ChevronDown className={`size-4 text-muted-foreground transition-transform ${advancedOpen ? "rotate-180" : ""}`} />
                </button>
                {advancedOpen && (
                  <div className="space-y-4 rounded-lg border p-3">
                    <div className="space-y-1.5">
                      <Label>{t("monitor.matchRegions")}</Label>
                      <div className="flex flex-wrap gap-1.5">
                        {REGIONS.map((r) => {
                          const on = form.regions.includes(r.id);
                          return (
                            <button key={r.id} type="button" onClick={() => toggleInList("regions", r.id)}>
                              <Badge variant={on ? "default" : "outline"} className="text-xs">{t(`region.${r.id}`)}</Badge>
                            </button>
                          );
                        })}
                        {form.regions.filter((r) => !PRESET_REGION_IDS.has(r)).map((r) => (
                          <button key={r} type="button" onClick={() => toggleInList("regions", r)}>
                            <Badge className="text-xs">{r} ×</Badge>
                          </button>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <Input
                          value={form.regionInput}
                          onChange={(e) => setForm({ ...form, regionInput: e.target.value })}
                          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustomRegion(); } }}
                          placeholder={t("monitor.regionCustomPlaceholder")}
                          className="h-8 text-xs"
                        />
                        <Button type="button" variant="outline" size="sm" onClick={addCustomRegion}>{t("common.add")}</Button>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label>{t("monitor.matchLanguages")}</Label>
                        <div className="flex flex-wrap gap-1.5">
                          {JOB_LANGUAGES.map((l) => {
                            const on = form.languages.includes(l);
                            return (
                              <button key={l} type="button" onClick={() => toggleInList("languages", l)}>
                                <Badge variant={on ? "default" : "outline"} className="text-xs">{t(`lang.${l}`)}</Badge>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <Label>{t("monitor.matchExperience")}</Label>
                        <div className="flex flex-wrap gap-1.5">
                          {EXPERIENCE_LEVELS.map((x) => {
                            const on = form.experience.includes(x);
                            return (
                              <button key={x} type="button" onClick={() => toggleInList("experience", x)}>
                                <Badge variant={on ? "default" : "outline"} className="text-xs">{t(`exp.${x}`)}</Badge>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label>{t("monitor.excludeKw")}</Label>
                        <Input value={form.excludeKeywords} onChange={(e) => setForm({ ...form, excludeKeywords: e.target.value })} placeholder={t("monitor.excludeKwPh")} className="h-8 text-xs" />
                      </div>
                      <div className="space-y-1.5">
                        <Label>{t("monitor.maxAge")}</Label>
                        <Input type="number" min={1} value={form.maxAgeDays} onChange={(e) => setForm({ ...form, maxAgeDays: e.target.value })} placeholder={t("monitor.maxAgePh")} className="h-8 text-xs" />
                      </div>
                    </div>
                  </div>
                )}
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
            <DialogFooter>
              <Button onClick={createWatch}>{t("monitor.createAndRun")}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      {/* 监测任务 */}
      {!watches ? <Skeleton className="h-20" /> : watches.length === 0 ? (
        <Card><CardContent className="flex flex-col items-center gap-2 py-8 text-sm text-muted-foreground">
          <Radar className="size-6" />
          {t("monitor.watchEmpty")}
        </CardContent></Card>
      ) : (
        <div className="space-y-2">
          {watches.map((w) => {
            const elapsed = runStart ? Date.now() - runStart : 0;
            const pct = Math.min(90, Math.round((elapsed / 90_000) * 90));
            return (
            <Card key={w.id}>
              <CardContent className="space-y-2 py-3">
                <div className="flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium">{w.name}</p>
                      {w.newJobCount > 0 && <Badge>{t("monitor.newBadge", { count: w.newJobCount })}</Badge>}
                      {w.lastError && <Badge variant="destructive" title={w.lastError}>{t("monitor.fetchError")}</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {w.keywords.join(" / ")} · {w.sources.map((s) => SOURCE_LABEL[s] ?? s).join("、")}
                      {w.locations.length > 0 && ` · ${w.locations.join("/")}`}
                      {(w.matchRoles?.length ?? 0) > 0 && ` · ${w.matchRoles!.map((r) => t(`role.${r}`)).join("/")}`}
                      {(w.matchRegions?.length ?? 0) > 0 && ` · ${w.matchRegions!.map((r) => (PRESET_REGION_IDS.has(r) ? t(`region.${r}`) : r)).join("/")}`}
                      {(w.matchLanguages?.length ?? 0) > 0 && ` · ${w.matchLanguages!.map((l) => t(`lang.${l}`)).join("/")}`}
                      {(w.matchExperience?.length ?? 0) > 0 && ` · ${w.matchExperience!.map((x) => t(`exp.${x}`)).join("/")}`}
                      {` · ${w.intervalMinutes >= 60 ? t("monitor.everyHours", { hours: w.intervalMinutes / 60 }) : t("monitor.everyMinutes", { minutes: w.intervalMinutes })}`}
                      {w.lastRunAt && ` · ${t("monitor.lastRun", { time: new Date(w.lastRunAt).toLocaleString("zh-CN") })}`}
                    </p>
                    {w.lastResult && (() => {
                      try {
                        const r = JSON.parse(w.lastResult);
                        return (
                          <p className="mt-1 text-xs text-muted-foreground">
                            {t("monitor.lastResult", { created: r.created, updated: r.updated, closed: r.closed, deleted: r.deleted })}
                          </p>
                        );
                      } catch {
                        return null;
                      }
                    })()}
                  </div>
                  <Button variant="ghost" size="icon" className="size-8" title={t("monitor.runNow")} disabled={running !== null} onClick={() => runNow(w)}>
                    {running === w.id ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
                  </Button>
                  <Switch checked={w.enabled} onCheckedChange={() => toggleWatch(w)} />
                  <Button variant="ghost" size="icon" className="size-8" onClick={() => removeWatch(w.id)}>
                    <Trash2 className="size-4" />
                  </Button>
                </div>
                {running === w.id && (
                  <div className="space-y-1">
                    <Progress value={pct} className="h-1.5" />
                    <p className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Loader2 className="size-3 animate-spin" />
                      {t("monitor.fetchingHint")}（已等待 {Math.max(0, Math.round(elapsed / 1000))} 秒）
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
            );
          })}
        </div>
      )}

      <Separator />

      {/* 品类匹配：用户可选「游戏类」等，自动只显示命中品类的岗位 */}
      <div className="flex flex-wrap items-center gap-2" suppressHydrationWarning>
        <span className="text-xs text-muted-foreground">{t("monitor.categoryFilter")}</span>
        <button type="button" onClick={() => changeCategory("all")}>
          <Badge variant={(mounted ? categoryFilter : "all") === "all" ? "default" : "outline"}>{t("category.all")}</Badge>
        </button>
        {JOB_CATEGORIES.map((c) => (
          <button key={c.id} type="button" onClick={() => changeCategory(c.id)}>
            <Badge variant={(mounted ? categoryFilter : "all") === c.id ? "default" : "outline"}>{t(`category.${c.id}`)}</Badge>
          </button>
        ))}
      </div>

      {/* 职种二级筛选：选中品类后出现该品类的职种 chips */}
      {feedRoles.length > 0 && (
        <div className="flex flex-wrap items-center gap-2" suppressHydrationWarning>
          <span className="text-xs text-muted-foreground">{t("monitor.roleFilter")}</span>
          <button type="button" onClick={() => changeRole("all")}>
            <Badge variant={(mounted ? roleFilter : "all") === "all" ? "default" : "outline"} className="text-xs">{t("role.all")}</Badge>
          </button>
          {feedRoles.map((r) => (
            <button key={r.id} type="button" onClick={() => changeRole(r.id)}>
              <Badge variant={(mounted ? roleFilter : "all") === r.id ? "default" : "outline"} className="text-xs">{t(`role.${r.id}`)}</Badge>
            </button>
          ))}
        </div>
      )}

      {/* 画像校准顾问 */}
      {cal && cal.scored > 0 && cal.verdict !== "no_data" && (
        <div
          className={`rounded-lg border px-3 py-2 text-sm ${
            cal.verdict === "good"
              ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-700 dark:text-emerald-400"
              : "border-amber-500/30 bg-amber-500/5 text-amber-700 dark:text-amber-400"
          }`}
        >
          {cal.verdict === "good" && t("monitor.calGood", { strong: cal.strong, moderate: cal.moderate, weak: cal.weak, scored: cal.scored })}
          {cal.verdict === "too_strict" && t("monitor.calStrict", { scored: cal.scored })}
          {cal.verdict === "too_broad" && t("monitor.calBroad", { strong: cal.strong, scored: cal.scored })}
          {cal.unscored > 0 && <span className="text-muted-foreground">{t("monitor.calUnscored", { unscored: cal.unscored })}</span>}
        </div>
      )}

      {/* 岗位 feed */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">{t("monitor.discoveredJobs")}</h2>
        <div className="flex items-center gap-2">
        <Button size="sm" variant="outline" disabled={scoring} onClick={scoreJobs}>
          {scoring ? t("monitor.scoring") : t("monitor.scoreBtn")}
        </Button>
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
      </div>

      {!visibleJobs ? <Skeleton className="h-32" /> : visibleJobs.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">{t("monitor.jobsEmpty")}</p>
      ) : (
        <div className="space-y-2">
          {visibleJobs.map((j) => (
            <Card key={j.id} className={j.status === "new" ? "border-primary/40" : ""}>
              <CardContent className="py-3">
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <a href={j.url} target="_blank" rel="noreferrer" className="text-sm font-medium hover:underline">
                        {j.title} <ExternalLink className="inline size-3 text-muted-foreground" />
                      </a>
                      {typeof j.matchScore === "number" && (
                        <span
                          className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                            j.matchScore >= 60
                              ? "bg-emerald-500/15 text-emerald-600"
                              : j.matchScore >= 30
                                ? "bg-amber-500/15 text-amber-600"
                                : "bg-muted text-muted-foreground"
                          }`}
                          title="岗位与你职业档案的匹配度"
                        >
                          {t("monitor.matchBadge")} {Math.round(j.matchScore)}
                        </span>
                      )}
                      {j.status === "new" && <Badge className="px-1.5 py-0 text-[10px]">NEW</Badge>}
                      {j.status === "imported" && <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">{t("monitor.imported")}</Badge>}
                      {(j.source === "user" || j.source === "import") && (
                        <Badge className="bg-sky-500/15 px-1.5 py-0 text-[10px] text-sky-600 hover:bg-sky-500/15" title={t("monitor.userSubmittedHint")}>
                          {t("monitor.userSubmitted")}
                        </Badge>
                      )}
                      {j.reviewStatus === "pending" && (
                        <Badge className="bg-amber-500/15 px-1.5 py-0 text-[10px] text-amber-600 hover:bg-amber-500/15" title={t("monitor.reviewPendingHint")}>
                          {t("monitor.reviewPending")}
                        </Badge>
                      )}
                      {j.reviewStatus === "rejected" && (
                        <Badge className="bg-destructive/10 px-1.5 py-0 text-[10px] text-destructive hover:bg-destructive/10" title={t("monitor.reviewRejectedHint")}>
                          {t("monitor.reviewRejected")}
                        </Badge>
                      )}
                      {j.categories?.map((c) => (
                        <Badge key={c} variant="secondary" className="px-1.5 py-0 text-[10px]">{t(`category.${c}`)}</Badge>
                      ))}
                      {j.roles?.map((r) => (
                        <Badge key={r} variant="outline" className="px-1.5 py-0 text-[10px]">{t(`role.${r}`)}</Badge>
                      ))}
                      {j.experience?.map((x) => (
                        <Badge key={x} variant="outline" className="px-1.5 py-0 text-[10px] text-muted-foreground">{t(`exp.${x}`)}</Badge>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {[j.company, j.location, j.salary].filter(Boolean).join(" · ")}
                      {` · ${SOURCE_LABEL[j.source] ?? j.source} · ${j.watch.name}`}
                      {j.publishedAt && ` · ${new Date(j.publishedAt).toLocaleDateString("zh-CN")}`}
                    </p>
                    {j.snippet && <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{j.snippet}</p>}
                    {j.matchReasons && j.matchReasons.length > 0 && (
                      <p className="mt-1 text-[11px] text-emerald-700/80 dark:text-emerald-500/80">
                        {t("monitor.hitLabel")}{j.matchReasons.map((r) => r.label).join(" · ")}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 gap-1.5">
                    <Button size="sm" variant="outline" onClick={() => trackJob(j)}>{t("monitor.track")}</Button>
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
