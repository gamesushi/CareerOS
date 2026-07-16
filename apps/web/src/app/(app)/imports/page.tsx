"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { api } from "@/lib/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { FileUp, Loader2 } from "lucide-react";

type ImportRow = {
  id: string;
  fileName: string;
  status: "pending" | "parsing" | "extracting" | "review" | "applied" | "failed";
  error?: string | null;
  createdAt: string;
};

const STATUS_META: Record<ImportRow["status"], { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "排队中", variant: "outline" },
  parsing: { label: "解析文档", variant: "secondary" },
  extracting: { label: "AI 抽取", variant: "secondary" },
  review: { label: "待确认", variant: "default" },
  applied: { label: "已入库", variant: "outline" },
  failed: { label: "失败", variant: "destructive" },
};

const RUNNING = new Set(["pending", "parsing", "extracting"]);

export default function ImportsPage() {
  const router = useRouter();
  const [items, setItems] = useState<ImportRow[] | null>(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const res = await api<{ data: ImportRow[] }>("/imports");
    if (res) setItems(res.data);
  }, []);

  useEffect(() => { void load(); }, [load]);

  // 有进行中的导入时轮询刷新
  useEffect(() => {
    if (!items?.some((i) => RUNNING.has(i.status))) return;
    const timer = setInterval(load, 2000);
    return () => clearInterval(timer);
  }, [items, load]);

  async function upload(file: File) {
    setUploading(true);
    const form = new FormData();
    form.append("file", file);
    const res = await fetch("/api/v1/imports/resume", { method: "POST", body: form });
    setUploading(false);
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      toast.error(body?.error?.message ?? `上传失败（${res.status}）`);
      return;
    }
    const { importId } = await res.json();
    toast.success("已开始解析");
    router.push(`/imports/${importId}/review`);
  }

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div>
        <h1 className="text-xl font-semibold">导入简历</h1>
        <p className="text-sm text-muted-foreground">
          上传简历 → 自动解析 → 人工确认 → 写入职业数据库。AI 结果不直接入库，最终以你确认的为准。
        </p>
      </div>

      <Card
        className={`border-2 border-dashed transition-colors ${dragOver ? "border-primary bg-accent/40" : ""}`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const file = e.dataTransfer.files[0];
          if (file) void upload(file);
        }}
      >
        <CardContent className="flex flex-col items-center gap-3 py-10">
          <FileUp className="size-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">拖拽文件到此处，或</p>
          <Button onClick={() => fileInput.current?.click()} disabled={uploading}>
            {uploading ? <><Loader2 className="size-4 animate-spin" /> 上传中…</> : "选择文件"}
          </Button>
          <p className="text-xs text-muted-foreground">支持 PDF / DOCX / DOC / Markdown / TXT，≤15MB</p>
          <input
            ref={fileInput}
            type="file"
            accept=".pdf,.docx,.doc,.md,.txt"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void upload(file);
              e.target.value = "";
            }}
          />
        </CardContent>
      </Card>

      <div className="space-y-2">
        <h2 className="text-sm font-medium text-muted-foreground">导入历史</h2>
        {!items && <Skeleton className="h-24" />}
        {items?.length === 0 && (
          <p className="py-4 text-center text-sm text-muted-foreground">还没有导入记录。</p>
        )}
        {items?.map((item) => {
          const meta = STATUS_META[item.status];
          return (
            <Card
              key={item.id}
              className={item.status === "review" ? "cursor-pointer transition-colors hover:bg-accent/40" : ""}
              onClick={() => item.status === "review" && router.push(`/imports/${item.id}/review`)}
            >
              <CardContent className="flex items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{item.fileName}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(item.createdAt).toLocaleString("zh-CN")}
                    {item.error && <span className="text-destructive"> · {item.error}</span>}
                  </p>
                </div>
                {RUNNING.has(item.status) && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
                <Badge variant={meta.variant}>{meta.label}</Badge>
                {item.status === "review" && (
                  <Button size="sm" variant="outline">去确认</Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
