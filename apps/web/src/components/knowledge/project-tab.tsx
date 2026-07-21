"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { api, fmtDate } from "@/lib/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useT } from "@/lib/i18n/provider";

type Project = {
  id: string;
  name: string;
  role?: string | null;
  experienceId?: string | null;
  experience?: { id: string; company: string } | null;
  startDate?: string | null;
  endDate?: string | null;
  description?: string | null;
  outcome?: string | null;
  techStack: string[];
  skills: { skill: { id: string; name: string } }[];
};

type ExperienceOption = { id: string; company: string; title: string };

const NONE = "__none__";
const EMPTY_FORM = {
  name: "", role: "", experienceId: NONE, startDate: "", endDate: "",
  description: "", outcome: "", techStack: "",
};

export function ProjectTab() {
  const t = useT();
  const [items, setItems] = useState<Project[] | null>(null);
  const [experiences, setExperiences] = useState<ExperienceOption[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Project | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const [projRes, expRes] = await Promise.all([
      api<{ data: Project[] }>("/projects"),
      api<{ data: ExperienceOption[] }>("/experiences"),
    ]);
    if (projRes) setItems(projRes.data);
    if (expRes) setExperiences(expRes.data);
  }, []);

  useEffect(() => { void load(); }, [load]);

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setOpen(true);
  }

  function openEdit(p: Project) {
    setEditing(p);
    setForm({
      name: p.name,
      role: p.role ?? "",
      experienceId: p.experienceId ?? NONE,
      startDate: fmtDate(p.startDate),
      endDate: fmtDate(p.endDate),
      description: p.description ?? "",
      outcome: p.outcome ?? "",
      techStack: p.techStack.join(", "),
    });
    setOpen(true);
  }

  async function save() {
    if (!form.name) {
      toast.error(t("project.requiredError"));
      return;
    }
    setSaving(true);
    const body = JSON.stringify({
      name: form.name,
      role: form.role || undefined,
      experienceId: form.experienceId === NONE ? null : form.experienceId,
      startDate: form.startDate || null,
      endDate: form.endDate || null,
      description: form.description || undefined,
      outcome: form.outcome || undefined,
      techStack: form.techStack.split(/[,，]/).map((s) => s.trim()).filter(Boolean),
      skillIds: editing ? editing.skills.map((s) => s.skill.id) : [],
    });
    const res = editing
      ? await api(`/projects/${editing.id}`, { method: "PUT", body })
      : await api("/projects", { method: "POST", body });
    setSaving(false);
    if (res) {
      toast.success(editing ? t("common.updated") : t("common.added"));
      setOpen(false);
      void load();
    }
  }

  async function remove(id: string) {
    const res = await api(`/projects/${id}`, { method: "DELETE" });
    if (res) {
      toast.success(t("common.deleted"));
      void load();
    }
  }

  if (!items) {
    return <div className="grid gap-3 pt-4 md:grid-cols-2">{[1, 2].map((i) => <Skeleton key={i} className="h-36" />)}</div>;
  }

  return (
    <div className="space-y-3 pt-2">
      <div className="flex justify-end">
        <Button size="sm" onClick={openCreate}><Plus className="size-4" /> {t("project.add")}</Button>
      </div>

      {items.length === 0 && (
        <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">
          {t("project.empty")}
        </CardContent></Card>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        {items.map((p) => (
          <Card key={p.id}>
            <CardContent className="space-y-2 py-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-medium">{p.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {p.role && `${p.role} · `}
                    {p.experience?.company ?? t("project.personal")}
                    {p.startDate && ` · ${fmtDate(p.startDate).slice(0, 7)}${p.endDate ? ` ~ ${fmtDate(p.endDate).slice(0, 7)}` : ` ~ ${t("common.present")}`}`}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button variant="ghost" size="icon" className="size-8" onClick={() => openEdit(p)}>
                    <Pencil className="size-3.5" />
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon" className="size-8"><Trash2 className="size-3.5" /></Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>{t("project.deleteTitle", { name: p.name })}</AlertDialogTitle>
                        <AlertDialogDescription>{t("project.deleteDesc")}</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
                        <AlertDialogAction onClick={() => remove(p.id)}>{t("common.delete")}</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
              {p.outcome && <p className="line-clamp-2 text-sm text-muted-foreground">{p.outcome}</p>}
              {(p.techStack.length > 0 || p.skills.length > 0) && (
                <div className="flex flex-wrap gap-1.5">
                  {p.techStack.map((t) => <Badge key={t} variant="outline" className="font-normal">{t}</Badge>)}
                  {p.skills.map((s) => <Badge key={s.skill.id} variant="secondary" className="font-normal">{s.skill.name}</Badge>)}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="overflow-y-auto sm:max-w-md">
          <SheetHeader><SheetTitle>{editing ? t("project.editTitle") : t("project.addTitle")}</SheetTitle></SheetHeader>
          <div className="space-y-4 px-4">
            <div className="space-y-1.5">
              <Label>{t("project.name")}</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{t("project.role")}</Label>
                <Input value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>{t("project.belongsTo")}</Label>
                <Select value={form.experienceId} onValueChange={(v) => setForm({ ...form, experienceId: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>{t("project.personal")}</SelectItem>
                    {experiences.map((e) => (
                      <SelectItem key={e.id} value={e.id}>{e.company} · {e.title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{t("project.startDate")}</Label>
                <Input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>{t("project.endDate")}</Label>
                <Input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>{t("project.description")}</Label>
              <Textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>{t("project.outcome")}</Label>
              <Textarea rows={2} value={form.outcome} onChange={(e) => setForm({ ...form, outcome: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>{t("project.techStack")}</Label>
              <Input value={form.techStack} onChange={(e) => setForm({ ...form, techStack: e.target.value })} placeholder={t("project.techStackPlaceholder")} />
            </div>
          </div>
          <SheetFooter>
            <Button onClick={save} disabled={saving}>{saving ? t("common.saving") : t("common.save")}</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}
