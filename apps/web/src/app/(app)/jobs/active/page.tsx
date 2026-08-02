"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { api } from "@/lib/client";
import { WATCH_SOURCES, JOB_CATEGORIES, JOB_ROLES } from "@careeros/shared";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ExternalLink } from "lucide-react";
import { useT } from "@/lib/i18n/provider";
import { extractFullJd } from "@/lib/jd";

type ActiveJob = {
  id: string;
  source: string;
  title: string;
  company?: string | null;
  location?: string | null;
  salary?: string | null;
  url: string;
  snippet?: string | null;
  raw?: unknown | null;
  publishedAt?: string | null;
  status: "new" | "viewed" | "imported" | "dismissed";
  jdId?: string | null;
  categories?: string[] | null;
  roles?: string[] | null;
  matchScore?: number | null;
  closedAt?: string | null;
  /**
   * 数据来源。external = DiscoveredJob（每用户私有的抓取/收录 feed）；
   * posted = JobPosting（全局公共的企业发布岗）。两条流语义不同、无法在 SQL 层 union，
   * 故在此客户端合流（详见 docs/b-end-plan.md §7）。
   */
  origin: "external" | "posted";
  orgType?: string | null;
};

/** 企业发布岗（/job-postings/feed 返回形状）。 */
type PostedJob = {
  id: string;
  orgType: string;
  company: string;
  title: string;
  location?: string | null;
  salary?: string | null;
  description: string;
  url?: string | null;
  categories?: string[] | null;
  createdAt: string;
};

/** 企业发布岗 → 列表行。posted 岗没有 matchScore / jdId / raw，对应能力在卡片上自然隐藏。 */
function postedToRow(p: PostedJob): ActiveJob {
  return {
    id: p.id,
    source: POSTED_SOURCE,
    origin: "posted",
    orgType: p.orgType,
    title: p.title,
    company: p.company,
    location: p.location,
    salary: p.salary,
    url: p.url ?? "",
    snippet: p.description,
    publishedAt: p.createdAt,
    status: "new",
    categories: p.categories ?? [],
    roles: [],
    closedAt: null,
  };
}

/** 来源筛选里代表「企业招聘」的取值，与任何抓取源 id 都不冲突。 */
const POSTED_SOURCE = "posted";

const SOURCE_LABEL = Object.fromEntries(WATCH_SOURCES.map((s) => [s.id, s.label]));

const ACTIVE_CATEGORY_KEY = "careeros.activeCategoryFilter";
const ACTIVE_ROLE_KEY = "careeros.activeRoleFilter";

// 职种按品类分组（与岗位监测一致）
const ROLE_GROUPS = ["game", "finance", "tech", "ai", "general"].map((cat) => ({
  category: cat,
  roles: JOB_ROLES.filter((r) => r.category === cat),
}));

