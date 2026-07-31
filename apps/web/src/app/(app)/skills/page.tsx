"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/client";
import { useT } from "@/lib/i18n/provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { FolderKanban, Briefcase, Link2, Plus, Trash2, Trophy, NotebookPen, FileBadge } from "lucide-react";

type Skill = {
  id: string;
  name: string;
  category?: string | null;
  level: number;
  levelSource: string;
  lastUsedAt?: string | null;
  evidenceCount: number;
};

type Evidence = {
  id: string;
  sourceType: "project" | "experience" | "work_log" | "achievement" | "certificate" | "external";
  sourceId?: string | null;
  note?: string | null;
  url?: string | null;
  weight: number;
  createdAt: string;
};

const CATEGORY_LABEL: Record<string, string> = {
  language: "skills.cat.language", framework: "skills.cat.framework", tool: "skills.cat.tool", domain: "skills.cat.domain", soft: "skills.cat.soft",
};

const SOURCE_META: Record<Evidence["sourceType"], { label: string; icon: typeof FolderKanban }> = {
  project: { label: "skills.src.project", icon: FolderKanban },
  experience: { label: "skills.src.experience", icon: Briefcase },
  work_log: { label: "skills.src.work_log", icon: NotebookPen },
  achievement: { label: "skills.src.achievement", icon: Trophy },
  certificate: { label: "skills.src.certificate", icon: FileBadge },
  external: { label: "skills.src.external", icon: Link2 },
};

