"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { api } from "@/lib/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { TEMPLATE_META } from "@/lib/pdf/template-meta";
import { FileText, Plus, Trash2 } from "lucide-react";
import { useT } from "@/lib/i18n/provider";

type ResumeRow = {
  id: string;
  title: string;
  resumeType: string;
  version: number;
  status: string;
  sourceResumeId?: string | null;
  generatedAt: string;
  jd?: { company?: string | null; title?: string | null } | null;
};

type JdOption = { id: string; company?: string | null; title?: string | null; status: string };

const NONE = "__none__";

export default function ResumesPage() {
  const router = useRouter();
  const t = useT();
  const [items, setItems] = useState<ResumeRow[] | null>(null);
  const [jds, setJds] = useState<JdOption[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ jdId: NONE, resumeType: "zh", templateId: "classic" });
  const [generating, setGenerating] = useState(false);

  const load = useCallback(async () => {
    const [resumesRes, jdsRes] = await Promise.all([
      api<{ data: ResumeRow[] }>("/resumes"),
      api<{ data: JdOption[] }>("/jds"),
    ]);
    if (resumesRes) setItems(resumesRes.data);
    if (jdsRes) setJds(jdsRes.data.filter((j) => j.status === "parsed"));
  }, []);

  useEffect(() => {
    let active = true;
    void (async () => {
      const [resumesRes, jdsRes] = await Promise.all([
        api<{ data: ResumeRow[] }>("/resumes"),
        api<{ data: JdOption[] }>("/jds"),
      ]);
      if (active) {
        if (resumesRes) setItems(resumesRes.data);
        if (jdsRes) setJds(jdsRes.data.filter((j) => j.status === "parsed"));
      }
    })();
    return () => { active = false; };
  }, []);

  async function generate() {
    setGenerating(true);
    const res = await api<{ resumeId: string }>("/resumes/generate", {
      method: "POST",
      body: JSON.stringify({
        jdId: form.jdId === NONE ? null : form.jdId,
        resumeType: form.resumeType,
        templateId: form.templateId,
      }),
    });
    setGenerating(false);
    if (res) {
      setOpen(false);
      router.push(`/resumes/${res.resumeId}`);
    }
  }

  async function remove(id: string) {
    const res = await api(`/resumes/${id}`, { method: "DELETE" });
    if (res) {
      toast.success(t("common.deleted"));
      void load();
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">{t("resumes.title")}</h1>
          <p className="text-sm text-muted-foreground">
            {t("resumes.subtitle")}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="size-4" /> {t("resumes.generate")}</Button>
            </DialogTrigger>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader><DialogTitle>{t("resumes.generate")}</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>{t("resumes.targetJd")}</Label>
                <Select value={form.jdId} onValueChange={(v) => setForm({ ...form, jdId: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>{t("resumes.targetJdNone")}</SelectItem>
                    {jds.map((j) => (
                      <SelectItem key={j.id} value={j.id}>
                        {[j.company, j.title].filter(Boolean).join(" · ") || j.id.slice(0, 8)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>{t("resumes.langFormat")}</Label>
                <Select value={form.resumeType} onValueChange={(v) => setForm({ ...form, resumeType: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="zh">{t("resumes.lang.zh")}</SelectItem>
                    <SelectItem value="en">{t("resumes.lang.en")}</SelectItem>
                    <SelectItem value="ja_shokumu">{t("resumes.lang.ja_shokumu")}</SelectItem>
                    <SelectItem value="ja_rirekisho">{t("resumes.lang.ja_rirekisho")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>{t("resumes.template")}</Label>
                <Select value={form.templateId} onValueChange={(v) => setForm({ ...form, templateId: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TEMPLATE_META.map((tm) => (
                      <SelectItem key={tm.id} value={tm.id}>{t(tm.nameKey)} — {t(tm.descriptionKey)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={generate} disabled={generating}>
                {generating ? t("resumes.creating") : t("resumes.startGenerate")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      </div>

      {!items && <Skeleton className="h-40" />}
      {items?.length === 0 && (
        <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">
          {t("resumes.empty")}
        </CardContent></Card>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        {items?.map((r) => (
          <Card
            key={r.id}
            className="cursor-pointer transition-colors hover:bg-accent/40"
            onClick={() => router.push(`/resumes/${r.id}`)}
          >
            <CardContent className="flex items-start gap-3 py-4">
              <FileText className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{r.title}</p>
                <p className="text-xs text-muted-foreground">
                  v{r.version} · {new Date(r.generatedAt).toLocaleString("zh-CN")}
                </p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  <Badge variant="secondary" className="font-normal">{t(`resumes.type.${r.resumeType}`)}</Badge>
                  <Badge variant="outline" className="font-normal">{r.status === "final" ? t("resumes.final") : t("resumes.draft")}</Badge>
                  {r.sourceResumeId && (
                    <Badge variant="outline" className="border-primary/40 text-primary font-normal text-[10px]">派生版本</Badge>
                  )}
                </div>
              </div>
              <Button
                variant="ghost" size="icon" className="size-7 shrink-0"
                onClick={(e) => { e.stopPropagation(); void remove(r.id); }}
              >
                <Trash2 className="size-3.5" />
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
