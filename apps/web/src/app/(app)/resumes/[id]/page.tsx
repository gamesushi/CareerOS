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

  // 生成中轮询
  useEffect(() => {
    void load();
  }, [load]);
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
          <Button asChild>
            <a href={`/api/v1/resumes/${id}/export?${exportParams}`} download>
              <Download className="size-4" /> {t("resumeDetail.exportPdf")}
            </a>
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
            <CardContent className="space-y-3 py-4">
              <h2 className="text-sm font-semibold">{t("resumeDetail.basicInfo")}</h2>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>{t("resumeDetail.name")}</Label>
                  <Input value={doc.basics.name} onChange={(e) => setDoc({ ...doc, basics: { ...doc.basics, name: e.target.value } })} />
                </div>
                <div className="space-y-1.5">
                  <Label>{t("resumeDetail.position")}</Label>
                  <Input value={doc.basics.label ?? ""} onChange={(e) => setDoc({ ...doc, basics: { ...doc.basics, label: e.target.value } })} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>{t("resumeDetail.summary")}</Label>
                <Textarea rows={3} value={doc.basics.summary ?? ""} onChange={(e) => setDoc({ ...doc, basics: { ...doc.basics, summary: e.target.value } })} />
              </div>
            </CardContent>
          </Card>

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
