"use client";

import { use, useCallback, useEffect, useState } from "react";
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
import { Loader2, CircleAlert, CircleCheck } from "lucide-react";
import { useT } from "@/lib/i18n/provider";

// ===== 抽取结果的本地编辑模型 =====
type Confidence = "high" | "mid" | "low";
type ExpDraft = {
  include: boolean; duplicate?: string; confidence: Confidence;
  company: string; title: string; startDate: string; endDate: string;
  location: string; description: string; highlights: string;
};
type ProjDraft = {
  include: boolean; confidence: Confidence;
  name: string; role: string; belongsToCompany: string;
  startDate: string; endDate: string; description: string; outcome: string; techStack: string;
};
type SkillDraft = { include: boolean; duplicate?: string; name: string; category: string | null; evidenceHint: string | null };
type AchDraft = { include: boolean; title: string; metricValue: string; metricUnit: string; metricText: string };
type EduDraft = { include: boolean; school: string; degree: string; major: string; startDate: string; endDate: string };

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

  const loadExtracted = useCallback(async () => {
    const res = await api<{
      fileName: string;
      rawText: string;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      extracted: any;
    }>(`/imports/${id}/extracted`, { silent: true });
    if (!res) return;
    const { result, duplicates } = res.extracted;
    setFileName(res.fileName);
    setRawText(res.rawText ?? "");

    const dupExp = new Map<number, string>(duplicates.experiences.map((d: { index: number; existingLabel: string }) => [d.index, d.existingLabel]));
    const dupSkill = new Map<number, string>(duplicates.skills.map((d: { index: number; existingLabel: string }) => [d.index, d.existingLabel]));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setExps(result.experiences.map((e: any, i: number): ExpDraft => ({
      include: e.confidence !== "low" && !dupExp.has(i),
      duplicate: dupExp.get(i),
      confidence: e.confidence,
      company: e.company ?? "", title: e.title ?? "",
      startDate: e.startDate ?? "", endDate: e.endDate ?? "",
      location: e.location ?? "", description: e.description ?? "",
      highlights: (e.highlights ?? []).join("\n"),
    })));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setProjs(result.projects.map((p: any): ProjDraft => ({
      include: p.confidence !== "low",
      confidence: p.confidence,
      name: p.name ?? "", role: p.role ?? "", belongsToCompany: p.belongsToCompany ?? "",
      startDate: p.startDate ?? "", endDate: p.endDate ?? "",
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
    setAchs(result.achievements.map((a: any): AchDraft => ({
      include: true, title: a.title ?? "",
      metricValue: a.metricValue != null ? String(a.metricValue) : "",
      metricUnit: a.metricUnit ?? "", metricText: a.metricText ?? "",
    })));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setEdus(result.educations.map((e: any): EduDraft => ({
      include: true, school: e.school ?? "", degree: e.degree ?? "", major: e.major ?? "",
      startDate: e.startDate ?? "", endDate: e.endDate ?? "",
    })));
  }, [id]);

  // 状态机：SSE 订阅进度，review 后拉抽取结果
  useEffect(() => {
    let closed = false;
    void api<{ status: Status; error?: string | null }>(`/imports/${id}`, { silent: true }).then((res) => {
      if (!res || closed) return;
      setStatus(res.status);
      setError(res.error ?? null);
      if (res.status === "review") void loadExtracted();
    });

    const es = new EventSource(`/api/v1/imports/${id}/events`);
    es.onmessage = (ev) => {
      const data = JSON.parse(ev.data) as { status: Status; error?: string | null };
      setStatus(data.status);
      setError(data.error ?? null);
      if (data.status === "review") void loadExtracted();
    };
    es.onerror = () => es.close();
    return () => { closed = true; es.close(); };
  }, [id, loadExtracted]);

  async function apply() {
    const included = exps.filter((e) => e.include);
    const invalid = included.find((e) => !e.company || !e.title || !e.startDate);
    if (invalid) {
      toast.error(t("review.invalidExp", { name: invalid.company || t("review.unnamed") }));
      return;
    }
    setApplying(true);
    const body = JSON.stringify({
      experiences: included.map((e) => ({
        company: e.company, title: e.title,
        startDate: e.startDate, endDate: e.endDate || null,
        location: e.location || undefined, description: e.description || undefined,
        highlights: e.highlights.split("\n").map((s) => s.trim()).filter(Boolean),
      })),
      projects: projs.filter((p) => p.include && p.name).map((p) => ({
        name: p.name, role: p.role || undefined,
        belongsToCompany: p.belongsToCompany || null,
        startDate: p.startDate || null, endDate: p.endDate || null,
        description: p.description || undefined, outcome: p.outcome || undefined,
        techStack: p.techStack.split(/[,，]/).map((s) => s.trim()).filter(Boolean),
      })),
      skills: skills.filter((s) => s.include && s.name).map((s) => ({
        name: s.name, category: s.category ?? undefined,
      })),
      achievements: achs.filter((a) => a.include && a.title).map((a) => ({
        title: a.title,
        metricValue: a.metricValue ? Number(a.metricValue) : null,
        metricUnit: a.metricUnit || null,
        metricText: a.metricText || null,
      })),
      educations: edus.filter((e) => e.include && e.school).map((e) => ({
        school: e.school, degree: e.degree || undefined, major: e.major || undefined,
        startDate: e.startDate || null, endDate: e.endDate || null,
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
                <Button variant="outline" onClick={() => router.push("/imports")}>{t("review.failedBack")}</Button>
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
    edus.filter((e) => e.include).length;

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
          <Section title={t("review.sectionExperiences", { count: exps.length })}>
            {exps.map((e, i) => (
              <DraftCard key={i} include={e.include} onInclude={(v) => setExps(upd(exps, i, { include: v }))}
                badge={<ConfBadge c={e.confidence} />} duplicate={e.duplicate}>
                <div className="grid grid-cols-2 gap-2">
                  <Input value={e.company} placeholder={t("review.ph.company")} onChange={(ev) => setExps(upd(exps, i, { company: ev.target.value }))} />
                  <Input value={e.title} placeholder={t("review.ph.title")} onChange={(ev) => setExps(upd(exps, i, { title: ev.target.value }))} />
                  <Input type="date" value={e.startDate} onChange={(ev) => setExps(upd(exps, i, { startDate: ev.target.value }))} />
                  <Input type="date" value={e.endDate} onChange={(ev) => setExps(upd(exps, i, { endDate: ev.target.value }))} />
                </div>
                <Textarea rows={2} value={e.highlights} placeholder={t("review.ph.highlights")}
                  onChange={(ev) => setExps(upd(exps, i, { highlights: ev.target.value }))} />
              </DraftCard>
            ))}
          </Section>

          <Section title={t("review.sectionProjects", { count: projs.length })}>
            {projs.map((p, i) => (
              <DraftCard key={i} include={p.include} onInclude={(v) => setProjs(upd(projs, i, { include: v }))}
                badge={<ConfBadge c={p.confidence} />}>
                <div className="grid grid-cols-2 gap-2">
                  <Input value={p.name} placeholder={t("review.ph.projectName")} onChange={(ev) => setProjs(upd(projs, i, { name: ev.target.value }))} />
                  <Input value={p.role} placeholder={t("review.ph.role")} onChange={(ev) => setProjs(upd(projs, i, { role: ev.target.value }))} />
                  <Input value={p.belongsToCompany} placeholder={t("review.ph.belongsToCompany")} className="col-span-2"
                    onChange={(ev) => setProjs(upd(projs, i, { belongsToCompany: ev.target.value }))} />
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
              <DraftCard key={i} include={a.include} onInclude={(v) => setAchs(upd(achs, i, { include: v }))}>
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
              <DraftCard key={i} include={e.include} onInclude={(v) => setEdus(upd(edus, i, { include: v }))}>
                <div className="grid grid-cols-3 gap-2">
                  <Input value={e.school} placeholder={t("review.ph.school")} onChange={(ev) => setEdus(upd(edus, i, { school: ev.target.value }))} />
                  <Input value={e.degree} placeholder={t("review.ph.degree")} onChange={(ev) => setEdus(upd(edus, i, { degree: ev.target.value }))} />
                  <Input value={e.major} placeholder={t("review.ph.major")} onChange={(ev) => setEdus(upd(edus, i, { major: ev.target.value }))} />
                </div>
              </DraftCard>
            ))}
          </Section>
        </div>
      </div>

      <div className="flex items-center justify-between rounded-lg border bg-background px-4 py-3">
        <p className="text-sm text-muted-foreground">{t("review.selectedCount", { count: includedCount })}</p>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => router.push("/imports")}>{t("review.discard")}</Button>
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
  include, onInclude, badge, duplicate, children,
}: {
  include: boolean; onInclude: (v: boolean) => void;
  badge?: React.ReactNode; duplicate?: string; children: React.ReactNode;
}) {
  const t = useT();
  return (
    <Card className={include ? "" : "opacity-55"}>
      <CardContent className="space-y-2 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {badge}
            {duplicate && (
              <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                {t("review.suspectedDuplicate", { name: duplicate })}
              </span>
            )}
          </div>
          <Switch checked={include} onCheckedChange={onInclude} />
        </div>
        {children}
      </CardContent>
    </Card>
  );
}
