"use client";

import { use, useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { api } from "@/lib/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2, CircleAlert, CircleCheck, X } from "lucide-react";
import { useT } from "@/lib/i18n/provider";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  toNewItems, mergeItems, buildApplySections,
  type DatePrecision, type DupHit, type MergeItem, type SectionKind, type MergeChoice,
} from "@careeros/shared";

// ===== 抽取结果的本地编辑模型 =====
type Confidence = "high" | "mid" | "low";
type ExpDraft = {
  include: boolean; duplicate?: string; confidence: Confidence;
  company: string; title: string;
  startDate: string; startDatePrecision: DatePrecision | null;
  endDate: string; endDatePrecision: DatePrecision | null; endDatePresent: boolean;
  location: string; description: string; highlights: string;
};
type ProjDraft = {
  include: boolean; confidence: Confidence;
  name: string; role: string; belongsToCompany: string;
  startDate: string; startDatePrecision: DatePrecision | null;
  endDate: string; endDatePrecision: DatePrecision | null; endDatePresent: boolean;
  description: string; outcome: string; techStack: string;
};
type SkillDraft = { include: boolean; duplicate?: string; name: string; category: string | null; evidenceHint: string | null };
type AchDraft = { include: boolean; title: string; metricValue: string; metricUnit: string; metricText: string };
type EduDraft = {
  include: boolean; school: string; degree: string; major: string;
  startDate: string; startDatePrecision: DatePrecision | null;
  endDate: string; endDatePrecision: DatePrecision | null; endDatePresent: boolean;
};
type HonDraft = {
  include: boolean; title: string; issuer: string;
  startDate: string; startDatePrecision: DatePrecision | null;
  endDate: string; endDatePrecision: DatePrecision | null; endDatePresent: boolean;
};

const ALL_KINDS: SectionKind[] = ["work", "project", "achievement", "education", "honor"];

type Status = "pending" | "parsing" | "extracting" | "review" | "applied" | "failed" | "loading";

