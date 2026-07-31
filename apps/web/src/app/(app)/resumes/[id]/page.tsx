"use client";

import { use, useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { api } from "@/lib/client";
import type { JsonResume } from "@careeros/shared";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { TEMPLATE_META, resolveTemplateMeta } from "@/lib/pdf/template-meta";
import { Loader2, Download, CircleAlert, TriangleAlert } from "lucide-react";
import { useT } from "@/lib/i18n/provider";

type ResumeDetail = {
  id: string;
  title: string;
  resumeType: string;
  templateId: string;
  status: string;
  resumeJson: JsonResume | Record<string, never>;
  state: "ready" | "generating" | "failed";
  error?: string | null;
};

export default function ResumeEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const t = useT();
  const [detail, setDetail] = useState<ResumeDetail | null>(null);
  const [doc, setDoc] = useState<JsonResume | null>(null);
  const [title, setTitle] = useState("");
  const [templateId, setTemplateId] = useState("classic");
  const [accent, setAccent] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [previewKey, setPreviewKey] = useState(0);
  const [fmt, setFmt] = useState<"pdf" | "docx" | "doc" | "md">("pdf");
  const [exporting, setExporting] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const load = useCallback(async () => {
    const res = await api<ResumeDetail>(`/resumes/${id}`, { silent: true });
    if (!res) return;
    setDetail(res);
    setTitle(res.title);
    const meta = resolveTemplateMeta(res.templateId);
    setTemplateId(meta.id);
    if (res.state === "ready") {
      const rj = res.resumeJson as JsonResume;
      setDoc(rj);
      setAccent(rj["x-theme"]?.accent ?? null);
    }
  }, [id]);

  useEffect(() => {
    let active = true;
    void (async () => {
      const res = await api<ResumeDetail>(`/resumes/${id}`, { silent: true });
      if (!active || !res) return;
      setDetail(res);
      setTitle(res.title);
      const meta = resolveTemplateMeta(res.templateId);
      setTemplateId(meta.id);
      if (res.state === "ready") {
        const rj = res.resumeJson as JsonResume;
        setDoc(rj);
        setAccent(rj["x-theme"]?.accent ?? null);
      }
    })();
    return () => { active = false; };
  }, [id]);
  useEffect(() => {
    if (detail?.state !== "generating") return;
    const timer = setInterval(load, 2000);
    return () => clearInterval(timer);
  }, [detail?.state, load]);

  async function save(markFinal = false) {
    if (!doc) return;
    setSaving(true);
    const docWithTheme: JsonResume = {
      ...doc,
      "x-theme": accent ? { accent } : undefined,
    };
    const res = await api(`/resumes/${id}`, {
      method: "PUT",
      body: JSON.stringify({
        title,
        templateId,
        resumeJson: docWithTheme,
        ...(markFinal ? { status: "final" } : {}),
      }),
    });
    setSaving(false);
    if (res) {
      toast.success(markFinal ? t("resumeDetail.finalized") : t("common.saved"));
      setPreviewKey((k) => k + 1); // 重载预览 iframe
      if (markFinal) void load();
    }
  }

  // 健壮导出：fetch + Blob，先校验 Content-Type，绝不会把 HTML/错误页存成目标格式文件。
  async function downloadResume(format: "pdf" | "docx" | "doc" | "md") {
    if (!doc) {
      toast.error("简历尚未生成，无法导出");
      return;
    }
    setExporting(true);
    try {
      const params = new URLSearchParams({ template: templateId, format });
      if (accent) params.set("accent", accent);
      const res = await fetch(`/api/v1/resumes/${id}/export?${params.toString()}`, {
        credentials: "include",
      });
      if (!res.ok) {
        let msg = `导出失败（HTTP ${res.status}）`;
        try {
          const j = await res.json();
          if (j?.error?.message) msg = j.error.message;
        } catch {}
        toast.error(msg);
        return;
      }
      const ct = (res.headers.get("content-type") || "").toLowerCase();
      const expected =
        format === "pdf" ? "application/pdf"
        : format === "docx" ? "wordprocessingml"
        : format === "doc" ? "msword"
        : "markdown";
      if (!ct.includes(expected)) {
        // 后端未返回有效文件（如返回了 HTML/登录页），绝不把它存成目标格式
        toast.error("导出未返回有效文件，请先登录后刷新页面重试");
        return;
      }
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      let fname = `${title || "resume"}.${format}`;
      const cd = res.headers.get("content-disposition");
      if (cd) {
        const m = cd.match(/filename\*=UTF-8''([^;]+)/) ?? cd.match(/filename="?([^";]+)"?/);
        if (m) fname = decodeURIComponent(m[1]);
      }
      a.download = fname;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objectUrl);
      toast.success("已开始下载");
    } catch {
      toast.error("导出出错，请重试");
    } finally {
      setExporting(false);
    }
  }

  // 预览/导出 URL：模板与颜色即时覆盖（未保存也能预览效果）
  const previewParams = new URLSearchParams({ inline: "1", template: templateId });
  if (accent) previewParams.set("accent", accent);
  const exportParams = new URLSearchParams({ template: templateId });
  if (accent) exportParams.set("accent", accent);

  if (!detail) return <div className="mx-auto max-w-6xl"><Skeleton className="h-96" /></div>;

  if (detail.state === "generating") {
    return (
      <div className="flex min-h-[70vh] items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="flex items-center gap-3 py-8">
            <Loader2 className="size-5 animate-spin" />
            <div>
              <p className="font-medium">{t("resumeDetail.generating")}</p>
              <p className="text-sm text-muted-foreground">{t("resumeDetail.generatingHint")}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (detail.state === "failed") {
    return (
      <div className="flex min-h-[70vh] items-center justify-center">
        <Card className="max-w-md text-center">
          <CardContent className="space-y-3 py-8">
            <CircleAlert className="mx-auto size-8 text-destructive" />
            <p className="font-medium">{t("resumeDetail.failed")}</p>
            <p className="text-sm text-muted-foreground">{detail.error ?? t("common.unknownError")}</p>
            <Button variant="outline" onClick={() => router.push("/resumes")}>{t("common.back")}</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!doc) return null;
  const warnings = doc["x-warnings"] ?? [];

  return (
    <div className="mx-auto flex h-[calc(100vh-3rem)] max-w-6xl flex-col gap-3">
      <div className="flex items-center gap-3">
        <Input className="max-w-xs font-medium" value={title} onChange={(e) => setTitle(e.target.value)} />
        <Select
          value={templateId}
          onValueChange={(v) => {
            setTemplateId(v);
            setPreviewKey((k) => k + 1);
          }}
        >
          <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
          <SelectContent>
            {TEMPLATE_META.map((tm) => (
              <SelectItem key={tm.id} value={tm.id}>
                {tm.name} · {tm.description.split("，")[0]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <input
          type="color"
          title={t("resumeDetail.accent")}
          className="size-8 cursor-pointer rounded border bg-transparent p-0.5"
          value={accent ?? resolveTemplateMeta(templateId).defaultAccent}
          onChange={(e) => setAccent(e.target.value)}
          onBlur={() => setPreviewKey((k) => k + 1)}
        />
        <span className="text-xs text-muted-foreground">{detail.status === "final" ? t("resumes.final") : t("resumes.draft")}</span>
        <div className="ml-auto flex gap-2">
          <Button variant="outline" onClick={() => router.push("/resumes")}>{t("common.back")}</Button>
          <Button variant="outline" onClick={() => save(false)} disabled={saving}>
            {saving ? t("common.saving") : t("common.save")}
          </Button>
          <Button variant="outline" onClick={() => save(true)} disabled={saving}>{t("resumes.final")}</Button>
          <Select value={fmt} onValueChange={(v) => setFmt(v as "pdf" | "docx" | "doc" | "md")}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="pdf">PDF</SelectItem>
              <SelectItem value="docx">Word (.docx)</SelectItem>
              <SelectItem value="doc">Word (.doc)</SelectItem>
              <SelectItem value="md">Markdown</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={() => downloadResume(fmt)} disabled={exporting}>
            <Download className="size-4" /> {exporting ? "导出中…" : "导出"}
          </Button>
        </div>
      </div>

      {warnings.length > 0 && (
        <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
          <TriangleAlert className="mr-1 inline size-3.5" />
          {t("resumeDetail.warningPrefix")}{warnings.slice(0, 3).join("；")}
          {warnings.length > 3 && ` ${t("resumeDetail.warningMore", { count: warnings.length })}`}
        </div>
      )}

      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-2">
        {/* 左：SectionEditor */}
        <div className="min-h-0 space-y-4 overflow-y-auto pr-1">
          <Card>
            <CardContent className="space-y-4 py-4">
              <h2 className="text-sm font-semibold">{t("resumeDetail.workExp", { count: doc.work.length })}</h2>
              {doc.work.map((w, i) => (
                <div key={i} className="space-y-2">
                  {i > 0 && <Separator />}
                  <p className="text-sm font-medium">{w.name}｜{w.position}</p>
                  <div className="space-y-1.5">
                    <Label>{t("resumeDetail.overview")}</Label>
                    <Textarea
                      rows={2}
                      value={w.summary ?? ""}
                      onChange={(e) => {
                        const work = [...doc.work];
                        work[i] = { ...w, summary: e.target.value };
                        setDoc({ ...doc, work });
                      }}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>{t("resumeDetail.highlights")}</Label>
                    <Textarea
                      rows={3}
                      value={w.highlights.join("\n")}
                      onChange={(e) => {
                        const work = [...doc.work];
                        work[i] = { ...w, highlights: e.target.value.split("\n").filter(Boolean) };
                        setDoc({ ...doc, work });
                      }}
                    />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {doc.projects.length > 0 && (
            <Card>
              <CardContent className="space-y-4 py-4">
                <h2 className="text-sm font-semibold">{t("resumeDetail.projects", { count: doc.projects.length })}</h2>
                {doc.projects.map((p, i) => (
                  <div key={i} className="space-y-2">
                    {i > 0 && <Separator />}
                    <p className="text-sm font-medium">{p.name}{p.roles.length ? `｜${p.roles.join("、")}` : ""}</p>
                    <div className="space-y-1.5">
                      <Label>{t("resumeDetail.projectDesc")}</Label>
                      <Textarea
                        rows={2}
                        value={p.description ?? ""}
                        onChange={(e) => {
                          const projects = [...doc.projects];
                          projects[i] = { ...p, description: e.target.value };
                          setDoc({ ...doc, projects });
                        }}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>{t("resumeDetail.projectHighlights")}</Label>
                      <Textarea
                        rows={2}
                        value={p.highlights.join("\n")}
                        onChange={(e) => {
                          const projects = [...doc.projects];
                          projects[i] = { ...p, highlights: e.target.value.split("\n").filter(Boolean) };
                          setDoc({ ...doc, projects });
                        }}
                      />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {doc.education.length > 0 && (
            <Card>
              <CardContent className="space-y-4 py-4">
                <h2 className="text-sm font-semibold">{t("resumeDetail.education", { count: doc.education.length })}</h2>
                {doc.education.map((e, i) => (
                  <div key={i} className="space-y-2">
                    {i > 0 && <Separator />}
                    <p className="text-sm font-medium">{e.institution}</p>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1.5">
                        <Label>{t("review.ph.degree")}</Label>
                        <Input
                          value={e.studyType ?? ""}
                          onChange={(ev) => {
                            const education = [...doc.education];
                            education[i] = { ...e, studyType: ev.target.value };
                            setDoc({ ...doc, education });
                          }}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label>{t("review.ph.major")}</Label>
                        <Input
                          value={e.area ?? ""}
                          onChange={(ev) => {
                            const education = [...doc.education];
                            education[i] = { ...e, area: ev.target.value };
                            setDoc({ ...doc, education });
                          }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {doc.skills.length > 0 && (
            <Card>
              <CardContent className="space-y-3 py-4">
                <h2 className="text-sm font-semibold">{t("resumeDetail.skills", { count: doc.skills.length })}</h2>
                <div className="flex flex-wrap gap-2">
                  {doc.skills.map((s, i) => (
                    <span key={i} className="rounded-full bg-muted px-2.5 py-1 text-xs">
                      {s.name}{s.level && s.level !== "0" ? `（${s.level}）` : ""}
                    </span>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {doc.awards.length > 0 && (
            <Card>
              <CardContent className="space-y-3 py-4">
                <h2 className="text-sm font-semibold">{t("resumeDetail.awards", { count: doc.awards.length })}</h2>
                <ul className="list-disc space-y-1 pl-4 text-sm">
                  {doc.awards.map((a, i) => (
                    <li key={i}>{a.title}{a.date ? `（${a.date}）` : ""}</li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          <p className="pb-4 text-xs text-muted-foreground">
            {t("resumeDetail.snapshotHint")}
          </p>
        </div>

        {/* 右：真 PDF 预览（与导出同一渲染器） */}
        <Card className="min-h-0 overflow-hidden py-0">
          <iframe
            key={previewKey}
            ref={iframeRef}
            src={`/api/v1/resumes/${id}/export?${previewParams}#toolbar=0`}
            className="h-full w-full"
            title={t("resumeDetail.previewTitle")}
          />
        </Card>
      </div>
    </div>
  );
}
