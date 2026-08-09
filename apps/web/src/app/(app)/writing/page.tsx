"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Copy, Sparkles } from "lucide-react";
import { api } from "@/lib/client";
import { Button } from "@/components/ui/button";
import { useT, useLocale } from "@/lib/i18n/provider";

const DOC_TYPES = [
  { key: "cover_letter", label: "writing.type.cover" },
  { key: "thank_you", label: "writing.type.thanks" },
  { key: "follow_up", label: "writing.type.followup" },
] as const;
const TONES = [
  { key: "formal", label: "writing.tone.formal" },
  { key: "warm", label: "writing.tone.warm" },
  { key: "concise", label: "writing.tone.concise" },
] as const;

// 把 UI locale 归并到生成类支持的文档语言（zh/en/ja）。
function docLangFor(locale: string): "zh" | "en" | "ja" {
  if (locale.startsWith("ja")) return "ja";
  if (locale.startsWith("en")) return "en";
  return "zh";
}

export default function WritingStudioPage() {
  const t = useT();
  const locale = useLocale();
  const LANGS = [
    { key: "zh", label: t("writing.lang.zh") },
    { key: "en", label: t("writing.lang.en") },
    { key: "ja", label: t("writing.lang.ja") },
  ];
  const [docType, setDocType] = useState<string>("cover_letter");
  const [language, setLanguage] = useState<string>(() => docLangFor(locale));
  const [tone, setTone] = useState<string>("formal");
  const [context, setContext] = useState("");
  const [points, setPoints] = useState("");
  const [result, setResult] = useState("");
  const [busy, setBusy] = useState(false);

  async function generate() {
    setBusy(true);
    const r = await api<{ data: { content: string; model: string } }>("/writing/generate", {
      method: "POST",
      body: JSON.stringify({ docType, language, tone, context: context.trim() || undefined, points: points.trim() || undefined }),
    });
    setBusy(false);
    if (r) setResult(r.data.content);
  }

  async function copy() {
    await navigator.clipboard.writeText(result);
    toast.success(t("common.copied"));
  }

  const chip = (active: boolean) =>
    `rounded-md border px-3 py-1.5 text-sm transition-colors ${active ? "border-primary bg-primary/10 font-medium text-foreground" : "text-muted-foreground hover:bg-accent/50"}`;

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">{t("writing.title")}</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">{t("writing.desc")}</p>
        <p className="mt-1 text-xs text-muted-foreground/70">{t("writing.privacy")}</p>
      </header>

      <div className="grid gap-5 md:grid-cols-2">
        {/* 左：输入 */}
        <div className="space-y-4">
          <div className="space-y-1.5">
            <p className="text-sm text-muted-foreground">{t("writing.type")}</p>
            <div className="flex flex-wrap gap-2">
              {DOC_TYPES.map((d) => <button key={d.key} className={chip(docType === d.key)} onClick={() => setDocType(d.key)}>{t(d.label)}</button>)}
            </div>
          </div>
          <div className="flex gap-6">
            <div className="space-y-1.5">
              <p className="text-sm text-muted-foreground">{t("writing.language")}</p>
              <div className="flex gap-2">{LANGS.map((l) => <button key={l.key} className={chip(language === l.key)} onClick={() => setLanguage(l.key)}>{l.label}</button>)}</div>
            </div>
            <div className="space-y-1.5">
              <p className="text-sm text-muted-foreground">{t("writing.tone")}</p>
              <div className="flex gap-2">{TONES.map((tn) => <button key={tn.key} className={chip(tone === tn.key)} onClick={() => setTone(tn.key)}>{t(tn.label)}</button>)}</div>
            </div>
          </div>
          <div className="space-y-1.5">
            <p className="text-sm text-muted-foreground">{t("writing.context")}</p>
            <textarea value={context} onChange={(e) => setContext(e.target.value)} rows={5} placeholder={t("writing.contextPh")} className="w-full rounded-md border bg-background px-2.5 py-2 text-sm" />
          </div>
          <div className="space-y-1.5">
            <p className="text-sm text-muted-foreground">{t("writing.points")}</p>
            <textarea value={points} onChange={(e) => setPoints(e.target.value)} rows={2} placeholder={t("writing.pointsPh")} className="w-full rounded-md border bg-background px-2.5 py-2 text-sm" />
          </div>
          <Button disabled={busy} onClick={generate}>
            <Sparkles className="size-4" /> {busy ? t("common.generating") : result ? t("common.regenerate") : t("writing.generate")}
          </Button>
        </div>

        {/* 右：结果 */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">{t("writing.result")}</p>
            {result && <Button size="sm" variant="outline" onClick={copy}><Copy className="size-3.5" /> {t("common.copy")}</Button>}
          </div>
          <textarea
            value={result}
            onChange={(e) => setResult(e.target.value)}
            rows={20}
            placeholder={busy ? t("writing.writingPh") : t("writing.resultPh")}
            className="w-full rounded-md border bg-background px-3 py-2.5 text-sm leading-relaxed"
          />
        </div>
      </div>
    </div>
  );
}
