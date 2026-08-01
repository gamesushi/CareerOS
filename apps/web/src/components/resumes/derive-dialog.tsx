"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { api } from "@/lib/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { filterTemplatesForType, TYPE_DEFAULT_TEMPLATE } from "@/lib/pdf/template-meta";
import { Loader2, Globe, Sparkles, FileText } from "lucide-react";
import { useT } from "@/lib/i18n/provider";

type SourceResumeInfo = {
  id: string;
  title: string;
  resumeType: string;
  templateId: string;
  jdId?: string | null;
};

export function DeriveResumeDialog({
  open,
  onOpenChange,
  sourceResume,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sourceResume: SourceResumeInfo;
}) {
  const router = useRouter();
  const t = useT();

  const ALL_LANGS = [
    { value: "zh", label: "中文" },
    { value: "en", label: "English" },
    { value: "ja_shokumu", label: "職務経歴書" },
    { value: "ja_rirekisho", label: "履歴書" },
  ];

  const availableLangs = ALL_LANGS.filter((l) => l.value !== sourceResume.resumeType);

  const [targetType, setTargetType] = useState(availableLangs[0]?.value ?? "en");
  const [mode, setMode] = useState<"translate" | "generate">("translate");
  const [title, setTitle] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      const defaultLang = availableLangs[0]?.value ?? "en";
      setTargetType(defaultLang);
      setMode("translate");
      const langObj = ALL_LANGS.find((l) => l.value === defaultLang);
      setTitle(`${sourceResume.title} (${langObj?.label ?? defaultLang})`);
      setTemplateId(TYPE_DEFAULT_TEMPLATE[defaultLang] ?? sourceResume.templateId ?? "classic");
    }
  }, [open, sourceResume]);

  const handleLangChange = (val: string) => {
    setTargetType(val);
    const langObj = ALL_LANGS.find((l) => l.value === val);
    setTitle(`${sourceResume.title} (${langObj?.label ?? val})`);
    setTemplateId(TYPE_DEFAULT_TEMPLATE[val] ?? sourceResume.templateId ?? "classic");
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      toast.error("请输入简历名称");
      return;
    }
    setLoading(true);
    try {
      if (mode === "translate") {
        const res = await api<{ resumeId: string }>(`/resumes/${sourceResume.id}/derive`, {
          method: "POST",
          body: JSON.stringify({
            targetType,
            title: title.trim(),
            templateId,
          }),
        });
        if (res?.resumeId) {
          toast.success("已创建派生翻译简历，正在生成…");
          onOpenChange(false);
          router.push(`/resumes/${res.resumeId}`);
        }
      } else {
        const res = await api<{ resumeId: string }>(`/resumes/generate`, {
          method: "POST",
          body: JSON.stringify({
            resumeType: targetType,
            templateId,
            jdId: sourceResume.jdId ?? undefined,
          }),
        });
        if (res?.resumeId) {
          toast.success("已创建新语言版本，正在从职业库重新生成…");
          onOpenChange(false);
          router.push(`/resumes/${res.resumeId}`);
        }
      }
    } catch {
      toast.error("生成失败，请重试");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Globe className="size-5 text-primary" />
            {t("resumes.deriveLanguage")}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* 1. 目标语言 */}
          <div className="space-y-1.5">
            <Label>目标语言与格式</Label>
            <Select value={targetType} onValueChange={handleLangChange}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {availableLangs.map((l) => (
                  <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 2. 内容来源模式选择 */}
          <div className="space-y-1.5">
            <Label>内容生成策略</Label>
            <div className="grid gap-2">
              <div
                onClick={() => setMode("translate")}
                className={`cursor-pointer rounded-lg border p-3 transition-colors ${
                  mode === "translate"
                    ? "border-primary bg-primary/5 dark:bg-primary/10"
                    : "hover:bg-muted/50"
                }`}
              >
                <div className="flex items-center gap-2 font-medium text-sm">
                  <FileText className="size-4 text-primary" />
                  基于当前简历快照直接翻译（推荐）
                </div>
                <p className="mt-1 text-xs text-muted-foreground pl-6">
                  保持您在当前简历中所做的裁剪、排序和精修改动，地道翻译为目标语言。
                </p>
              </div>

              <div
                onClick={() => setMode("generate")}
                className={`cursor-pointer rounded-lg border p-3 transition-colors ${
                  mode === "generate"
                    ? "border-primary bg-primary/5 dark:bg-primary/10"
                    : "hover:bg-muted/50"
                }`}
              >
                <div className="flex items-center gap-2 font-medium text-sm">
                  <Sparkles className="size-4 text-amber-500" />
                  基于全局职业知识库重新选材生成
                </div>
                <p className="mt-1 text-xs text-muted-foreground pl-6">
                  重新从底层职业库抽取最新事实包，按目标语言市场的习惯全量重新生成。
                </p>
              </div>
            </div>
          </div>

          {/* 3. 简历标题 */}
          <div className="space-y-1.5">
            <Label>新简历名称</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>

          {/* 4. 推荐模板 */}
          <div className="space-y-1.5">
            <Label>简历模板</Label>
            <Select value={templateId} onValueChange={setTemplateId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {filterTemplatesForType(targetType).map((tm) => (
                  <SelectItem key={tm.id} value={tm.id}>
                    {tm.name} — {tm.description}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? <Loader2 className="size-4 animate-spin mr-1" /> : null}
            开始生成
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
