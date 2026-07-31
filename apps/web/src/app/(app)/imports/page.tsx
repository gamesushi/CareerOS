"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { api } from "@/lib/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { FileUp, Loader2, RotateCcw, Trash2 } from "lucide-react";
import { useT } from "@/lib/i18n/provider";

type ImportRow = {
  id: string;
  fileName: string;
  status: "pending" | "parsing" | "extracting" | "review" | "applied" | "failed";
  error?: string | null;
  createdAt: string;
};

const STATUS_META: Record<ImportRow["status"], { variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { variant: "outline" },
  parsing: { variant: "secondary" },
  extracting: { variant: "secondary" },
  review: { variant: "default" },
  applied: { variant: "outline" },
  failed: { variant: "destructive" },
};

const RUNNING = new Set(["pending", "parsing", "extracting"]);

export default function ImportsPage() {
  const router = useRouter();
  const t = useT();
  const [items, setItems] = useState<ImportRow[] | null>(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const res = await api<{ data: ImportRow[] }>("/imports");
    if (res) setItems(res.data);
  }, []);

  useEffect(() => {
    let active = true;
    void (async () => {
      const res = await api<{ data: ImportRow[] }>("/imports");
      if (active && res) setItems(res.data);
    })();
    return () => { active = false; };
  }, []);

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
      toast.error(body?.error?.message ?? t("imports.uploadFailed", { status: res.status }));
      return;
    }
    const { importId } = await res.json();
    toast.success(t("imports.parsingStarted"));
    router.push(`/imports/${importId}/review`);
  }

  async function remove(id: string) {
    const res = await api(`/imports/${id}`, { method: "DELETE" });
    if (res) {
      toast.success(t("common.deleted"));
      void load();
    }
  }

  async function retry(id: string) {
    const res = await api(`/imports/${id}/retry`, { method: "POST" });
    if (res) {
      toast.success(t("imports.parsingStarted"));
      void load();
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div>
        <h1 className="text-xl font-semibold">{t("imports.title")}</h1>
        <p className="text-sm text-muted-foreground">
          {t("imports.subtitle")}
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
          <p className="text-sm text-muted-foreground">{t("imports.dropHint")}</p>
          <Button onClick={() => fileInput.current?.click()} disabled={uploading}>
            {uploading ? <><Loader2 className="size-4 animate-spin" /> {t("imports.uploading")}</> : t("imports.chooseFile")}
          </Button>
          <p className="text-xs text-muted-foreground">{t("imports.fileTypes")}</p>
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
        <h2 className="text-sm font-medium text-muted-foreground">{t("imports.history")}</h2>
        {!items && <Skeleton className="h-24" />}
        {items?.length === 0 && (
          <p className="py-4 text-center text-sm text-muted-foreground">{t("imports.historyEmpty")}</p>
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
                <Badge variant={meta.variant}>{t(`imports.status.${item.status}`)}</Badge>
                {item.status === "review" && (
                  <Button size="sm" variant="outline">{t("imports.goReview")}</Button>
                )}
                {item.status === "failed" && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={(e) => { e.stopPropagation(); void retry(item.id); }}
                  >
                    <RotateCcw className="size-4" /> {t("imports.retry")}
                  </Button>
                )}
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label={t("common.delete")}
                  className="text-muted-foreground hover:text-destructive"
                  onClick={(e) => { e.stopPropagation(); void remove(item.id); }}
                >
                  <Trash2 className="size-4" />
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