export default function ActiveJobsPage() {
  const router = useRouter();
  const t = useT();
  const [jobs, setJobs] = useState<ActiveJob[] | null>(null);

  // 服务端过滤（走 query 参数）
  const [closed, setClosed] = useState("all"); // all | active | closed
  const [status, setStatus] = useState("all"); // all | new | imported | dismissed
  const [source, setSource] = useState("all");

  // 客户端二级筛选（品类 / 职种，与岗位监测一致，持久化到 localStorage）
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    let active = true;
    requestAnimationFrame(() => {
      if (!active) return;
      setMounted(true);
      const c = typeof window !== "undefined" ? localStorage.getItem(ACTIVE_CATEGORY_KEY) : null;
      if (c) setCategoryFilter(c);
      const r = typeof window !== "undefined" ? localStorage.getItem(ACTIVE_ROLE_KEY) : null;
      if (r) setRoleFilter(r);
    });
    return () => {
      active = false;
    };
  }, []);

  const changeCategory = (c: string) => {
    setCategoryFilter(c);
    setRoleFilter("all");
    if (typeof window !== "undefined") {
      localStorage.setItem(ACTIVE_CATEGORY_KEY, c);
      localStorage.setItem(ACTIVE_ROLE_KEY, "all");
    }
  };
  const changeRole = (r: string) => {
    setRoleFilter(r);
    if (typeof window !== "undefined") localStorage.setItem(ACTIVE_ROLE_KEY, r);
  };

  const load = useCallback(async () => {
    // 只筛「企业招聘」时不必再打抓取流的接口
    const wantExternal = source !== POSTED_SOURCE;
    // 企业发布岗恒为在招、且没有 DiscoveredJob 的 new/imported/dismissed 状态，
    // 因此只要用户选了「已停招」或任一处理状态，posted 一律不参与。
    const wantPosted =
      (source === "all" || source === POSTED_SOURCE) && closed !== "closed" && status === "all";

    const params = new URLSearchParams();
    if (closed !== "all") params.set("closed", closed);
    if (status !== "all") params.set("status", status);
    if (source !== "all" && source !== POSTED_SOURCE) params.set("source", source);
    const qs = params.toString();

    const [external, posted] = await Promise.all([
      wantExternal
        ? api<{ data: ActiveJob[] }>(`/discovered-jobs${qs ? `?${qs}` : ""}`)
        : Promise.resolve({ data: [] as ActiveJob[] }),
      wantPosted
        ? api<{ data: PostedJob[] }>("/job-postings/feed", { silent: true })
        : Promise.resolve({ data: [] as PostedJob[] }),
    ]);
    if (!external && !posted) return;

    const rows = [
      ...(external?.data ?? []).map((j) => ({ ...j, origin: "external" as const })),
      ...(posted?.data ?? []).map(postedToRow),
    ];
    // 归并：在招优先、其次抓取时间。posted 无 matchScore，不参与匹配分排序，
    // 靠时间与外部岗自然交错。
    rows.sort((a, b) => {
      const ac = a.closedAt ? 1 : 0;
      const bc = b.closedAt ? 1 : 0;
      if (ac !== bc) return ac - bc;
      return +new Date(b.publishedAt ?? 0) - +new Date(a.publishedAt ?? 0);
    });
    setJobs(rows);
  }, [closed, status, source]);

  useEffect(() => {
    void load();
  }, [load]);

  async function trackJob(job: ActiveJob) {
    const res = await api<{ deduped?: boolean }>(`/applications`, {
      method: "POST",
      body: JSON.stringify({ discoveredJobId: job.id }),
    });
    if (res) toast.success(res.deduped ? t("monitor.trackDeduped") : t("monitor.trackAdded"));
  }

  async function importJob(job: ActiveJob) {
    const res = await api<{ jdId: string }>(`/discovered-jobs/${job.id}/import`, { method: "POST" });
    if (res) {
      toast.success(t("monitor.importedToast"));
      router.push(`/jobs/${res.jdId}`);
    }
  }

  // 品类 / 职种：客户端二级筛选（与岗位监测一致）
  const visibleJobs = useMemo(() => {
    if (!jobs) return null;
    return jobs.filter(
      (j) =>
        (categoryFilter === "all" || (j.categories ?? []).includes(categoryFilter)) &&
        (roleFilter === "all" || (j.roles ?? []).includes(roleFilter)),
    );
  }, [jobs, categoryFilter, roleFilter]);

  const feedRoles =
    categoryFilter === "all"
      ? []
      : JOB_ROLES.filter((r) => r.category === categoryFilter || (categoryFilter !== "general" && r.category === "general"));

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div>
        <h1 className="text-xl font-semibold">{t("jobs.tab.active")}</h1>
        <p className="text-sm text-muted-foreground">{t("jobs.activeSubtitle")}</p>
      </div>

      {/* 筛选栏：与岗位监测一致 */}
      <div className="flex flex-wrap items-center gap-2">
        <Select value={closed} onValueChange={setClosed}>
          <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("jobs.filter.all")}</SelectItem>
            <SelectItem value="active">{t("jobs.filter.active")}</SelectItem>
            <SelectItem value="closed">{t("jobs.filter.closed")}</SelectItem>
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("monitor.filter.all")}</SelectItem>
            <SelectItem value="new">{t("monitor.filter.new")}</SelectItem>
            <SelectItem value="imported">{t("monitor.filter.imported")}</SelectItem>
            <SelectItem value="dismissed">{t("monitor.filter.dismissed")}</SelectItem>
          </SelectContent>
        </Select>
        <Select value={source} onValueChange={setSource}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("jobs.filter.allSource")}</SelectItem>
            <SelectItem value={POSTED_SOURCE}>{t("jobs.filter.posted")}</SelectItem>
            {WATCH_SOURCES.map((s) => (
              <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* 品类筛选（与岗位监测一致） */}
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

      {/* 职种二级筛选 */}
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

      <div className="space-y-2">
        <h2 className="text-sm font-medium text-muted-foreground">
          {t("jobs.tab.active")}
          {visibleJobs ? ` (${visibleJobs.length})` : ""}
        </h2>
        {!visibleJobs ? (
          <Skeleton className="h-24" />
        ) : visibleJobs.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">{t("jobs.activeEmpty")}</p>
        ) : (
          visibleJobs.map((j) => {
            const closedFlag = !!j.closedAt;
            return (
              <Card key={j.id} className={closedFlag ? "opacity-70" : ""}>
                <CardContent className="py-3">
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="group relative inline-block">
                          {j.url ? (
                            <a href={j.url} target="_blank" rel="noreferrer" className="text-sm font-medium hover:underline">
                              {j.title} <ExternalLink className="inline size-3 text-muted-foreground" />
                            </a>
                          ) : (
                            // 站内发布岗允许不填外链（后续接站内投递）
                            <span className="text-sm font-medium">{j.title}</span>
                          )}
                          {(() => {
                            const jd = extractFullJd(j.raw, j.snippet);
                            if (!jd) return null;
                            return (
                              <div className="pointer-events-none absolute left-0 top-full z-50 mt-1 hidden w-[min(520px,90vw)] max-h-[360px] overflow-auto rounded-lg border border-border bg-popover p-3 text-xs text-popover-foreground shadow-lg group-hover:block">
                                <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{t("jobs.fullJd")}</div>
                                <div className="whitespace-pre-wrap leading-relaxed">{jd}</div>
                              </div>
                            );
                          })()}
                        </span>
                        {typeof j.matchScore === "number" && (
                          <span
                            className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                              j.matchScore >= 60
                                ? "bg-emerald-500/15 text-emerald-600"
                                : j.matchScore >= 30
                                  ? "bg-amber-500/15 text-amber-600"
                                  : "bg-muted text-muted-foreground"
                            }`}
                          >
                            {t("monitor.matchBadge")} {Math.round(j.matchScore)}
                          </span>
                        )}
                        {j.origin === "posted" && (
                          <Badge className="px-1.5 py-0 text-[10px]">{t("jobs.postedBadge")}</Badge>
                        )}
                        {closedFlag && <Badge variant="destructive" className="px-1.5 py-0 text-[10px]">{t("jobs.closed")}</Badge>}
                        {j.categories?.map((c) => (
                          <Badge key={c} variant="secondary" className="px-1.5 py-0 text-[10px]">{t(`category.${c}`)}</Badge>
                        ))}
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {[j.company, j.location, j.salary].filter(Boolean).join(" · ")}
                        {` · ${
                          j.origin === "posted"
                            ? t(`orgType.${j.orgType}`)
                            : (SOURCE_LABEL[j.source] ?? j.source)
                        }`}
                        {j.publishedAt && ` · ${t("jobs.publishedAt")} ${new Date(j.publishedAt).toLocaleDateString("zh-CN")}`}
                        {closedFlag && j.closedAt && ` · ${t("jobs.closedAt")} ${new Date(j.closedAt).toLocaleDateString("zh-CN")}`}
                      </p>
                      {j.snippet && <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{j.snippet}</p>}
                    </div>
                    {/* 跟踪/导入为 JD 都以 DiscoveredJob 为主键，posted 岗暂不支持；
                        它只提供外链申请（站内投递留待后续）。 */}
                    <div className="flex shrink-0 gap-1.5">
                      {j.origin === "posted" ? (
                        j.url && (
                          <Button size="sm" variant="outline" asChild>
                            <a href={j.url} target="_blank" rel="noreferrer">{t("jobs.applyExternal")}</a>
                          </Button>
                        )
                      ) : (
                        <>
                          <Button size="sm" variant="outline" onClick={() => trackJob(j)}>{t("monitor.track")}</Button>
                          {j.jdId ? (
                            <Button size="sm" variant="outline" onClick={() => router.push(`/jobs/${j.jdId}`)}>{t("monitor.seeMatch")}</Button>
                          ) : (
                            <Button size="sm" onClick={() => importJob(j)}>{t("monitor.importAsJd")}</Button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