const CONFIDENCE_META: Record<Confidence, { className: string }> = {
  high: { className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" },
  mid: { className: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300" },
  low: { className: "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300" },
};

const PIPELINE_STEPS: { key: Status }[] = [
  { key: "pending" },
  { key: "parsing" },
  { key: "extracting" },
  { key: "review" },
];

export default function ImportReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const t = useT();
  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState<string | null>(null);
  const [rawText, setRawText] = useState("");
  const [fileName, setFileName] = useState("");
  const [applying, setApplying] = useState(false);

  const [exps, setExps] = useState<ExpDraft[]>([]);
  const [projs, setProjs] = useState<ProjDraft[]>([]);
  const [skills, setSkills] = useState<SkillDraft[]>([]);
  const [achs, setAchs] = useState<AchDraft[]>([]);
  const [edus, setEdus] = useState<EduDraft[]>([]);
  const [hons, setHons] = useState<HonDraft[]>([]);

  // 查重合并：AI 判定的疑似重复命中（全部 section）+ 玩家对每条命中的处理选择
  const [dupHits, setDupHits] = useState<DupHit[]>([]);
  const [choices, setChoices] = useState<Record<string, MergeChoice>>({});

  // 抽取结果只应加载一次：review 为终态，数据不会再变。
  const loadedRef = useRef(false);
  const loadExtracted = useCallback(async () => {
    if (loadedRef.current) return;
    loadedRef.current = true;
    const res = await api<{
      fileName: string;
      rawText: string;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      extracted: any;
    }>(`/imports/${id}/extracted`, { silent: true });
    if (!res) { loadedRef.current = false; return; }
    const { result, duplicates } = res.extracted;
    setFileName(res.fileName);
    setRawText(res.rawText ?? "");

    // 合并全部 section 的 AI 命中（仅 same=true）
    const hits: DupHit[] = [];
    for (const kind of ALL_KINDS) {
      for (const d of (duplicates?.[kind] ?? [])) if (d.same === true) hits.push(d);
    }
    const dupSkill = new Map<number, string>(duplicates.skills.map((d: { index: number; existingLabel: string }) => [d.index, d.existingLabel]));

    setDupHits(hits);
    setChoices({});

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setExps(result.experiences.map((e: any, i: number): ExpDraft => ({
      include: e.confidence !== "low" && !hits.some((h) => h.section === "work" && h.index === i),
      confidence: e.confidence,
      company: e.company ?? "", title: e.title ?? "",
      startDate: e.startDate ?? "", startDatePrecision: e.startDatePrecision ?? "day",
      endDate: e.endDate ?? "", endDatePrecision: e.endDatePrecision ?? "day",
      endDatePresent: !e.endDate,
      location: e.location ?? "", description: e.description ?? "",
      highlights: (e.highlights ?? []).join("\n"),
    })));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setProjs(result.projects.map((p: any, i: number): ProjDraft => ({
      include: p.confidence !== "low" && !hits.some((h) => h.section === "project" && h.index === i),
      confidence: p.confidence,
      name: p.name ?? "", role: p.role ?? "", belongsToCompany: p.belongsToCompany ?? "",
      startDate: p.startDate ?? "", startDatePrecision: p.startDatePrecision ?? "day",
      endDate: p.endDate ?? "", endDatePrecision: p.endDatePrecision ?? "day",
      endDatePresent: !p.endDate,
      description: p.description ?? "", outcome: p.outcome ?? "",
      techStack: (p.techStack ?? []).join(", "),
    })));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setSkills(result.skills.map((s: any, i: number): SkillDraft => ({
      include: !dupSkill.has(i),
      duplicate: dupSkill.get(i),
      name: s.name, category: s.category ?? null, evidenceHint: s.evidenceHint ?? null,
    })));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setAchs(result.achievements.map((a: any, i: number): AchDraft => ({
      include: !hits.some((h) => h.section === "achievement" && h.index === i),
      title: a.title ?? "",
      metricValue: a.metricValue != null ? String(a.metricValue) : "",
      metricUnit: a.metricUnit ?? "", metricText: a.metricText ?? "",
    })));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setEdus(result.educations.map((e: any, i: number): EduDraft => ({
      include: !hits.some((h) => h.section === "education" && h.index === i),
      school: e.school ?? "", degree: e.degree ?? "", major: e.major ?? "",
      startDate: e.startDate ?? "", startDatePrecision: e.startDatePrecision ?? "day",
      endDate: e.endDate ?? "", endDatePrecision: e.endDatePrecision ?? "day",
      endDatePresent: !e.endDate,
    })));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setHons((result.honors ?? []).map((h: any, i: number): HonDraft => ({
      include: !hits.some((hh) => hh.section === "honor" && hh.index === i),
      title: h.title ?? "", issuer: h.issuer ?? "",
      startDate: h.date ?? "", startDatePrecision: "day" as DatePrecision,
      endDate: h.date ?? "", endDatePrecision: "day" as DatePrecision,
      endDatePresent: !h.date,
    })));
  }, [id]);

  // 状态机：SSE 订阅进度，review 后拉抽取结果；SSE 断线时降级为轮询兜底
  useEffect(() => {
    let closed = false;
    let pollTimer: ReturnType<typeof setInterval> | null = null;

    const applyUpdate = (data: { status: Status; error?: string | null }) => {
      if (closed) return;
      setStatus(data.status);
      setError(data.error ?? null);
      if (data.status === "review") void loadExtracted();
    };

    const poll = () => {
      void api<{ status: Status; error?: string | null }>(`/imports/${id}`, { silent: true }).then((res) => {
        if (res) applyUpdate(res);
      });
    };
    poll();

    const es = new EventSource(`/api/v1/imports/${id}/events`);
    es.onmessage = (ev) => applyUpdate(JSON.parse(ev.data) as { status: Status; error?: string | null });
    es.onerror = () => {
      es.close();
      if (!closed && !pollTimer) pollTimer = setInterval(poll, 3000);
    };
    return () => {
      closed = true;
      es.close();
      if (pollTimer) clearInterval(pollTimer);
    };
  }, [id, loadExtracted]);

  async function retryImport() {
    loadedRef.current = false;
    const res = await api(`/imports/${id}/retry`, { method: "POST" });
    if (res) {
      toast.success(t("imports.parsingStarted"));
      setError(null);
      setStatus("pending");
    }
  }

  async function discard() {
    const res = await api(`/imports/${id}`, { method: "DELETE" });
    if (res) {
      toast.success(t("common.deleted"));
      router.push("/imports");
    }
  }

  // 把某类分栏的编辑草稿转换为「合并框架」所需的原始字段袋（供 toNewItems）
  function draftsToRaws(kind: SectionKind): Record<string, unknown>[] {
    switch (kind) {
      case "work":
        return exps.map((e) => ({
          company: e.company, title: e.title,
          startDate: e.startDate || null, endDate: e.endDatePresent ? null : (e.endDate || null),
          location: e.location || null, description: e.description || null,
          highlights: e.highlights.split("\n").map((s) => s.trim()).filter(Boolean),
        }));
      case "project":
        return projs.map((p) => ({
          name: p.name, role: p.role || null, belongsToCompany: p.belongsToCompany || null,
          startDate: p.startDate || null, endDate: p.endDatePresent ? null : (p.endDate || null),
          description: p.description || null, outcome: p.outcome || null,
          techStack: p.techStack.split(/[,，]/).map((s) => s.trim()).filter(Boolean), links: [],
        }));
      case "achievement":
        return achs.map((a) => ({
          title: a.title,
          metricValue: a.metricValue ? Number(a.metricValue) : null,
          metricUnit: a.metricUnit || null, metricText: a.metricText || null,
          evidence: null, occurredAt: null,
        }));
      case "education":
        return edus.map((e) => ({
          school: e.school, degree: e.degree || null, major: e.major || null, faculty: null,
          startDate: e.startDate || null, endDate: e.endDatePresent ? null : (e.endDate || null),
          gpa: null, description: null,
        }));
      case "honor":
        return hons.map((h) => ({
          title: h.title, issuer: h.issuer || null,
          date: h.endDatePresent ? null : (h.endDate || null), description: null,
        }));
    }
  }

  function includesFor(kind: SectionKind): boolean[] {
    switch (kind) {
      case "work": return exps.map((e) => e.include);
      case "project": return projs.map((p) => p.include);
      case "achievement": return achs.map((a) => a.include);
      case "education": return edus.map((e) => e.include);
      case "honor": return hons.map((h) => h.include);
    }
  }

  async function apply() {
    // 为每类分栏构建 MergeItem，并用纯函数归约查重命中 + 玩家选择 → 最终写操作
    const sections = ALL_KINDS.map((kind) => {
      const raws = draftsToRaws(kind);
      const items = toNewItems(kind, raws);
      const hits = dupHits.filter((h) => h.section === kind);
      return { kind, items, hits, choices, include: includesFor(kind) };
    });
    const applied = buildApplySections(sections);

    const opsToPosted = (kind: SectionKind) =>
      applied[kind].ops
        .filter((op) => op.type !== "drop")
        .map((op) => {
          const posted: Record<string, unknown> = { ...(op.item.raw as Record<string, unknown>) };
          if (op.type === "update") posted.mergeIntoId = op.id;
          if (op.type === "create" && op.forceCreate) posted.forceCreate = true;
          return posted;
        });

    const postedWork = opsToPosted("work");
    const invalid = postedWork.find((e) => !e.company || !e.title || !e.startDate);
    if (invalid) {
      toast.error(t("review.invalidExp", { name: (invalid.company as string) || t("review.unnamed") }));
      return;
    }
    const postedEdu = opsToPosted("education");
    if (postedEdu.find((e) => !e.school)) {
      toast.error(t("review.invalidEdu", { name: t("review.unnamed") }));
      return;
    }
    const postedHon = opsToPosted("honor");
    if (postedHon.find((h) => !h.title)) {
      toast.error(t("review.invalidHon", { name: t("review.unnamed") }));
      return;
    }

    setApplying(true);
    const body = JSON.stringify({
      experiences: postedWork,
      projects: opsToPosted("project"),
      achievements: opsToPosted("achievement"),
      educations: postedEdu,
      honors: postedHon,
      skills: skills.filter((s) => s.include && s.name).map((s) => ({
        name: s.name, category: s.category ?? undefined,
      })),
    });
    const res = await api<{ applied: Record<string, number> }>(`/imports/${id}/apply`, { method: "POST", body });
    setApplying(false);
    if (res) {
      const a = res.applied;
      toast.success(t("review.appliedToast", { experiences: a.experiences, projects: a.projects, skills: a.skills }));
      router.push("/knowledge");
    }
  }

  // ===== 进行中 / 失败态 =====
  if (status !== "review" && status !== "applied") {
    const stepIndex = PIPELINE_STEPS.findIndex((s) => s.key === status);
    return (
      <div className="flex min-h-[70vh] items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="space-y-5 py-8">
            {status === "loading" && <Skeleton className="h-20" />}
            {status === "failed" ? (
              <div className="space-y-3 text-center">
                <CircleAlert className="mx-auto size-8 text-destructive" />
                <p className="font-medium">{t("review.failedTitle")}</p>
                <p className="text-sm text-muted-foreground">{error ?? t("common.unknownError")}</p>
                <div className="flex justify-center gap-2">
                  <Button onClick={() => void retryImport()}>{t("imports.retry")}</Button>
                  <Button variant="outline" onClick={() => router.push("/imports")}>{t("review.failedBack")}</Button>
                </div>
              </div>
            ) : status !== "loading" && (
              <div className="space-y-4">
                <div className="flex items-center justify-center gap-2">
                  <Loader2 className="size-4 animate-spin" />
                  <p className="text-sm font-medium">{t("review.processing")}</p>
                </div>
                <div className="flex items-center justify-between px-2">
                  {PIPELINE_STEPS.map((step, i) => (
                    <div key={step.key} className="flex flex-col items-center gap-1">
                      {i < stepIndex ? (
                        <CircleCheck className="size-5 text-emerald-600" />
                      ) : i === stepIndex ? (
                        <Loader2 className="size-5 animate-spin text-primary" />
                      ) : (
                        <div className="size-5 rounded-full border-2 border-muted" />
                      )}
                      <span className={`text-xs ${i <= stepIndex ? "" : "text-muted-foreground"}`}>{t(`review.step.${step.key}`)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (status === "applied") {
    return (
      <div className="flex min-h-[70vh] items-center justify-center">
        <Card className="max-w-md text-center">
          <CardContent className="space-y-3 py-8">
            <CircleCheck className="mx-auto size-8 text-emerald-600" />
            <p className="font-medium">{t("review.alreadyApplied")}</p>
            <Button variant="outline" onClick={() => router.push("/knowledge")}>{t("review.viewKnowledge")}</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ===== 确认界面：SplitView =====
  const includedCount =
    exps.filter((e) => e.include).length + projs.filter((p) => p.include).length +
    skills.filter((s) => s.include).length + achs.filter((a) => a.include).length +
    edus.filter((e) => e.include).length + hons.filter((h) => h.include).length;

  // 被查重命中（疑似重复）的分栏下标（按 section 归类）：其 fate 由合并面板决定，单独 include 开关不再生效
  const involvedBySection: Record<SectionKind, Set<number>> = {
    work: new Set(), project: new Set(), achievement: new Set(), education: new Set(), honor: new Set(),
  };
  dupHits.forEach((h) => {
    involvedBySection[h.section].add(h.index);
    if (typeof h.otherIndex === "number") involvedBySection[h.section].add(h.otherIndex);
  });

  return (
    <div className="flex h-[calc(100vh-3rem)] flex-col gap-3">
      <div>
        <h1 className="text-xl font-semibold">{t("review.title")}</h1>
        <p className="text-sm text-muted-foreground">
          {t("review.subtitle", { fileName })}
        </p>
      </div>

      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-2">
        <Card className="min-h-0 overflow-hidden py-0">
          <CardContent className="h-full overflow-y-auto px-4 py-4">
            <pre className="whitespace-pre-wrap font-mono text-xs leading-relaxed text-muted-foreground">{rawText}</pre>
          </CardContent>
        </Card>

        <div className="min-h-0 space-y-4 overflow-y-auto pr-1">
          <DupMergeSection
            hits={dupHits}
            itemsBySection={{
              work: toNewItems("work", draftsToRaws("work")),
              project: toNewItems("project", draftsToRaws("project")),
              achievement: toNewItems("achievement", draftsToRaws("achievement")),
              education: toNewItems("education", draftsToRaws("education")),
              honor: toNewItems("honor", draftsToRaws("honor")),
            }}
            choices={choices}
            onChoice={(id, c) => setChoices((prev) => ({ ...prev, [id]: c }))}
          />
          <Section title={t("review.sectionExperiences", { count: exps.length })}>
            {exps.map((e, i) => (
              <DraftCard key={i} include={e.include} onInclude={(v) => setExps(upd(exps, i, { include: v }))}
                includeDisabled={involvedBySection.work.has(i)} badge={<ConfBadge c={e.confidence} />}>
                <div className="grid grid-cols-2 gap-2">
                  <Input value={e.company} placeholder={t("review.ph.company")} onChange={(ev) => setExps(upd(exps, i, { company: ev.target.value }))} />
                  <Input value={e.title} placeholder={t("review.ph.title")} onChange={(ev) => setExps(upd(exps, i, { title: ev.target.value }))} />
                  <DateField
                    value={e.startDate} precision={e.startDatePrecision}
                    onChange={(date, precision) => setExps(upd(exps, i, { startDate: date, startDatePrecision: precision }))}
                    placeholder={t("review.ph.startDate")}
                  />
                  <DateField
                    value={e.endDate} precision={e.endDatePrecision}
                    onChange={(date, precision) => setExps(upd(exps, i, { endDate: date, endDatePrecision: precision }))}
                    present={e.endDatePresent}
                    onPresentChange={(present) => setExps(upd(exps, i, { endDatePresent: present }))}
                    placeholder={t("review.ph.endDate")}
                  />
                </div>
                <Textarea rows={2} value={e.highlights} placeholder={t("review.ph.highlights")}
                  onChange={(ev) => setExps(upd(exps, i, { highlights: ev.target.value }))} />
              </DraftCard>
            ))}
          </Section>

          <Section title={t("review.sectionProjects", { count: projs.length })}>
            {projs.map((p, i) => (
              <DraftCard key={i} include={p.include} onInclude={(v) => setProjs(upd(projs, i, { include: v }))}
                includeDisabled={involvedBySection.project.has(i)} badge={<ConfBadge c={p.confidence} />}>
                <div className="grid grid-cols-2 gap-2">
                  <Input value={p.name} placeholder={t("review.ph.projectName")} onChange={(ev) => setProjs(upd(projs, i, { name: ev.target.value }))} />
                  <Input value={p.role} placeholder={t("review.ph.role")} onChange={(ev) => setProjs(upd(projs, i, { role: ev.target.value }))} />
                  <Input value={p.belongsToCompany} placeholder={t("review.ph.belongsToCompany")} className="col-span-2"
                    onChange={(ev) => setProjs(upd(projs, i, { belongsToCompany: ev.target.value }))} />
                  <DateField
                    value={p.startDate} precision={p.startDatePrecision}
                    onChange={(date, precision) => setProjs(upd(projs, i, { startDate: date, startDatePrecision: precision }))}
                    placeholder={t("review.ph.startDate")}
                  />
                  <DateField
                    value={p.endDate} precision={p.endDatePrecision}
                    onChange={(date, precision) => setProjs(upd(projs, i, { endDate: date, endDatePrecision: precision }))}
                    present={p.endDatePresent}
                    onPresentChange={(present) => setProjs(upd(projs, i, { endDatePresent: present }))}
                    placeholder={t("review.ph.endDate")}
                  />
                </div>
              </DraftCard>
            ))}
          </Section>

          <Section title={t("review.sectionSkills", { count: skills.length })}>
            <div className="flex flex-wrap gap-2">
              {skills.map((s, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setSkills(upd(skills, i, { include: !s.include }))}
                  title={s.duplicate ? t("review.duplicateExists", { name: s.duplicate }) : s.evidenceHint ?? undefined}
                >
                  <Badge variant={s.include ? "default" : "outline"}
                    className={s.include ? "" : "line-through opacity-50"}>
                    {s.name}
                    {s.duplicate && " ⊙"}
                  </Badge>
                </button>
              ))}
              {skills.length === 0 && <p className="text-sm text-muted-foreground">{t("review.skillsEmpty")}</p>}
            </div>
            {skills.some((s) => s.duplicate) && (
              <p className="text-xs text-muted-foreground">{t("review.existsHint")}</p>
            )}
          </Section>

          <Section title={t("review.sectionAchievements", { count: achs.length })}>
            {achs.map((a, i) => (
              <DraftCard key={i} include={a.include} onInclude={(v) => setAchs(upd(achs, i, { include: v }))}
                includeDisabled={involvedBySection.achievement.has(i)}>
                <div className="grid grid-cols-4 gap-2">
                  <Input value={a.title} placeholder={t("review.ph.achievement")} className="col-span-2" onChange={(ev) => setAchs(upd(achs, i, { title: ev.target.value }))} />
                  <Input value={a.metricValue} placeholder={t("review.ph.metricValue")} type="number" onChange={(ev) => setAchs(upd(achs, i, { metricValue: ev.target.value }))} />
                  <Input value={a.metricUnit} placeholder={t("review.ph.metricUnit")} onChange={(ev) => setAchs(upd(achs, i, { metricUnit: ev.target.value }))} />
                </div>
              </DraftCard>
            ))}
          </Section>

          <Section title={t("review.sectionEducations", { count: edus.length })}>
            {edus.map((e, i) => (
              <DraftCard key={i} include={e.include} onInclude={(v) => setEdus(upd(edus, i, { include: v }))}
                includeDisabled={involvedBySection.education.has(i)}>
                <div className="grid grid-cols-3 gap-2">
                  <Input value={e.school} placeholder={t("review.ph.school")} onChange={(ev) => setEdus(upd(edus, i, { school: ev.target.value }))} />
                  <Input value={e.degree} placeholder={t("review.ph.degree")} onChange={(ev) => setEdus(upd(edus, i, { degree: ev.target.value }))} />
                  <Input value={e.major} placeholder={t("review.ph.major")} onChange={(ev) => setEdus(upd(edus, i, { major: ev.target.value }))} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <DateField
                    value={e.startDate} precision={e.startDatePrecision}
                    onChange={(date, precision) => setEdus(upd(edus, i, { startDate: date, startDatePrecision: precision }))}
                    placeholder={t("review.ph.startDate")}
                  />
                  <DateField
                    value={e.endDate} precision={e.endDatePrecision}
                    onChange={(date, precision) => setEdus(upd(edus, i, { endDate: date, endDatePrecision: precision }))}
                    present={e.endDatePresent}
                    onPresentChange={(present) => setEdus(upd(edus, i, { endDatePresent: present }))}
                    placeholder={t("review.ph.endDate")}
                  />
                </div>
              </DraftCard>
            ))}
          </Section>

          <Section title={t("review.sectionHonors", { count: hons.length })}>
            {hons.map((h, i) => (
              <DraftCard key={i} include={h.include} onInclude={(v) => setHons(upd(hons, i, { include: v }))}
                includeDisabled={involvedBySection.honor.has(i)}>
                <div className="grid grid-cols-2 gap-2">
                  <Input value={h.title} placeholder={t("review.ph.honorTitle")} onChange={(ev) => setHons(upd(hons, i, { title: ev.target.value }))} />
                  <Input value={h.issuer} placeholder={t("review.ph.issuer")} onChange={(ev) => setHons(upd(hons, i, { issuer: ev.target.value }))} />
                </div>
              </DraftCard>
            ))}
          </Section>
        </div>
      </div>

      <div className="flex items-center justify-between rounded-lg border bg-background px-4 py-3">
        <p className="text-sm text-muted-foreground">{t("review.selectedCount", { count: includedCount })}</p>
        <div className="flex gap-2">
          <Button variant="outline" onClick={discard}>{t("review.discard")}</Button>
          <Button onClick={apply} disabled={applying || includedCount === 0}>
            {applying ? <><Loader2 className="size-4 animate-spin" /> {t("review.applying")}</> : t("review.applyAll", { count: includedCount })}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ===== 小组件 =====
function upd<T>(arr: T[], i: number, patch: Partial<T>): T[] {
  return arr.map((item, idx) => (idx === i ? { ...item, ...patch } : item));
}

function padDate(value: string, precision: DatePrecision): string {
  if (precision === "year") return `${value.slice(0, 4)}-01-01`;
  if (precision === "month") return `${value.slice(0, 7)}-01`;
  return value.slice(0, 10);
}

function DateField({
  value,
  precision,
  onChange,
  present,
  onPresentChange,
  placeholder,
}: {
  value: string;
  precision: DatePrecision | null;
  onChange: (date: string, precision: DatePrecision) => void;
  present?: boolean;
  onPresentChange?: (present: boolean) => void;
  placeholder?: string;
}) {
  const t = useT();
  const p = precision ?? "day";

  if (present) {
    return (
      <div className="flex items-center gap-2">
        <Input value={t("common.present")} disabled className="bg-muted" />
        {onPresentChange && (
          <Button type="button" variant="outline" size="icon" className="size-9 shrink-0" onClick={() => onPresentChange(false)}>
            <X className="size-4" />
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {p === "day" && (
        <Input type="date" value={value.slice(0, 10)} onChange={(ev) => onChange(padDate(ev.target.value, "day"), "day")} placeholder={placeholder} />
      )}
      {p === "month" && (
        <Input type="month" value={value.slice(0, 7)} onChange={(ev) => onChange(padDate(ev.target.value, "month"), "month")} placeholder={placeholder} />
      )}
      {p === "year" && (
        <Input type="number" min={1900} max={2100} value={value.slice(0, 4)} onChange={(ev) => onChange(padDate(ev.target.value, "year"), "year")} placeholder={placeholder ?? "YYYY"} />
      )}
      <Select value={p} onValueChange={(v) => onChange(padDate(value, v as DatePrecision), v as DatePrecision)}>
        <SelectTrigger className="h-9 w-[4.5rem] shrink-0 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="year">{t("review.datePrecision.year")}</SelectItem>
          <SelectItem value="month">{t("review.datePrecision.month")}</SelectItem>
          <SelectItem value="day">{t("review.datePrecision.day")}</SelectItem>
        </SelectContent>
      </Select>
      {onPresentChange && (
        <Button type="button" variant="outline" size="sm" className="h-9 shrink-0 px-2 text-xs" onClick={() => onPresentChange(true)}>
          {t("common.present")}
        </Button>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <h2 className="text-sm font-semibold">{title}</h2>
      {children}
    </div>
  );
}

function ConfBadge({ c }: { c: Confidence }) {
  const t = useT();
  const meta = CONFIDENCE_META[c];
  return <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${meta.className}`}>{t("review.confidence", { label: t(`review.conf.${c}`) })}</span>;
}

function DraftCard({
  include, onInclude, badge, duplicate, includeDisabled, children,
}: {
  include: boolean; onInclude: (v: boolean) => void;
  badge?: React.ReactNode; duplicate?: string; includeDisabled?: boolean; children: React.ReactNode;
}) {
  const t = useT();
  return (
    <Card
      className={`${include ? "" : "opacity-55"} ${includeDisabled ? "cursor-default" : "cursor-pointer"} transition-colors hover:border-primary/50`}
      onClick={(ev) => {
        if (includeDisabled) return;
        const target = ev.target as HTMLElement;
        const interactive = target.closest(
          "input, textarea, button, select, [role='switch'], [data-radix-popper-content-wrapper], [data-radix-select-viewport]"
        );
        if (interactive) return;
        onInclude(!include);
      }}
    >
      <CardContent className="space-y-2 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {badge}
            {duplicate && (
              <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                {t("review.suspectedDuplicate", { name: duplicate })}
              </span>
            )}
            {includeDisabled && (
              <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] text-amber-700">
                {t("review.dupHandledByPanel")}
              </span>
            )}
          </div>
          <Switch checked={include} disabled={includeDisabled} onCheckedChange={onInclude} aria-label={t("review.include")} />
        </div>
        {children}
      </CardContent>
    </Card>
  );
}

// ===== 疑似重复 / 合并面板（全部分栏通用） =====
// AI 已判定这些分栏为「同一实体」；玩家在此决定如何处理，归约逻辑见 shared.buildApplySections。
function DupMergeSection({
  hits, itemsBySection, choices, onChoice,
}: {
  hits: DupHit[];
  itemsBySection: Record<SectionKind, MergeItem[]>;
  choices: Record<string, MergeChoice>;
  onChoice: (id: string, c: MergeChoice) => void;
}) {
  const t = useT();
  if (!hits.length) return null;

  const sideLabel = (h: DupHit) =>
    h.kind === "cross" ? t("review.dupSourceExisting") : t("review.dupSourceNewOther");

  return (
    <Section title={t("review.dupSectionTitle", { count: hits.length })}>
      <p className="text-xs text-muted-foreground">{t("review.dupSectionHint")}</p>
      {hits.map((h) => {
        const items = itemsBySection[h.section];
        const a = items[h.index];
        const b: MergeItem =
          h.kind === "intra"
            ? items[h.otherIndex!]
            : (h.existing as MergeItem) ?? ({ label: "", startDate: null, endDate: null, raw: {} } as MergeItem);
        if (!a) return null;
        const merged = mergeItems(h.section, a, b);
        const choice: MergeChoice = choices[h.id] ?? "merge";
        const choiceOpts: { value: MergeChoice; label: string }[] =
          h.kind === "intra"
            ? [
                { value: "merge", label: t("review.dupChoiceMerge") },
                { value: "keep_both", label: t("review.dupChoiceKeepBoth") },
              ]
            : [
                { value: "merge", label: t("review.dupChoiceMerge") },
                { value: "keep_existing", label: t("review.dupChoiceKeepExisting") },
                { value: "keep_new", label: t("review.dupChoiceKeepNew") },
                { value: "keep_both", label: t("review.dupChoiceKeepBoth") },
              ];

        const renderSide = (label: string, f: MergeItem) => (
          <div className="space-y-1 rounded-md border bg-muted/40 p-2 text-xs">
            <p className="font-medium text-muted-foreground">{label}</p>
            <p className="font-medium">{f.label}</p>
            <p className="text-muted-foreground">
              {f.startDate ?? "?"} ~ {f.endDate ?? t("common.present")}
            </p>
            {Boolean(f.raw.description) && <p className="line-clamp-2 text-muted-foreground">{String(f.raw.description)}</p>}
            {(Array.isArray(f.raw.highlights) && (f.raw.highlights as string[]).length > 0) && (
              <p className="text-muted-foreground">· {(f.raw.highlights as string[]).slice(0, 6).join(" / ")}</p>
            )}
          </div>
        );

        return (
          <Card key={h.id} className="border-amber-300">
            <CardContent className="space-y-2 py-3">
              <div className="flex items-center justify-between gap-2">
                <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] text-amber-700">
                  {t("review.dupAiBadge", { confidence: t(`review.conf.${h.confidence}`) })}
                </span>
                {h.reason && <span className="truncate text-[11px] text-muted-foreground">{h.reason}</span>}
              </div>

              <div className="grid grid-cols-2 gap-2">
                {renderSide(t("review.dupSourceNew"), a)}
                {renderSide(sideLabel(h), b)}
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">{t("review.dupChoiceLabel")}</span>
                <Select value={choice} onValueChange={(v) => onChoice(h.id, v as MergeChoice)}>
                  <SelectTrigger className="h-8 w-[10rem] text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {choiceOpts.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {choice === "merge" && (
                <div className="space-y-1 rounded-md border border-dashed bg-background p-2 text-xs">
                  <p className="font-medium text-muted-foreground">{t("review.dupMergedPreview")}</p>
                  <p className="font-medium">{merged.label}</p>
                  <p className="text-muted-foreground">
                    {merged.startDate ?? "?"} ~ {merged.endDate ?? t("common.present")}
                  </p>
                  {Boolean(merged.raw.description) && <p className="line-clamp-3 text-muted-foreground">{String(merged.raw.description)}</p>}
                  {(Array.isArray(merged.raw.highlights) && (merged.raw.highlights as string[]).length > 0) && (
                    <p className="text-muted-foreground">· {(merged.raw.highlights as string[]).slice(0, 6).join(" / ")}</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </Section>
  );
}
