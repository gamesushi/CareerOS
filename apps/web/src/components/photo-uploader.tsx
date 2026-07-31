"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Loader2, Upload } from "lucide-react";
import { useT } from "@/lib/i18n/provider";
import { PHOTO_SIZE_PRESETS, compressPhoto } from "@/lib/resume-fields";

// 个人证件照上传：文件选择 + 拖拽 + 预览 + 移除；尺寸/质量可调，前端 canvas 压缩后转 base64。
export function PhotoUploader({ value, onChange }: { value?: string; onChange: (v?: string) => void }) {
  const t = useT();
  const [size, setSize] = useState<"small" | "medium" | "large">("medium");
  const [quality, setQuality] = useState(0.85);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const lastFileRef = useRef<File | null>(null);
  const onChangeRef = useRef(onChange);
  const preset = PHOTO_SIZE_PRESETS.find((p) => p.id === size)!;

  // onChange 每次渲染可能是新引用；用 ref 保存最新值供下方 effect 调用（避免把 onChange 放进依赖导致重复压缩）。
  // ref 同步必须在 render 之外，故用 effect；置于重压缩 effect 之前，保证时序上先刷新再被读取。
  useEffect(() => {
    onChangeRef.current = onChange;
  });

  // 尺寸/质量变化且已有原图时，自动重新压缩（所见即所得）
  useEffect(() => {
    const f = lastFileRef.current;
    if (!f) return;
    let cancelled = false;
    setBusy(true);
    compressPhoto(f, preset.w, preset.h, quality)
      .then((data) => {
        if (!cancelled) onChangeRef.current(data);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setBusy(false);
      });
    return () => {
      cancelled = true;
    };
  }, [size, quality, preset.w, preset.h]);

  async function handleFile(file: File) {
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) {
      toast.error(t("resumeDetail.photoTypeErr"));
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error(t("resumeDetail.photoSizeErr"));
      return;
    }
    lastFileRef.current = file;
    setBusy(true);
    try {
      const data = await compressPhoto(file, preset.w, preset.h, quality);
      onChangeRef.current(data);
      toast.success(t("resumeDetail.photoCompressed", { kb: Math.round(data.length / 1024) }));
    } catch {
      toast.error(t("resumeDetail.photoFail"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        <div className="relative size-20 overflow-hidden rounded border bg-muted">
          {value ? (
            // value 是本地 base64/blob 预览图，非远程资源，next/image 不适用
            // eslint-disable-next-line @next/next/no-img-element
            <img src={value} alt="photo" className="size-full object-cover" />
          ) : (
            <div className="flex size-full items-center justify-center px-1 text-center text-[10px] text-muted-foreground">
              {t("resumeDetail.noPhoto")}
            </div>
          )}
        </div>
        <div className="space-y-1.5">
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleFile(f);
              e.target.value = "";
            }}
          />
          <div className="flex gap-1.5">
            <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => inputRef.current?.click()}>
              {busy ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
              {value ? t("resumeDetail.replacePhoto") : t("resumeDetail.uploadPhoto")}
            </Button>
            {value && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  lastFileRef.current = null;
                  onChangeRef.current(undefined);
                }}
              >
                {t("resumeDetail.removePhoto")}
              </Button>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground">{t("resumeDetail.photoHint")}</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3 text-xs">
        <div className="flex items-center gap-1">
          <span className="text-muted-foreground">{t("resumeDetail.photoSize")}</span>
          {PHOTO_SIZE_PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setSize(p.id)}
              className={`rounded px-2 py-0.5 ${size === p.id ? "bg-primary text-primary-foreground" : "bg-muted"}`}
            >
              {t(p.i18nKey)}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-1">
          <span className="text-muted-foreground">{t("resumeDetail.photoQuality")}</span>
          <input
            type="range"
            min={0.6}
            max={0.95}
            step={0.05}
            value={quality}
            onChange={(e) => setQuality(Number(e.target.value))}
            className="w-24"
          />
          <span className="tabular-nums">{Math.round(quality * 100)}%</span>
        </label>
      </div>
    </div>
  );
}
