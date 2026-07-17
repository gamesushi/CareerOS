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
import { Loader2, Download, CircleAlert, TriangleAlert } from "lucide-react";

type ResumeDetail = {
  id: string;
  title: string;
  resumeType: string;
  status: string;
  resumeJson: JsonResume | Record<string, never>;
  state: "ready" | "generating" | "failed";
  error?: string | null;
};

export default function ResumeEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [detail, setDetail] = useState<ResumeDetail | null>(null);
  const [doc, setDoc] = useState<JsonResume | null>(null);
  const [title, setTitle] = useState("");
  const [saving, setSaving] = useState(false);
  const [previewKey, setPreviewKey] = useState(0);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const load = useCallback(async () => {
    const res = await api<ResumeDetail>(`/resumes/${id}`, { silent: true });
    if (!res) return;
    setDetail(res);
    setTitle(res.title);
    if (res.state === "ready") setDoc(res.resumeJson as JsonResume);
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
    const res = await api(`/resumes/${id}`, {
      method: "PUT",
      body: JSON.stringify({ title, resumeJson: doc, ...(markFinal ? { status: "final" } : {}) }),
    });
    setSaving(false);
    if (res) {
      toast.success(markFinal ? "已定稿" : "已保存");
      setPreviewKey((k) => k + 1); // 重载预览 iframe
      if (markFinal) void load();
    }
  }

  if (!detail) return <div className="mx-auto max-w-6xl"><Skeleton className="h-96" /></div>;

  if (detail.state === "generating") {
    return (
      <div className="flex min-h-[70vh] items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="flex items-center gap-3 py-8">
            <Loader2 className="size-5 animate-spin" />
            <div>
              <p className="font-medium">正在从职业数据库生成简历…</p>
              <p className="text-sm text-muted-foreground">选材 → 措辞 → 事实校验，通常 10-60 秒</p>
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
            <p className="font-medium">生成失败</p>
            <p className="text-sm text-muted-foreground">{detail.error ?? "未知错误"}</p>
            <Button variant="outline" onClick={() => router.push("/resumes")}>返回</Button>
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
        <Input className="max-w-md font-medium" value={title} onChange={(e) => setTitle(e.target.value)} />
        <span className="text-xs text-muted-foreground">{detail.status === "final" ? "定稿" : "草稿"}</span>
        <div className="ml-auto flex gap-2">
          <Button variant="outline" onClick={() => router.push("/resumes")}>返回</Button>
          <Button variant="outline" onClick={() => save(false)} disabled={saving}>
            {saving ? "保存中…" : "保存"}
          </Button>
          <Button variant="outline" onClick={() => save(true)} disabled={saving}>定稿</Button>
          <Button asChild>
            <a href={`/api/v1/resumes/${id}/export`} download>
              <Download className="size-4" /> 导出 PDF
            </a>
          </Button>
        </div>
      </div>

      {warnings.length > 0 && (
        <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
          <TriangleAlert className="mr-1 inline size-3.5" />
          事实校验提醒：{warnings.slice(0, 3).join("；")}
          {warnings.length > 3 && ` 等 ${warnings.length} 条`}
        </div>
      )}

      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-2">
        {/* 左：SectionEditor */}
        <div className="min-h-0 space-y-4 overflow-y-auto pr-1">
          <Card>
            <CardContent className="space-y-3 py-4">
              <h2 className="text-sm font-semibold">基本信息</h2>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>姓名</Label>
                  <Input value={doc.basics.name} onChange={(e) => setDoc({ ...doc, basics: { ...doc.basics, name: e.target.value } })} />
                </div>
                <div className="space-y-1.5">
                  <Label>职业定位</Label>
                  <Input value={doc.basics.label ?? ""} onChange={(e) => setDoc({ ...doc, basics: { ...doc.basics, label: e.target.value } })} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>个人综述</Label>
                <Textarea rows={3} value={doc.basics.summary ?? ""} onChange={(e) => setDoc({ ...doc, basics: { ...doc.basics, summary: e.target.value } })} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-4 py-4">
              <h2 className="text-sm font-semibold">工作经历（{doc.work.length}）</h2>
              {doc.work.map((w, i) => (
                <div key={i} className="space-y-2">
                  {i > 0 && <Separator />}
                  <p className="text-sm font-medium">{w.name}｜{w.position}</p>
                  <div className="space-y-1.5">
                    <Label>概述</Label>
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
                    <Label>亮点（每行一条）</Label>
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
            简历是快照——这里的修改只影响当前版本。要修正事实（公司、时间、成果数据），请到职业知识库修改后重新生成。
          </p>
        </div>

        {/* 右：真 PDF 预览（与导出同一渲染器） */}
        <Card className="min-h-0 overflow-hidden py-0">
          <iframe
            key={previewKey}
            ref={iframeRef}
            src={`/api/v1/resumes/${id}/export?inline=1#toolbar=0`}
            className="h-full w-full"
            title="简历预览"
          />
        </Card>
      </div>
    </div>
  );
}
