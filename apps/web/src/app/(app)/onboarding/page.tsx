"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ComponentType } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { api } from "@/lib/client";
import { useT } from "@/lib/i18n/provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Upload,
  Database,
  Radar,
  Loader2,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  FileText,
} from "lucide-react";
import {
  WATCH_SOURCES,
  JOB_ROLES,
  REGIONS,
} from "@careeros/shared";

type ImportStatus =
  | "pending"
  | "parsing"
  | "extracting"
  | "review"
  | "applied"
  | "failed";

type ImportRow = {
  id: string;
  fileName: string;
  status: ImportStatus;
  error?: string | null;
};

const SOURCE_REGION_ORDER = ["china", "japan", "usa", "uk", "other"] as const;
type SourceRegion = (typeof SOURCE_REGION_ORDER)[number];

const ROLE_CATEGORY_ORDER = ["game", "tech", "finance", "ai", "general"] as const;

const STEPS = ["upload", "kb", "monitor", "done"] as const;
type StepKey = (typeof STEPS)[number];

export default function OnboardingPage() {
  const router = useRouter();
  const t = useT();

  const [stepIndex, setStepIndex] = useState(0); // 0 = welcome, 1..4 = STEPS
  const [importId, setImportId] = useState<string | null>(null);
  const [kbStatus, setKbStatus] = useState<ImportStatus | null>(null);

  // 步骤 1：上传
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  // 步骤 3：监测表单
  const [watchName, setWatchName] = useState("");
  const [keywords, setKeywords] = useState<string[]>([]);
  const [keywordDraft, setKeywordDraft] = useState("");
  const [sources, setSources] = useState<Set<string>>(new Set());
  const [roles, setRoles] = useState<Set<string>>(new Set());
  const [regions, setRegions] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [createdWatch, setCreatedWatch] = useState<{ sources: number; keywords: number } | null>(null);

  const isWelcome = stepIndex === 0;
  const mainStep = STEPS[Math.min(stepIndex - 1, STEPS.length - 1)] as StepKey | undefined;

  // 步骤 2：轮询导入状态
  useEffect(() => {
    if (stepIndex !== 2 || !importId) return;
    let active = true;
    const load = async () => {
      const res = await api<{ data: ImportRow[] }>("/imports");
      if (!active || !res) return;
      const row = res.data.find((i) => i.id === importId);
      if (row) setKbStatus(row.status);
    };
    void load();
    const timer = setInterval(load, 3000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [stepIndex, importId]);

  const kbDone = kbStatus === "review" || kbStatus === "applied";

  async function upload(file: File) {
    setUploading(true);
    const form = new FormData();
    form.append("file", file);
    const res = await fetch("/api/v1/imports/resume", { method: "POST", body: form });
    setUploading(false);
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      toast.error(body?.error?.message ?? t("onboarding.upload.failed"));
      return;
    }
    const { importId: id } = await res.json();
    setImportId(id);
    toast.success(t("imports.parsingStarted"));
    setStepIndex(2);
  }

  // 关键词输入
  function addKeyword() {
    const v = keywordDraft.trim();
    if (!v) return;
    if (keywords.length >= 5) {
      toast.error(t("onboarding.monitor.keywordsMax"));
      return;
    }
    if (!keywords.includes(v)) setKeywords((k) => [...k, v]);
    setKeywordDraft("");
  }
  function removeKeyword(v: string) {
    setKeywords((k) => k.filter((x) => x !== v));
  }

  function toggle(set: Set<string>, value: string): Set<string> {
    const next = new Set(set);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    return next;
  }

  async function createWatch() {
    if (keywords.length === 0) {
      toast.error(t("onboarding.monitor.keywordsRequired"));
      return;
    }
    if (sources.size === 0) {
      toast.error(t("onboarding.monitor.sourcesRequired"));
      return;
    }
    const name = watchName.trim() || keywords.join(" / ") + t("onboarding.monitor.defaultSuffix");
    setSubmitting(true);
    const res = await api<{ id: string }>("/watches", {
      method: "POST",
      body: JSON.stringify({
        name,
        keywords,
        sources: [...sources],
        matchRoles: [...roles],
        matchRegions: [...regions],
        enabled: true,
        intervalMinutes: 60,
      }),
    });
    setSubmitting(false);
    if (res) {
      setCreatedWatch({ sources: sources.size, keywords: keywords.length });
      toast.success(t("monitor.created"));
      setStepIndex(4);
    }
  }

  const sourcesByRegion = useMemo(() => {
    const map: Record<SourceRegion, (typeof WATCH_SOURCES)[number][]> = {
      china: [],
      japan: [],
      usa: [],
      uk: [],
      other: [],
    };
    for (const s of WATCH_SOURCES) {
      if (s.region in map) map[s.region as SourceRegion].push(s);
    }
    return map;
  }, []);

  const rolesByCategory = useMemo(() => {
    const map: Record<string, (typeof JOB_ROLES)[number][]> = {};
    for (const r of JOB_ROLES) {
      (map[r.category] ??= []).push(r);
    }
    return map;
  }, []);

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-10">
      {/* 顶部进度 */}
      {!isWelcome && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {t("onboarding.stepLabel", { n: stepIndex, total: STEPS.length })}
            </span>
            <button
              className="underline hover:text-foreground"
              onClick={() => router.push("/dashboard")}
            >
              {t("onboarding.skip")}
            </button>
          </div>
          <div className="flex gap-1.5">
            {STEPS.map((s, i) => (
              <div
                key={s}
                className={`h-1.5 flex-1 rounded-full transition-colors ${
                  i < stepIndex - 1
                    ? "bg-primary"
                    : i === stepIndex - 1
                      ? "bg-primary/60"
                      : "bg-muted"
                }`}
              />
            ))}
          </div>
        </div>
      )}

      {/* 0. 欢迎 */}
      {isWelcome && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <Sparkles className="size-5 text-primary" />
              {t("onboarding.title")}
            </CardTitle>
            <CardDescription>{t("onboarding.subtitle")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">{t("onboarding.intro")}</p>
            <ol className="space-y-2">
              <OnboardStepIcon icon={Upload} title={t("onboarding.steps.1.title")} desc={t("onboarding.steps.1.desc")} />
              <OnboardStepIcon icon={Database} title={t("onboarding.steps.2.title")} desc={t("onboarding.steps.2.desc")} />
              <OnboardStepIcon icon={Radar} title={t("onboarding.steps.3.title")} desc={t("onboarding.steps.3.desc")} />
            </ol>
            <Button className="w-full" size="lg" onClick={() => setStepIndex(1)}>
              {t("onboarding.start")}
              <ArrowRight className="size-4" />
            </Button>
          </CardContent>
        </Card>
      )}

      {/* 1. 上传简历 */}
      {mainStep === "upload" && (
        <Card>
          <CardHeader>
            <CardTitle>{t("onboarding.upload.title")}</CardTitle>
            <CardDescription>{t("onboarding.steps.1.desc")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div
              className={`flex flex-col items-center gap-3 rounded-lg border-2 border-dashed py-10 transition-colors ${
                dragOver ? "border-primary bg-accent/40" : ""
              }`}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                const f = e.dataTransfer.files[0];
                if (f) void upload(f);
              }}
            >
              <FileText className="size-8 text-muted-foreground" />
              <p className="px-6 text-center text-sm text-muted-foreground">
                {t("onboarding.upload.hint")}
              </p>
              <Button onClick={() => fileInput.current?.click()} disabled={uploading}>
                {uploading ? (
                  <>
                    <Loader2 className="size-4 animate-spin" /> {t("onboarding.upload.uploading")}
                  </>
                ) : (
                  t("onboarding.upload.choose")
                )}
              </Button>
              <input
                ref={fileInput}
                type="file"
                accept=".pdf,.docx,.doc,.md,.txt"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void upload(f);
                  e.target.value = "";
                }}
              />
            </div>
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <span>{t("onboarding.upload.noResume")}</span>
              <button
                className="font-medium text-primary underline"
                onClick={() => router.push("/profile")}
              >
                {t("onboarding.upload.manual")}
              </button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 2. 生成知识库 */}
      {mainStep === "kb" && (
        <Card>
          <CardHeader>
            <CardTitle>{t("onboarding.kb.title")}</CardTitle>
            <CardDescription>{t("onboarding.kb.desc")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {kbStatus === null && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" /> {t("onboarding.kb.waiting")}
              </div>
            )}
            {kbStatus && !kbDone && kbStatus !== "failed" && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm">
                  <Loader2 className="size-4 animate-spin text-primary" />
                  <span>{t(`onboarding.kb.stage.${kbStatus}`)}</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div className="h-full w-2/3 animate-pulse rounded-full bg-primary/70" />
                </div>
              </div>
            )}
            {kbStatus === "failed" && (
              <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {t("onboarding.kb.failed")}
              </div>
            )}
            {kbDone && (
              <div className="space-y-2 rounded-md bg-emerald-500/10 px-3 py-3">
                <div className="flex items-center gap-2 font-medium text-emerald-700">
                  <CheckCircle2 className="size-5" /> {t("onboarding.kb.done")}
                </div>
                <p className="text-sm text-muted-foreground">{t("onboarding.kb.doneDesc")}</p>
                {importId && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => router.push(`/imports/${importId}/review`)}
                  >
                    {t("onboarding.kb.review")}
                  </Button>
                )}
              </div>
            )}
            <div className="flex flex-col gap-2 pt-2 sm:flex-row">
              <Button className="flex-1" onClick={() => setStepIndex(3)} disabled={!kbDone}>
                {t("onboarding.next")}
                <ArrowRight className="size-4" />
              </Button>
              <Button
                variant="ghost"
                className="flex-1"
                onClick={() => setStepIndex(3)}
                disabled={kbDone}
              >
                {t("onboarding.kb.skip")}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 3. 设置岗位监测 */}
      {mainStep === "monitor" && (
        <Card>
          <CardHeader>
            <CardTitle>{t("onboarding.monitor.title")}</CardTitle>
            <CardDescription>{t("onboarding.monitor.desc")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">{t("onboarding.monitor.name")}</label>
              <Input
                value={watchName}
                onChange={(e) => setWatchName(e.target.value)}
                placeholder={t("onboarding.monitor.namePlaceholder")}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">{t("onboarding.monitor.keywords")}</label>
              <div className="flex flex-wrap gap-1.5">
                {keywords.map((k) => (
                  <button
                    key={k}
                    onClick={() => removeKeyword(k)}
                    className="rounded-full bg-primary/10 px-2.5 py-1 text-xs text-primary hover:bg-primary/20"
                  >
                    {k} ✕
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  value={keywordDraft}
                  onChange={(e) => setKeywordDraft(e.target.value)}
                  placeholder={t("onboarding.monitor.keywordsPlaceholder")}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addKeyword();
                    }
                  }}
                />
                <Button variant="outline" onClick={addKeyword} type="button">
                  {t("common.add")}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">{t("onboarding.monitor.keywordsHint")}</p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">{t("onboarding.monitor.sources")}</label>
              <div className="space-y-3">
                {SOURCE_REGION_ORDER.map((region) => {
                  const list = sourcesByRegion[region];
                  if (list.length === 0) return null;
                  return (
                    <div key={region}>
                      <p className="mb-1.5 text-xs text-muted-foreground">
                        {t(`onboarding.srcRegion.${region}`)}
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {list.map((s) => {
                          const active = sources.has(s.id);
                          return (
                            <button
                              key={s.id}
                              onClick={() => setSources((prev) => toggle(prev, s.id))}
                              className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
                                active
                                  ? "border-primary bg-primary/10 text-primary"
                                  : "border-muted-foreground/20 text-muted-foreground hover:border-foreground/40"
                              }`}
                            >
                              {s.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">{t("onboarding.monitor.roles")}</label>
              <div className="space-y-3">
                {ROLE_CATEGORY_ORDER.map((cat) => {
                  const list = rolesByCategory[cat];
                  if (!list || list.length === 0) return null;
                  return (
                    <div key={cat}>
                      <p className="mb-1.5 text-xs text-muted-foreground">{t(`category.${cat}`)}</p>
                      <div className="flex flex-wrap gap-1.5">
                        {list.map((r) => {
                          const active = roles.has(r.id);
                          return (
                            <button
                              key={r.id}
                              onClick={() => setRoles((prev) => toggle(prev, r.id))}
                              className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
                                active
                                  ? "border-primary bg-primary/10 text-primary"
                                  : "border-muted-foreground/20 text-muted-foreground hover:border-foreground/40"
                              }`}
                            >
                              {t(`role.${r.id}`)}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">{t("onboarding.monitor.regions")}</label>
              <div className="flex flex-wrap gap-1.5">
                {REGIONS.map((r) => {
                  const active = regions.has(r.id);
                  return (
                    <button
                      key={r.id}
                      onClick={() => setRegions((prev) => toggle(prev, r.id))}
                      className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
                        active
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-muted-foreground/20 text-muted-foreground hover:border-foreground/40"
                      }`}
                    >
                      {t(`region.${r.id}`)}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={() => setStepIndex(2)} disabled={submitting}>
                <ArrowLeft className="size-4" /> {t("common.back")}
              </Button>
              <Button className="flex-1" onClick={createWatch} disabled={submitting}>
                {submitting ? (
                  <>
                    <Loader2 className="size-4 animate-spin" /> {t("onboarding.monitor.creating")}
                  </>
                ) : (
                  t("onboarding.monitor.create")
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 4. 完成 */}
      {mainStep === "done" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="size-6 text-emerald-600" />
              {t("onboarding.done.title")}
            </CardTitle>
            <CardDescription>{t("onboarding.done.desc")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-md border bg-accent/30 p-3 text-center">
                <p className="text-xs text-muted-foreground">{t("onboarding.done.summaryKb")}</p>
                <p className="mt-1 text-sm font-medium">
                  {kbDone ? t("onboarding.done.ok") : t("onboarding.done.later")}
                </p>
              </div>
              <div className="rounded-md border bg-accent/30 p-3 text-center">
                <p className="text-xs text-muted-foreground">{t("onboarding.done.summaryMonitor")}</p>
                <p className="mt-1 text-sm font-medium">
                  {createdWatch
                    ? t("onboarding.done.monitorOk", {
                        sources: createdWatch.sources,
                        keywords: createdWatch.keywords,
                      })
                    : t("onboarding.done.later")}
                </p>
              </div>
            </div>
            <div className="grid gap-2">
              <Button onClick={() => router.push("/monitor")}>
                {t("onboarding.done.goMonitor")}
                <ArrowRight className="size-4" />
              </Button>
              <Button variant="outline" onClick={() => router.push("/knowledge")}>
                {t("onboarding.done.goKnowledge")}
              </Button>
              <Button variant="ghost" onClick={() => router.push("/dashboard")}>
                {t("onboarding.done.goDashboard")}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function OnboardStepIcon({
  icon: Icon,
  title,
  desc,
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  desc: string;
}) {
  return (
    <li className="flex items-start gap-3 rounded-md border bg-accent/20 p-3">
      <Icon className="mt-0.5 size-5 shrink-0 text-primary" />
      <div>
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-muted-foreground">{desc}</p>
      </div>
    </li>
  );
}