export default function SkillsPage() {
  const t = useT();
  const [skills, setSkills] = useState<Skill[] | null>(null);
  const [detail, setDetail] = useState<Skill | null>(null);
  const [evidences, setEvidences] = useState<Evidence[] | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [newSkill, setNewSkill] = useState({ name: "", category: "", level: "" });
  const [evForm, setEvForm] = useState({ sourceType: "external", sourceId: "", note: "", url: "", weight: "3" });
  const [sourceOptions, setSourceOptions] = useState<{ id: string; label: string }[]>([]);

  const load = useCallback(async () => {
    const res = await api<{ data: Skill[] }>("/skills");
    if (res) setSkills(res.data);
  }, []);

  useEffect(() => {
    let active = true;
    void (async () => {
      const res = await api<{ data: Skill[] }>("/skills");
      if (active && res) setSkills(res.data);
    })();
    return () => { active = false; };
  }, []);

  async function openDetail(s: Skill) {
    setDetail(s);
    setEvidences(null);
    const res = await api<{ data: Evidence[] }>(`/skills/${s.id}/evidences`);
    if (res) setEvidences(res.data);
  }

  // 证据来源实体选项按需加载
  useEffect(() => {
    async function loadOptions() {
      if (evForm.sourceType === "project") {
        const res = await api<{ data: { id: string; name: string }[] }>("/projects");
        setSourceOptions(res?.data.map((p) => ({ id: p.id, label: p.name })) ?? []);
      } else if (evForm.sourceType === "experience") {
        const res = await api<{ data: { id: string; company: string; title: string }[] }>("/experiences");
        setSourceOptions(res?.data.map((e) => ({ id: e.id, label: `${e.company} · ${e.title}` })) ?? []);
      } else if (evForm.sourceType === "achievement") {
        const res = await api<{ data: { id: string; title: string }[] }>("/achievements");
        setSourceOptions(res?.data.map((a) => ({ id: a.id, label: a.title })) ?? []);
      } else {
        setSourceOptions([]);
      }
      setEvForm((f) => ({ ...f, sourceId: "" }));
    }
    void loadOptions();
  }, [evForm.sourceType]);

  async function createSkill() {
    if (!newSkill.name) {
      toast.error(t("skills.nameRequired"));
      return;
    }
    const res = await api("/skills", {
      method: "POST",
      body: JSON.stringify({
        name: newSkill.name,
        category: newSkill.category || undefined,
        level: newSkill.level ? Number(newSkill.level) : undefined,
      }),
    });
    if (res) {
      toast.success(t("skills.skillAdded"));
      setCreateOpen(false);
      setNewSkill({ name: "", category: "", level: "" });
      void load();
    }
  }

  async function addEvidence() {
    if (!detail) return;
    if (evForm.sourceType !== "external" && !evForm.sourceId) {
      toast.error(t("skills.sourceRequired"));
      return;
    }
    const res = await api(`/skills/${detail.id}/evidences`, {
      method: "POST",
      body: JSON.stringify({
        sourceType: evForm.sourceType,
        sourceId: evForm.sourceId || null,
        note: evForm.note || undefined,
        url: evForm.url || null,
        weight: Number(evForm.weight),
      }),
    });
    if (res) {
      toast.success(t("skills.evidenceAdded"));
      setEvForm({ sourceType: "external", sourceId: "", note: "", url: "", weight: "3" });
      void openDetail(detail);
      void load();
    }
  }

  async function removeEvidence(evidenceId: string) {
    if (!detail) return;
    const res = await api(`/skills/${detail.id}/evidences/${evidenceId}`, { method: "DELETE" });
    if (res) {
      void openDetail(detail);
      void load();
    }
  }

  async function removeSkill(id: string) {
    const res = await api(`/skills/${id}`, { method: "DELETE" });
    if (res) {
      toast.success(t("common.deleted"));
      setDetail(null);
      void load();
    }
  }

  if (!skills) {
    return <div className="mx-auto grid max-w-5xl gap-3 md:grid-cols-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-28" />)}</div>;
  }

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold">{t("skills.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("skills.subtitle")}</p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="size-4" /> {t("skills.add")}</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader><DialogTitle>{t("skills.add")}</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>{t("skills.name")}</Label>
                <Input value={newSkill.name} onChange={(e) => setNewSkill({ ...newSkill, name: e.target.value })} placeholder={t("skills.namePlaceholder")} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>{t("skills.category")}</Label>
                  <Select value={newSkill.category} onValueChange={(v) => setNewSkill({ ...newSkill, category: v })}>
                    <SelectTrigger><SelectValue placeholder={t("common.select")} /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(CATEGORY_LABEL).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{t(v)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>{t("skills.level")}</Label>
                  <Input type="number" min={0} max={100} value={newSkill.level} onChange={(e) => setNewSkill({ ...newSkill, level: e.target.value })} />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={createSkill}>{t("common.save")}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {skills.length === 0 && (
        <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">
          {t("skills.empty")}
        </CardContent></Card>
      )}

      <div className="grid gap-3 md:grid-cols-3">
        {skills.map((s) => (
          <Card key={s.id} className="cursor-pointer transition-colors hover:bg-accent/40" onClick={() => openDetail(s)}>
            <CardContent className="space-y-2 py-4">
              <div className="flex items-center justify-between">
                <p className="font-medium">{s.name}</p>
                {s.category && <Badge variant="outline" className="font-normal">{CATEGORY_LABEL[s.category] ? t(CATEGORY_LABEL[s.category]) : s.category}</Badge>}
              </div>
              <Progress value={s.level} />
                <p className="text-xs text-muted-foreground">
                  {t("skills.levelLine", { level: s.level, count: s.evidenceCount })}
                  {s.levelSource === "ai" && t("skills.aiInferred")}
                </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Sheet open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <SheetContent className="overflow-y-auto sm:max-w-md">
          {detail && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  {detail.name}
                  <Badge variant="secondary" className="font-normal">{t("skills.levelBadge", { level: detail.level })}</Badge>
                </SheetTitle>
              </SheetHeader>
              <div className="space-y-5 px-4 pb-6">
                <div>
                  <h3 className="mb-2 text-sm font-medium">{t("skills.evidenceHeading", { count: evidences?.length ?? "…" })}</h3>
                  {!evidences && <Skeleton className="h-16" />}
                  {evidences?.length === 0 && (
                    <p className="text-sm text-muted-foreground">{t("skills.evidenceEmpty")}</p>
                  )}
                  <div className="space-y-2">
                    {evidences?.map((ev) => {
                      const Meta = SOURCE_META[ev.sourceType];
                      return (
                        <div key={ev.id} className="flex items-start gap-2 rounded-md border p-2.5 text-sm">
                          <Meta.icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                          <div className="min-w-0 flex-1">
                            <p className="text-xs text-muted-foreground">{t("skills.evidenceWeight", { label: t(Meta.label), weight: ev.weight })}</p>
                            {ev.note && <p className="mt-0.5">{ev.note}</p>}
                            {ev.url && (
                              <a className="truncate text-xs text-muted-foreground underline" href={ev.url} target="_blank" rel="noreferrer">
                                {ev.url}
                              </a>
                            )}
                          </div>
                          <Button variant="ghost" size="icon" className="size-7 shrink-0" onClick={() => removeEvidence(ev.id)}>
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <Separator />

                <div className="space-y-3">
                  <h3 className="text-sm font-medium">{t("skills.addEvidence")}</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>{t("skills.sourceType")}</Label>
                      <Select value={evForm.sourceType} onValueChange={(v) => setEvForm({ ...evForm, sourceType: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="project">{t("skills.src.project")}</SelectItem>
                          <SelectItem value="experience">{t("skills.src.experienceFull")}</SelectItem>
                          <SelectItem value="achievement">{t("skills.src.achievement")}</SelectItem>
                          <SelectItem value="certificate">{t("skills.src.certificateFull")}</SelectItem>
                          <SelectItem value="external">{t("skills.src.externalFull")}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label>{t("skills.weight")}</Label>
                      <Input type="number" min={1} max={5} value={evForm.weight} onChange={(e) => setEvForm({ ...evForm, weight: e.target.value })} />
                    </div>
                  </div>
                  {sourceOptions.length > 0 && (
                    <div className="space-y-1.5">
                      <Label>{t("skills.sourceEntity")}</Label>
                      <Select value={evForm.sourceId} onValueChange={(v) => setEvForm({ ...evForm, sourceId: v })}>
                        <SelectTrigger><SelectValue placeholder={t("common.select")} /></SelectTrigger>
                        <SelectContent>
                          {sourceOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  {(evForm.sourceType === "external" || evForm.sourceType === "certificate") && (
                    <div className="space-y-1.5">
                      <Label>{t("skills.link")}</Label>
                      <Input value={evForm.url} onChange={(e) => setEvForm({ ...evForm, url: e.target.value })} placeholder="https://…" />
                    </div>
                  )}
                  <div className="space-y-1.5">
                    <Label>{t("skills.note")}</Label>
                    <Input value={evForm.note} onChange={(e) => setEvForm({ ...evForm, note: e.target.value })} placeholder={t("skills.notePlaceholder")} />
                  </div>
                  <Button size="sm" onClick={addEvidence}>{t("skills.addEvidence")}</Button>
                </div>

                <Separator />

                <Button variant="destructive" size="sm" onClick={() => removeSkill(detail.id)}>
                  {t("skills.deleteSkill")}
                </Button>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
