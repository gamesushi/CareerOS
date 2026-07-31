"use client";

// 收录岗位：用户手动录入 / 贴链接 AI 抓取，补充到平台总岗位库。
// 与自动抓取（岗位雷达 watch）互补：抓不到的源、内推信息、小众岗位由用户补录。

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { api } from "@/lib/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, CheckCircle2, Loader2, Sparkles } from "lucide-react";
import { useT } from "@/lib/i18n/provider";

type Draft = {
  title: string;
  company: string | null;
  location: string | null;
  salary: string | null;
  snippet: string | null;
  publishedAt: string | null;
  url: string;
};

type Duplicate = { id: string; title: string; company: string | null; source: string } | null;

const EMPTY_FORM = { title: "", company: "", location: "", salary: "", url: "", snippet: "" };

export default function SubmitJobPage() {
  const t = useT();
  // —— 手动录入 ——
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  // —— 链接导入 ——
  const [importUrl, setImportUrl] = useState("");
  const [importing, setImporting] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [duplicate, setDuplicate] = useState<Duplicate>(null);
  const [confirming, setConfirming] = useState(false);
  const [done, setDone] = useState(false);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submitManual() {
    setSaving(true);
    const res = await api<{ id: string }>("/discovered-jobs/submit", {
      method: "POST",
      body: JSON.stringify({
        title: form.title,
        url: form.url,
        company: form.company || undefined,
        location: form.location || undefined,
        salary: form.salary || undefined,
        snippet: form.snippet || undefined,
        via: "manual",
      }),
    });
    setSaving(false);
    if (res) {
      toast.success(t("submitJob.saved"));
      setForm({ ...EMPTY_FORM });
      setDone(true);
    }
  }

  async function fetchDraft() {
    setImporting(true);
    setDraft(null);
    setDuplicate(null);
    const res = await api<{ draft: Draft; duplicate: Duplicate }>("/discovered-jobs/import-url", {
      method: "POST",
      body: JSON.stringify({ url: importUrl }),
    });
    setImporting(false);
    if (res) {
      setDraft(res.draft);
      setDuplicate(res.duplicate);
    }
  }

  async function confirmImport() {
    if (!draft) return;
    setConfirming(true);
    const res = await api<{ id: string }>("/discovered-jobs/submit", {
      method: "POST",
      body: JSON.stringify({
        title: draft.title,
        url: draft.url,
        company: draft.company || undefined,
        location: draft.location || undefined,
        salary: draft.salary || undefined,
        snippet: draft.snippet || undefined,
        publishedAt: draft.publishedAt || undefined,
        via: "import",
        force: Boolean(duplicate), // 已提示过重复，用户仍确认则强制收录
      }),
    });
    setConfirming(false);
    if (res) {
      toast.success(t("submitJob.saved"));
      setImportUrl("");
      setDraft(null);
      setDuplicate(null);
      setDone(true);
    }
  }

  const manualValid = form.title.trim().length >= 2 && /^https?:\/\//i.test(form.url.trim());

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold">{t("submitJob.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("submitJob.subtitle")}</p>
        </div>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/monitor"><ArrowLeft className="size-4" /> {t("submitJob.backToMonitor")}</Link>
        </Button>
      </div>

      {done && (
        <Card className="border-green-600/30 bg-green-500/5">
          <CardContent className="flex items-center gap-2 py-3 text-sm">
            <CheckCircle2 className="size-4 text-green-600" />
            <span>{t("submitJob.doneHint")}</span>
            <Link href="/monitor" className="ml-auto text-primary underline-offset-2 hover:underline">
              {t("submitJob.viewInMonitor")}
            </Link>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="py-4">
          <Tabs defaultValue="url">
            <TabsList>
              <TabsTrigger value="url">{t("submitJob.tab.url")}</TabsTrigger>
              <TabsTrigger value="manual">{t("submitJob.tab.manual")}</TabsTrigger>
            </TabsList>

            {/* —— 链接导入 —— */}
            <TabsContent value="url" className="space-y-3 pt-2">
              <div className="flex gap-2">
                <Input
                  placeholder={t("submitJob.urlPlaceholder")}
                  value={importUrl}
                  onChange={(e) => setImportUrl(e.target.value)}
                />
                <Button
                  disabled={importing || !/^https?:\/\//i.test(importUrl.trim())}
                  onClick={fetchDraft}
                >
                  {importing ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
                  {t("submitJob.fetch")}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">{t("submitJob.urlHint")}</p>

              {duplicate && (
                <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs">
                  {t("submitJob.duplicateWarn", {
                    job: [duplicate.company, duplicate.title].filter(Boolean).join(" · "),
                    source: duplicate.source,
                  })}
                </div>
              )}

              {draft && (
                <div className="space-y-3 rounded-md border p-3">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">{t("submitJob.previewBadge")}</Badge>
                    <span className="text-xs text-muted-foreground">{t("submitJob.previewHint")}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2 space-y-1.5">
                      <Label>{t("submitJob.field.title")}</Label>
                      <Input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>{t("submitJob.field.company")}</Label>
                      <Input value={draft.company ?? ""} onChange={(e) => setDraft({ ...draft, company: e.target.value })} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>{t("submitJob.field.location")}</Label>
                      <Input value={draft.location ?? ""} onChange={(e) => setDraft({ ...draft, location: e.target.value })} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>{t("submitJob.field.salary")}</Label>
                      <Input value={draft.salary ?? ""} onChange={(e) => setDraft({ ...draft, salary: e.target.value })} />
                    </div>
                    <div className="col-span-2 space-y-1.5">
                      <Label>{t("submitJob.field.snippet")}</Label>
                      <Textarea rows={4} value={draft.snippet ?? ""} onChange={(e) => setDraft({ ...draft, snippet: e.target.value })} />
                    </div>
                  </div>
                  <Button disabled={confirming || draft.title.trim().length < 2} onClick={confirmImport}>
                    {confirming ? <Loader2 className="size-4 animate-spin" /> : null}
                    {duplicate ? t("submitJob.confirmAnyway") : t("submitJob.confirm")}
                  </Button>
                </div>
              )}
            </TabsContent>

            {/* —— 手动录入 —— */}
            <TabsContent value="manual" className="space-y-3 pt-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2 space-y-1.5">
                  <Label>{t("submitJob.field.title")} *</Label>
                  <Input placeholder={t("submitJob.titlePlaceholder")} value={form.title} onChange={set("title")} />
                </div>
                <div className="col-span-2 space-y-1.5">
                  <Label>{t("submitJob.field.url")} *</Label>
                  <Input placeholder="https://…" value={form.url} onChange={set("url")} />
                </div>
                <div className="space-y-1.5">
                  <Label>{t("submitJob.field.company")}</Label>
                  <Input value={form.company} onChange={set("company")} />
                </div>
                <div className="space-y-1.5">
                  <Label>{t("submitJob.field.location")}</Label>
                  <Input value={form.location} onChange={set("location")} />
                </div>
                <div className="space-y-1.5">
                  <Label>{t("submitJob.field.salary")}</Label>
                  <Input placeholder={t("submitJob.salaryPlaceholder")} value={form.salary} onChange={set("salary")} />
                </div>
                <div className="col-span-2 space-y-1.5">
                  <Label>{t("submitJob.field.snippet")}</Label>
                  <Textarea rows={4} placeholder={t("submitJob.snippetPlaceholder")} value={form.snippet} onChange={set("snippet")} />
                </div>
              </div>
              <Button disabled={saving || !manualValid} onClick={submitManual}>
                {saving ? <Loader2 className="size-4 animate-spin" /> : null}
                {t("submitJob.save")}
              </Button>
              {!manualValid && (form.title || form.url) && (
                <p className="text-xs text-muted-foreground">{t("submitJob.manualInvalidHint")}</p>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
